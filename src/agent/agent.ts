/**
 * Core AI Agent - Agentic loop pattern with Gemini 3 SDK
 */

import { GoogleGenAI, ThinkingLevel, Part, Content, GenerateContentResponse, Tool as SDKTool, FunctionDeclaration } from '@google/genai';
import { logger } from '../utils/logger.js';
import { Tool, AgentConfig, AgentTask, ToolCall } from './types.js';
import { AGENT_SYSTEM_PROMPT, createTaskPrompt } from './prompts/agent-prompt.js';
import { getAllTools } from './tools/index.js';
import { ConversationSummarizer } from './summarizer.js';

type ConversationMessage = Content;

const MAX_API_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;

// Token management constants
const MAX_CONTEXT_TOKENS = 1000000;      // 1M input context (Gemini 3 Pro/Flash), 64k output
const COMPRESSION_THRESHOLD = 0.7;       // Compress at 70% capacity
const KEEP_RECENT_MESSAGES = 10;         // Always keep last N messages

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class Agent {
    private client: GoogleGenAI;
    private config: AgentConfig;
    private tools: Tool[];
    private conversation: ConversationMessage[] = [];
    private activeProjectPath: string | null = null;
    private isInitialized: boolean = false;
    private originalTaskPrompt: string = '';
    private summarizer: ConversationSummarizer;
    private lastTokenCount: number = 0;  // Actual token count from last API response

    constructor(config: AgentConfig) {
        this.config = config;
        this.client = new GoogleGenAI({ apiKey: config.geminiApiKey });
        this.tools = getAllTools();
        this.summarizer = new ConversationSummarizer(config.geminiApiKey, config.modelName);
    }

    private getThinkingLevel(modelName: string): ThinkingLevel {
        return modelName.includes('pro') ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM;
    }

    public async init(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;
    }

    async start(task: AgentTask): Promise<void> {
        if (!this.isInitialized) await this.init();

        const { prompt, projectPath, databaseUrl } = task;
        this.activeProjectPath = projectPath;

        logger.step('Starting Full Stack Agent');
        logger.info(`Goal: ${prompt}`);
        logger.info(`Output: ${projectPath}`);
        if (databaseUrl) logger.info(`DB URL provided`);

        const setupPrompt = createTaskPrompt(prompt, projectPath, databaseUrl);
        this.originalTaskPrompt = setupPrompt;

        // Check for previous summary to continue from
        const previousSummary = await this.summarizer.loadSummary(projectPath);
        if (previousSummary) {
            logger.info('Found previous progress summary, continuing...');
            this.conversation = [{
                role: 'user',
                parts: [{ text: `${setupPrompt}\n\n## Previous Progress:\n${previousSummary}\n\nContinue from where you left off.` }]
            }];
        } else {
            this.conversation = [{
                role: 'user',
                parts: [{ text: setupPrompt }]
            }];
        }

        await this.executeTaskLoop('Planning-Phase');

        logger.step('Agent session ended - Implementation Complete');
    }

    async chat(message: string): Promise<void> {
        if (!this.isInitialized) await this.init();
        if (!this.activeProjectPath) {
            throw new Error('Agent has not been started. Call start() first.');
        }

        logger.step('Continuing Agent Session');
        logger.info(`Request: ${message}`);

        this.conversation.push({
            role: 'user',
            parts: [{ text: message }]
        });

        await this.executeTaskLoop('Follow-up-Phase');

        logger.step('Request Completed');
    }

    private async executeTaskLoop(contextId: string): Promise<void> {
        let iteration = 0;
        let isComplete = false;
        let consecutiveEmptyResponses = 0;
        const maxIterations = this.config.maxIterations;
        const MAX_EMPTY_RESPONSES = 3;

        while (!isComplete && iteration < maxIterations) {
            iteration++;
            logger.step(`[${contextId}] Iteration ${iteration}/${maxIterations}`);

            await this.checkAndCompressConversation();

            try {
                const response = await this.callAIWithRetry();
                this.updateTokenCount(response);

                const finishReason = response.candidates?.[0]?.finishReason;

                const { text, toolCalls, functionResponseParts } = this.parseResponse(response);

                // Handle empty response
                if (!text && toolCalls.length === 0) {
                    consecutiveEmptyResponses++;
                    logger.warn(`Empty response (${consecutiveEmptyResponses}/${MAX_EMPTY_RESPONSES})`);

                    if (consecutiveEmptyResponses >= MAX_EMPTY_RESPONSES) {
                        logger.info(`[${contextId}] Stopping after ${MAX_EMPTY_RESPONSES} consecutive empty responses`);
                        isComplete = true;
                        continue;
                    }
                    continue;
                }

                consecutiveEmptyResponses = 0;

                if (text) {
                    logger.dim('AI: ' + text.substring(0, 300) + (text.length > 300 ? '...' : ''));

                    if (text.toUpperCase().includes('TASK COMPLETE')) {
                        logger.success(`[${contextId}] Task Complete signal detected!`);
                        isComplete = true;
                        continue;
                    }
                }

                // No tool calls = model finished or needs more info
                if (toolCalls.length === 0) {
                    if (finishReason === 'STOP') {
                        logger.success(`[${contextId}] Task Complete signal detected!`);
                        isComplete = true;
                        continue;
                    }

                    this.conversation.push({
                        role: 'user',
                        parts: [{ text: 'Continue with the task. Use tools as needed. When finished, say "TASK COMPLETE".' }]
                    });
                    continue;
                }

                const toolResults = await this.executeTools(toolCalls);
                this.conversation.push({
                    role: 'model',
                    parts: functionResponseParts.length > 0 ? functionResponseParts : [{ text: text || '' }]
                });

                this.conversation.push({
                    role: 'user',
                    parts: toolResults.map(r => ({
                        functionResponse: {
                            name: r.name,
                            response: { result: r.result }
                        }
                    }))
                });

            } catch (error: any) {
                logger.error(`[${contextId}] Iteration ${iteration} error: ${error.message}`);

                // Check if token limit exceeded
                if (this.isTokenLimitError(error)) {
                    logger.warn('Token limit exceeded, generating summary and restarting...');
                    await this.handleTokenLimitExceeded();
                    continue;
                }

                this.conversation.push({
                    role: 'user',
                    parts: [{ text: `Error: ${error.message}. Try a different approach.` }]
                });
            }
        }

        if (!isComplete) {
            logger.warn(`[${contextId}] Reached max iterations (${maxIterations}) without completion signal`);
        }
    }

    private async callAIWithRetry(): Promise<GenerateContentResponse> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
            try {
                return await this.callAI();
            } catch (error: any) {
                lastError = error;
                const errorMessage = error.message || '';
                const errorString = JSON.stringify(error);

                // Check if it's a retryable error (503, 429, overloaded, etc.)
                const isRetryable =
                    errorMessage.includes('503') ||
                    errorMessage.includes('429') ||
                    errorMessage.includes('overloaded') ||
                    errorMessage.includes('UNAVAILABLE') ||
                    errorMessage.includes('rate limit') ||
                    errorMessage.includes('quota') ||
                    errorString.includes('503') ||
                    errorString.includes('overloaded');

                if (isRetryable && attempt < MAX_API_RETRIES) {
                    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                    const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    logger.warn(`API error (${attempt}/${MAX_API_RETRIES}), retrying in ${delayMs / 1000}s...`);
                    await sleep(delayMs);
                } else if (!isRetryable) {
                    // Non-retryable error, throw immediately
                    throw error;
                }
            }
        }

        // All retries exhausted
        throw lastError || new Error('API call failed after max retries');
    }

    private async callAI(): Promise<GenerateContentResponse> {
        const functionDeclarations: FunctionDeclaration[] = this.tools.map(t => ({
            name: t.name,
            description: t.description,
            parametersJsonSchema: {
                type: 'object',
                properties: Object.fromEntries(
                    Object.entries(t.parameters.properties || {}).map(([key, value]: [string, any]) => [
                        key,
                        {
                            type: value.type,
                            description: value.description,
                            ...(value.enum && { enum: value.enum })
                        }
                    ])
                ),
                required: t.parameters.required || []
            }
        }));

        const tools: SDKTool[] = [{ functionDeclarations }];

        const modelName = this.config.modelName || 'gemini-3-flash-preview';
        const thinkingLevel = this.getThinkingLevel(modelName);

        const response = await this.client.models.generateContent({
            model: modelName,
            contents: this.conversation,
            config: {
                systemInstruction: AGENT_SYSTEM_PROMPT,
                tools,
                thinkingConfig: {
                    thinkingLevel,
                },
            }
        });

        return response;
    }

    private parseResponse(response: GenerateContentResponse): {
        text: string;
        toolCalls: ToolCall[];
        functionResponseParts: Part[];
    } {
        const parts: Part[] = response.candidates?.[0]?.content?.parts || [];
        let text = '';
        const toolCalls: ToolCall[] = [];
        const functionResponseParts: Part[] = [];

        for (const part of parts) {
            if (part.text) {
                text += part.text;
            }

            if (part.functionCall) {
                toolCalls.push({
                    id: `call_${Date.now()}_${toolCalls.length}`,
                    name: part.functionCall.name || '',
                    arguments: part.functionCall.args || {}
                });

                functionResponseParts.push(part);
            }
        }

        return { text, toolCalls, functionResponseParts };
    }

    private async executeTools(toolCalls: ToolCall[]): Promise<{ name: string; result: string }[]> {
        const preparedCalls = toolCalls.map(call => {
            const tool = this.tools.find(t => t.name === call.name);

            // Enforce project path
            if (this.activeProjectPath) {
                if (call.arguments.cwd !== undefined) {
                    call.arguments.cwd = this.activeProjectPath;
                }
                if (call.arguments.projectPath !== undefined) {
                    call.arguments.projectPath = this.activeProjectPath;
                }
            }

            return { call, tool };
        });

        const promises = preparedCalls.map(async ({ call, tool }) => {
            if (!tool) {
                logger.warn(`Tool not found: ${call.name}`);
                return { name: call.name, result: `Error: Tool "${call.name}" not found` };
            }

            if (this.config.verbose) {
                logger.dim(`Tool: ${call.name}(${JSON.stringify(call.arguments)})`);
            } else {
                logger.info(`  → ${call.name}`);
            }

            try {
                const result = await tool.execute(call.arguments);

                if (this.config.verbose) {
                    const preview = result.length > 100 ? result.substring(0, 100) + '...' : result;
                    logger.dim(`  Result: ${preview}`);
                }

                return { name: call.name, result };
            } catch (error: any) {
                logger.error(`Tool ${call.name} failed: ${error.message}`);
                return { name: call.name, result: `Error: ${error.message}` };
            }
        });

        return await Promise.all(promises);
    }

    // ==================== Token Management ====================

    private isTokenLimitError(error: any): boolean {
        const msg = error.message?.toLowerCase() || '';
        return msg.includes('token') ||
            msg.includes('context length') ||
            msg.includes('too long') ||
            msg.includes('maximum context');
    }

    private updateTokenCount(response: GenerateContentResponse): void {
        const usage = response.usageMetadata;
        if (usage?.promptTokenCount) {
            this.lastTokenCount = usage.promptTokenCount;
            if (this.config.verbose) {
                logger.dim(`Input tokens: ${this.lastTokenCount.toLocaleString()} / ${MAX_CONTEXT_TOKENS.toLocaleString()}`);
            }
        }
    }

    private async checkAndCompressConversation(): Promise<void> {
        const threshold = MAX_CONTEXT_TOKENS * COMPRESSION_THRESHOLD;

        if (this.lastTokenCount > threshold) {
            logger.info(`Token usage ${this.lastTokenCount.toLocaleString()}/${MAX_CONTEXT_TOKENS.toLocaleString()} (${Math.round(this.lastTokenCount / MAX_CONTEXT_TOKENS * 100)}%), compressing...`);
            this.compressConversation();
        }
    }

    private compressConversation(): void {
        if (this.conversation.length <= KEEP_RECENT_MESSAGES + 1) {
            return; // Nothing to compress
        }

        // Keep first message (original task) and last N messages
        const firstMessage = this.conversation[0];
        const recentMessages = this.conversation.slice(-KEEP_RECENT_MESSAGES);

        this.conversation = [firstMessage, ...recentMessages];
        logger.dim(`Compressed conversation to ${this.conversation.length} messages`);
    }

    private async handleTokenLimitExceeded(): Promise<void> {
        if (!this.activeProjectPath) {
            this.compressConversation();
            return;
        }

        try {
            // Generate summary using Gemini
            logger.dim('Generating progress summary with Gemini...');
            const summary = await this.summarizer.generateSummary(this.conversation);

            // Save to file
            await this.summarizer.saveSummary(this.activeProjectPath, summary);

            // Restart with fresh conversation including summary
            this.conversation = [{
                role: 'user',
                parts: [{ text: `${this.originalTaskPrompt}\n\n## Previous Progress:\n${summary}\n\nContinue from where you left off.` }]
            }];

            logger.success('Conversation reset with AI-generated progress summary');
        } catch (error: any) {
            logger.error(`Failed to handle token limit: ${error.message}`);
            // Fallback: just compress aggressively
            this.compressConversation();
        }
    }
}
