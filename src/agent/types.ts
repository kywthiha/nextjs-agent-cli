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
 * Agent configuration
 */
export interface AgentConfig {
    geminiApiKey: string;
    maxIterations: number;
    verbose?: boolean;
    modelName?: string;
}

/**
 * Task input for the agent
 */
export interface AgentTask {
    prompt: string;
    projectPath: string;
    databaseUrl?: string;
}
