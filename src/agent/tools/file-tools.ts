/**
 * File system tools for the AI Agent
 */

import fs from 'fs/promises';
import path from 'path';
import { Tool } from '../types.js';

/**
 * Tool: Read file contents
 */
export const readFileTool: Tool = {
    name: 'read_file',
    description: 'Read the contents of a file at the specified path. Use this to understand existing code before modifying.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file path to read'
            }
        },
        required: ['path']
    },
    execute: async (input) => {
        try {
            const content = await fs.readFile(input.path, 'utf-8');
            return content;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return `Error: File not found: ${input.path}`;
            }
            return `Error reading file: ${error.message}`;
        }
    }
};

/**
 * Tool: Write file contents
 */
export const writeFileTool: Tool = {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist, or overwrites it if it does. Also creates parent directories if needed. ALWAYS write complete file content.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file path to write to'
            },
            content: {
                type: 'string',
                description: 'The COMPLETE content to write to the file'
            }
        },
        required: ['path', 'content']
    },
    execute: async (input) => {
        try {
            // Ensure parent directory exists
            const dir = path.dirname(input.path);
            await fs.mkdir(dir, { recursive: true });

            await fs.writeFile(input.path, input.content, 'utf-8');
            return `Successfully wrote ${input.content.length} characters to ${input.path}`;
        } catch (error: any) {
            return `Error writing file: ${error.message}`;
        }
    }
};

/**
 * Tool: List files in directory
 */
export const listFilesTool: Tool = {
    name: 'list_files',
    description: 'List all files and directories at the specified path. Returns a JSON array of file/directory names.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The directory path to list'
            },
            recursive: {
                type: 'string',
                description: 'Set to "true" to list files recursively (default: false)',
                enum: ['true', 'false']
            }
        },
        required: ['path']
    },
    execute: async (input) => {
        try {
            const targetPath = input.path;
            const recursive = input.recursive === 'true';

            const stat = await fs.stat(targetPath).catch(() => null);
            if (!stat) {
                return `Directory does not exist: ${targetPath}`;
            }

            if (!stat.isDirectory()) {
                return `Not a directory: ${targetPath}`;
            }

            if (recursive) {
                const files: string[] = [];
                const walk = async (dir: string) => {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        // Skip node_modules and hidden directories
                        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                            continue;
                        }
                        const fullPath = path.join(dir, entry.name);
                        const relativePath = path.relative(targetPath, fullPath);
                        if (entry.isDirectory()) {
                            files.push(relativePath + '/');
                            await walk(fullPath);
                        } else {
                            files.push(relativePath);
                        }
                    }
                };
                await walk(targetPath);
                return JSON.stringify(files, null, 2);
            } else {
                const entries = await fs.readdir(targetPath, { withFileTypes: true });
                const files = entries
                    .filter(e => !e.name.startsWith('.'))
                    .map(e => e.isDirectory() ? e.name + '/' : e.name);
                return JSON.stringify(files, null, 2);
            }
        } catch (error: any) {
            return `Error listing files: ${error.message}`;
        }
    }
};

/**
 * Tool: Create directory
 */
export const createDirectoryTool: Tool = {
    name: 'create_directory',
    description: 'Create a directory at the specified path. Creates parent directories if needed.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The directory path to create'
            }
        },
        required: ['path']
    },
    execute: async (input) => {
        try {
            await fs.mkdir(input.path, { recursive: true });
            return `Successfully created directory: ${input.path}`;
        } catch (error: any) {
            return `Error creating directory: ${error.message}`;
        }
    }
};

/**
 * Tool: Check if file exists
 */
export const fileExistsTool: Tool = {
    name: 'file_exists',
    description: 'Check if a file or directory exists at the specified path.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file or directory path to check'
            }
        },
        required: ['path']
    },
    execute: async (input) => {
        try {
            const stat = await fs.stat(input.path);
            return `Exists: ${stat.isDirectory() ? 'directory' : 'file'}`;
        } catch {
            return 'Does not exist';
        }
    }
};


/**
 * Get all file tools
 */
export function getFileTools(): Tool[] {
    return [
        readFileTool,
        writeFileTool,
        listFilesTool,
        createDirectoryTool,
        fileExistsTool,
    ];
}
