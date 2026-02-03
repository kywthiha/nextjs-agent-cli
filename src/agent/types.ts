/**
 * Core types for the AI Agent system
 */

/**
 * JSON Schema definition for tool parameters
 */
export interface JSONSchema {
    type: string;
    properties?: Record<string, {
        type: string;
        description: string;
        enum?: string[];
    }>;
    required?: string[];
    description?: string;
}

/**
 * Tool definition with schema and execution function
 */
export interface Tool {
    name: string;
    description: string;
    parameters: JSONSchema;
    execute: (input: Record<string, any>) => Promise<string>;
}

/**
 * A single message in the conversation
 */
export interface AgentMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCallId?: string;
    toolCalls?: ToolCall[];
}

/**
 * A tool call requested by the AI
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

/**
 * Result of executing a tool
 */
export interface ToolResult {
    toolCallId: string;
    result: string;
    isError: boolean;
}

/**
 * Thinking level for Gemini 3 models
 * - 'minimal': Minimal thinking (Flash only) - fastest, for simple tasks
 * - 'low': Light reasoning - fast responses
 * - 'medium': Balanced reasoning (Flash only) - good for most coding tasks
 * - 'high': Deep reasoning - best for complex coding/debugging
 */
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/**
 * Agent configuration
 */
export interface AgentConfig {
    geminiApiKey: string;
    maxIterations: number;
    verbose?: boolean;
    modelName?: string;
    /**
     * Thinking level for Gemini 3 models
     * - Pro: supports 'low', 'high' (default: 'high')
     * - Flash: supports 'minimal', 'low', 'medium', 'high' (default: 'high')
     */
    thinkingLevel?: ThinkingLevel;
}

/**
 * Task input for the agent
 */
export interface AgentTask {
    prompt: string;
    projectPath: string;
    databaseUrl?: string;
}
