/**
 * Core AI Agent - Autonomous Figma to React converter
 * 
 * This agent uses an agentic loop pattern:
 * 1. Send task + tools to AI
 * 2. AI responds with tool calls or text
 * 3. Execute tools, return results
 * 4. Repeat until AI indicates completion
 */

import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { Tool, AgentConfig, AgentTask, ToolCall } from './types.js';
import { AGENT_SYSTEM_PROMPT, createTaskPrompt } from './prompts/agent-prompt.js';
import { getAllTools } from './tools/index.js';

interface ConversationMessage {
    role: 'user' | 'model';
    parts: Part[];
}

interface Part {
    text?: string;
    functionCall?: {
        name: string;
        args: Record<string, any>;
    };
    thoughtSignature?: string;
    functionResponse?: {
        name: string;
        response: {
            result: string;
        };
    };
}

// Retry configuration
const MAX_API_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class Agent {
    private client: GoogleGenAI;
    private config: AgentConfig;
    private tools: Tool[];
    private conversation: ConversationMessage[] = [];
    private customRules: string = '';
    private activeProjectPath: string | null = null;
    private isInitialized: boolean = false;

    constructor(config: AgentConfig) {
        this.config = config;
        this.client = new GoogleGenAI({ apiKey: config.geminiApiKey });

        // Get all available tools
        this.tools = getAllTools();

        if (config.verbose) {
            logger.info(`Agent initialized with ${this.tools.length} tools`);
        }
    }

    /**
     * Initialize the agent (async setup)
     */
    public async init(): Promise<void> {
        if (this.isInitialized) return;

        // Load custom rules
        await this.loadCustomRules();
        this.isInitialized = true;
    }

    /**
     * Load custom coding rules from rules/*.md
     */
    private async loadCustomRules(): Promise<void> {
        try {
            const rulesDir = path.join(process.cwd(), 'rules');

            // Check if directory exists
            try {
                await fs.access(rulesDir);
            } catch {
                return; // No rules directory, skip
            }

            const files = await fs.readdir(rulesDir);
            const mdFiles = files.filter(f => f.endsWith('.md'));

            if (mdFiles.length > 0) {
                logger.info(`Found ${mdFiles.length} custom rule file(s)`);

                let rulesContent = '\n\n# User-Defined Coding Rules\n';

                for (const file of mdFiles) {
                    const content = await fs.readFile(path.join(rulesDir, file), 'utf-8');
                    rulesContent += `\n## Rule Set: ${file}\n${content}\n`;
                }

                this.customRules = rulesContent;
                logger.info('Custom rules loaded successfully');
            }
        } catch (error: any) {
            logger.warn(`Error loading custom rules: ${error.message}`);
        }
    }

    /**
     * Start a new agent session
     */
    async start(task: AgentTask): Promise<void> {
        if (!this.isInitialized) await this.init();

        const { prompt, projectPath } = task;
        this.activeProjectPath = projectPath;

        logger.step('Starting Full Stack Agent');
        logger.info(`Goal: ${prompt}`);
        logger.info(`Output: ${projectPath}`);

        // Phase 1: Planning
        logger.step('Phase 1: Planning & Setup');

        // Initial setup prompt
        const setupPrompt = createTaskPrompt(prompt, projectPath);

        this.conversation = [{
            role: 'user',
            parts: [{ text: setupPrompt }]
        }];

        await this.executeTaskLoop('Planning-Phase');

        logger.step('Agent session ended - Implementation Complete');
    }

    /**
     * Continue the conversation with a new user message
     */
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

    /**
     * Execute the agent loop for a single task/node
     */
    private async executeTaskLoop(contextId: string): Promise<void> {
        let iteration = 0;
        let isComplete = false;

        // Reset iteration count for each node to ensure full effort
        const maxIterations = this.config.maxIterations;

        while (!isComplete && iteration < maxIterations) {
            iteration++;
            logger.step(`[${contextId}] Iteration ${iteration}/${maxIterations}`);

            try {
                // Call AI with tools (with retry logic)
                const response = await this.callAIWithRetry();

                // Process response
                const { text, toolCalls, functionResponseParts } = this.parseResponse(response);

                // Log AI text response
                if (text) {
                    logger.dim('AI: ' + text.substring(0, 200) + (text.length > 200 ? '...' : ''));

                    // Check for completion signal
                    if (text.includes('TASK COMPLETE')) {
                        logger.success(`[${contextId}] Task Complete!`);
                        isComplete = true;
                        continue;
                    }
                }

                // If no tool calls, we might be done or stuck
                if (toolCalls.length === 0) {
                    if (!text) {
                        logger.warn('No response from AI, retrying...');
                        continue;
                    }
                    // AI just responded with text, ask it to continue
                    this.conversation.push({
                        role: 'user',
                        parts: [{ text: 'Continue with the task. Use tools as needed.' }]
                    });
                    continue;
                }

                // Execute tool calls
                logger.info(`Executing ${toolCalls.length} tool(s)...`);
                const toolResults = await this.executeTools(toolCalls);

                // Add tool results to conversation
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

                // Add error to conversation so AI can recover
                this.conversation.push({
                    role: 'user',
                    parts: [{ text: `Error occurred: ${error.message}. Please try a different approach.` }]
                });
            }
        }

        if (!isComplete) {
            logger.warn(`[${contextId}] Reached max iterations (${maxIterations}) without completion signal`);
        }
    }

    /**
     * Call the AI with retry logic for transient errors (503, rate limits, etc.)
     */
    private async callAIWithRetry(): Promise<any> {
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
                    logger.warn(`API error (attempt ${attempt}/${MAX_API_RETRIES}), retrying in ${delayMs / 1000}s...`);
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

    /**
     * Call the AI with current conversation and tools
     */
    private async callAI(): Promise<any> {
        // Convert tools to Gemini function declarations
        const tools = [{
            functionDeclarations: this.tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: {
                    type: Type.OBJECT,
                    properties: Object.fromEntries(
                        Object.entries(t.parameters.properties || {}).map(([key, value]: [string, any]) => [
                            key,
                            {
                                type: value.type.toUpperCase(),
                                description: value.description
                            }
                        ])
                    ),
                    required: t.parameters.required || []
                }
            }))
        }];

        const systemWithRules = AGENT_SYSTEM_PROMPT + this.customRules;

        const response = await this.client.models.generateContent({
            model: this.config.modelName || 'gemini-3-flash-preview',
            contents: this.conversation as any,
            config: {
                systemInstruction: systemWithRules,
                tools: tools as any
            }
        });

        return response;
    }

    /**
     * Parse AI response for text and tool calls
     */
    private parseResponse(response: any): {
        text: string;
        toolCalls: ToolCall[];
        functionResponseParts: Part[];
    } {
        const parts = response.candidates?.[0]?.content?.parts || [];
        let text = '';
        const toolCalls: ToolCall[] = [];
        const functionResponseParts: Part[] = [];

        for (const part of parts) {
            if (part.text) {
                text += part.text;
            }

            if (part.functionCall) {
                const fcPart: Part = {
                    functionCall: {
                        name: part.functionCall.name,
                        args: part.functionCall.args || {}
                    }
                };

                const signature = (part as any).thoughtSignature || (part as any).thought_signature;
                if (signature) {
                    fcPart.thoughtSignature = signature;
                }

                toolCalls.push({
                    id: `call_${Date.now()}_${toolCalls.length}`,
                    name: part.functionCall.name,
                    arguments: part.functionCall.args || {}
                });

                functionResponseParts.push(fcPart);
            }
        }

        return { text, toolCalls, functionResponseParts };
    }

    /**
     * Execute tool calls and return results
     */
    private async executeTools(toolCalls: ToolCall[]): Promise<{ name: string; result: string }[]> {
        const results: { name: string; result: string }[] = [];

        for (const call of toolCalls) {
            const tool = this.tools.find(t => t.name === call.name);

            if (!tool) {
                logger.warn(`Tool not found: ${call.name}`);
                results.push({
                    name: call.name,
                    result: `Error: Tool "${call.name}" not found`
                });
                continue;
            }

            if (this.config.verbose) {
                logger.dim(`Tool: ${call.name}(${JSON.stringify(call.arguments)})`);
            } else {
                logger.info(`  → ${call.name}`);
            }

            // CRITICAL CHECK: Enforce strict project path if active
            if (this.activeProjectPath) {
                // Force 'cwd' to be the active project path
                if (call.arguments.cwd !== undefined) {
                    call.arguments.cwd = this.activeProjectPath;
                }
                // Force 'projectPath' to be the active project path
                if (call.arguments.projectPath !== undefined) {
                    call.arguments.projectPath = this.activeProjectPath;
                }
            }

            try {
                const result = await tool.execute(call.arguments);
                results.push({
                    name: call.name,
                    result: result
                });

                if (this.config.verbose) {
                    const preview = result.length > 100
                        ? result.substring(0, 100) + '...'
                        : result;
                    logger.dim(`  Result: ${preview}`);
                }
            } catch (error: any) {
                logger.error(`Tool ${call.name} failed: ${error.message}`);
                results.push({
                    name: call.name,
                    result: `Error: ${error.message}`
                });
            }
        }

        return results;
    }
}
