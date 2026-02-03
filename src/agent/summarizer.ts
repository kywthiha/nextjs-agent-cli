import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI, Content } from '@google/genai';
import { logger } from '../utils/logger.js';

const SUMMARY_FILE = '.agent/summary.md';

const SUMMARY_PROMPT = `You are summarizing an AI agent's progress on a coding task.
Analyze the conversation and create a concise progress summary including:

1. **Completed Tasks**: What has been accomplished (files created, features implemented)
2. **Current State**: Where the project currently stands
3. **Next Steps**: What still needs to be done (if apparent)

Be concise but comprehensive. Format as markdown. Max 500 words.`;

export class ConversationSummarizer {
    private client: GoogleGenAI;
    private modelName: string;

    constructor(apiKey: string, modelName: string = 'gemini-3-pro-preview') {
        this.client = new GoogleGenAI({ apiKey });
        this.modelName = modelName;
    }

    async generateSummary(conversation: Content[]): Promise<string> {
        try {
            const conversationText = this.extractConversationText(conversation);

            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: [{
                    role: 'user',
                    parts: [{ text: `${SUMMARY_PROMPT}\n\n---\n\nConversation to summarize:\n\n${conversationText}` }]
                }]
            });

            const summary = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return summary || this.fallbackSummary(conversation);
        } catch (error: any) {
            logger.warn(`Gemini summary failed: ${error.message}, using fallback`);
            return this.fallbackSummary(conversation);
        }
    }

    private extractConversationText(conversation: Content[]): string {
        const parts: string[] = [];

        for (const msg of conversation) {
            const msgParts = msg.parts || [];
            for (const part of msgParts) {
                if (part.text) {
                    const text = part.text.length > 1000
                        ? part.text.substring(0, 1000) + '...'
                        : part.text;
                    parts.push(`[${msg.role}]: ${text}`);
                }
                if (part.functionCall) {
                    parts.push(`[tool]: ${part.functionCall.name}()`);
                }
            }
        }

        const joined = parts.join('\n\n');
        return joined.length > 15000 ? joined.substring(0, 15000) + '\n...(truncated)' : joined;
    }

    private fallbackSummary(conversation: Content[]): string {
        const toolCalls: string[] = [];

        for (const msg of conversation) {
            const msgParts = msg.parts || [];
            for (const part of msgParts) {
                if (part.functionCall) {
                    const name = part.functionCall.name || '';
                    if (['write_file', 'create_directory', 'exec_command'].includes(name)) {
                        const args = part.functionCall.args as Record<string, unknown>;
                        toolCalls.push(`- ${name}: ${args.path || args.command || 'completed'}`);
                    }
                }
            }
        }

        const uniqueItems = [...new Set(toolCalls)].slice(0, 30);
        return `## Progress Summary (fallback)\n\n${uniqueItems.join('\n')}`;
    }

    async saveSummary(projectPath: string, summary: string): Promise<void> {
        const summaryPath = path.join(projectPath, SUMMARY_FILE);
        const summaryDir = path.dirname(summaryPath);

        try {
            await fs.mkdir(summaryDir, { recursive: true });
            await fs.writeFile(summaryPath, summary, 'utf-8');
            logger.dim(`Saved progress summary to ${SUMMARY_FILE}`);
        } catch (error: any) {
            logger.warn(`Could not save summary: ${error.message}`);
        }
    }

    async loadSummary(projectPath: string): Promise<string | null> {
        const summaryPath = path.join(projectPath, SUMMARY_FILE);

        try {
            const content = await fs.readFile(summaryPath, 'utf-8');
            return content;
        } catch {
            return null;
        }
    }
}
