/**
 * Search tools for the AI Agent
 * Uses ripgrep for fast pattern search across codebase
 */

import { Tool } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Check if ripgrep is available
 */
async function hasRipgrep(): Promise<boolean> {
    try {
        await execAsync('rg --version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if fd is available (faster file finder)
 */
async function hasFd(): Promise<boolean> {
    try {
        await execAsync('fd --version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Tool: Ripgrep Search
 * Fast pattern search using ripgrep with context lines
 */
export const ripgrepSearchTool: Tool = {
    name: 'ripgrep_search',
    description: `Fast pattern search across codebase using ripgrep.
Returns matches with file path, line number, and context.

Output format:
FILE:LINE: content
FILE:LINE: content

Best for:
- Finding function/class definitions
- Searching for specific text patterns
- Finding usages of variables/imports`,
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Search pattern (supports regex)'
            },
            path: {
                type: 'string',
                description: 'Directory or file to search in'
            },
            fileType: {
                type: 'string',
                description: 'File type filter (e.g., "ts", "tsx", "js", "py")'
            },
            contextLines: {
                type: 'string',
                description: 'Number of context lines before/after match (default: 2)'
            },
            caseSensitive: {
                type: 'string',
                description: 'Case sensitive search',
                enum: ['true', 'false']
            },
            wholeWord: {
                type: 'string',
                description: 'Match whole words only',
                enum: ['true', 'false']
            },
            maxResults: {
                type: 'string',
                description: 'Maximum number of results (default: 50)'
            }
        },
        required: ['pattern', 'path']
    },
    execute: async (input) => {
        try {
            const searchPath = input.path;
            const pattern = input.pattern;
            const fileType = input.fileType;
            const contextLines = parseInt(input.contextLines || '2', 10);
            const caseSensitive = input.caseSensitive === 'true';
            const wholeWord = input.wholeWord === 'true';
            const maxResults = parseInt(input.maxResults || '50', 10);

            // Check if path exists
            try {
                await fs.access(searchPath);
            } catch {
                return `Error: Path does not exist: ${searchPath}`;
            }

            // Check if ripgrep is available
            if (!(await hasRipgrep())) {
                return `Error: ripgrep (rg) is not installed.
Install it:
- Windows: winget install BurntSushi.ripgrep.MSVC
- Mac: brew install ripgrep
- Linux: apt install ripgrep`;
            }

            // Build ripgrep command
            const args: string[] = [
                '--line-number',      // Show line numbers
                '--no-heading',       // Don't group by file
                '--color=never',      // No color codes
                `--context=${contextLines}`,
                `--max-count=${maxResults}`,
            ];

            // File type filter
            if (fileType) {
                args.push(`--type-add=custom:*.${fileType}`);
                args.push('--type=custom');
            }

            // Case sensitivity
            if (!caseSensitive) {
                args.push('--ignore-case');
            }

            // Whole word
            if (wholeWord) {
                args.push('--word-regexp');
            }

            // Exclude common directories
            args.push('--glob=!node_modules');
            args.push('--glob=!.git');
            args.push('--glob=!dist');
            args.push('--glob=!.next');
            args.push('--glob=!build');
            args.push('--glob=!*.lock');

            // Escape pattern for shell
            const escapedPattern = pattern.replace(/"/g, '\\"');
            const command = `rg ${args.join(' ')} "${escapedPattern}" "${searchPath}"`;

            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            const { stdout, stderr } = await execAsync(command, {
                shell,
                maxBuffer: 10 * 1024 * 1024, // 10MB
                timeout: 30000
            });

            if (!stdout.trim()) {
                return `No matches found for "${pattern}" in ${searchPath}`;
            }

            // Format output
            const lines = stdout.trim().split('\n');
            const output: string[] = [];
            output.push(`Found ${lines.filter(l => !l.startsWith('--')).length} matches for "${pattern}"\n`);

            // Group by file for cleaner output
            let currentFile = '';
            for (const line of lines.slice(0, maxResults * 3)) { // Account for context lines
                if (line.startsWith('--')) {
                    output.push('---');
                    continue;
                }

                const match = line.match(/^(.+?):(\d+)[:-](.*)$/);
                if (match) {
                    const [, file, lineNum, content] = match;
                    const relPath = path.relative(searchPath, file);

                    if (file !== currentFile) {
                        currentFile = file;
                        output.push(`\n=== ${relPath} ===`);
                    }

                    output.push(`L${lineNum}: ${content}`);
                }
            }

            return output.join('\n');

        } catch (error: any) {
            // ripgrep returns exit code 1 when no matches found
            if (error.code === 1 && !error.stderr) {
                return `No matches found for "${input.pattern}"`;
            }
            return `Search error: ${error.message}`;
        }
    }
};

/**
 * Tool: Find Files
 * Find files by name pattern using fd or fallback
 */
export const findFilesTool: Tool = {
    name: 'find_files',
    description: `Find files by name pattern.
Uses fd for speed if available, falls back to filesystem walk.

Output: List of matching file paths`,
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'File name pattern (supports glob)'
            },
            path: {
                type: 'string',
                description: 'Directory to search in'
            },
            type: {
                type: 'string',
                description: 'Filter by type',
                enum: ['file', 'directory', 'all']
            },
            maxDepth: {
                type: 'string',
                description: 'Maximum directory depth (default: 10)'
            },
            extension: {
                type: 'string',
                description: 'Filter by file extension (e.g., "ts")'
            }
        },
        required: ['pattern', 'path']
    },
    execute: async (input) => {
        try {
            const searchPath = input.path;
            const pattern = input.pattern;
            const fileType = input.type || 'all';
            const maxDepth = parseInt(input.maxDepth || '10', 10);
            const extension = input.extension;

            // Check if path exists
            try {
                await fs.access(searchPath);
            } catch {
                return `Error: Path does not exist: ${searchPath}`;
            }

            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            // Try fd first (faster)
            if (await hasFd()) {
                const args: string[] = [
                    '--max-depth', maxDepth.toString(),
                    '--hidden',
                    '--no-ignore-vcs',
                    '--exclude', 'node_modules',
                    '--exclude', '.git',
                    '--exclude', 'dist',
                    '--exclude', '.next',
                ];

                if (fileType === 'file') args.push('--type', 'f');
                if (fileType === 'directory') args.push('--type', 'd');
                if (extension) args.push('--extension', extension);

                const command = `fd ${args.join(' ')} "${pattern}" "${searchPath}"`;

                try {
                    const { stdout } = await execAsync(command, { shell, timeout: 30000 });
                    const files = stdout.trim().split('\n').filter(f => f);

                    if (files.length === 0) {
                        return `No files found matching "${pattern}"`;
                    }

                    return `Found ${files.length} files:\n${files.map(f => path.relative(searchPath, f)).join('\n')}`;
                } catch (error: any) {
                    if (error.code === 1) {
                        return `No files found matching "${pattern}"`;
                    }
                }
            }

            // Fallback: manual filesystem walk
            const results: string[] = [];
            const patternLower = pattern.toLowerCase();

            const walk = async (dir: string, depth: number) => {
                if (depth > maxDepth) return;

                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });

                    for (const entry of entries) {
                        if (entry.name === 'node_modules' ||
                            entry.name === '.git' ||
                            entry.name === 'dist' ||
                            entry.name === '.next') {
                            continue;
                        }

                        const fullPath = path.join(dir, entry.name);
                        const matchesPattern = entry.name.toLowerCase().includes(patternLower);
                        const matchesExt = !extension || entry.name.endsWith(`.${extension}`);

                        if (entry.isDirectory()) {
                            if (fileType !== 'file' && matchesPattern) {
                                results.push(path.relative(searchPath, fullPath));
                            }
                            await walk(fullPath, depth + 1);
                        } else if (fileType !== 'directory' && matchesPattern && matchesExt) {
                            results.push(path.relative(searchPath, fullPath));
                        }
                    }
                } catch {
                    // Skip unreadable directories
                }
            };

            await walk(searchPath, 0);

            if (results.length === 0) {
                return `No files found matching "${pattern}"`;
            }

            return `Found ${results.length} files:\n${results.slice(0, 100).join('\n')}${results.length > 100 ? `\n... and ${results.length - 100} more` : ''}`;

        } catch (error: any) {
            return `Error finding files: ${error.message}`;
        }
    }
};

/**
 * Tool: Grep in File
 * Search within a specific file with line numbers
 */
export const grepInFileTool: Tool = {
    name: 'grep_in_file',
    description: `Search for a pattern within a specific file.
Returns matching lines with line numbers.

Use this when you know the file and want to find specific content.`,
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Pattern to search for'
            },
            filePath: {
                type: 'string',
                description: 'Path to the file to search'
            },
            contextLines: {
                type: 'string',
                description: 'Lines of context (default: 2)'
            }
        },
        required: ['pattern', 'filePath']
    },
    execute: async (input) => {
        try {
            const filePath = input.filePath;
            const pattern = input.pattern.toLowerCase();
            const contextLines = parseInt(input.contextLines || '2', 10);

            // Read file
            let content: string;
            try {
                content = await fs.readFile(filePath, 'utf-8');
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return `Error: File not found: ${filePath}`;
                }
                return `Error reading file: ${error.message}`;
            }

            const lines = content.split('\n');
            const matches: { lineNum: number; content: string; isMatch: boolean }[] = [];
            const matchedLineNums: Set<number> = new Set();

            // Find matching lines
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes(pattern)) {
                    matchedLineNums.add(idx);
                    // Add context lines
                    for (let i = Math.max(0, idx - contextLines); i <= Math.min(lines.length - 1, idx + contextLines); i++) {
                        if (!matchedLineNums.has(i) || i === idx) {
                            matchedLineNums.add(i);
                        }
                    }
                }
            });

            if (matchedLineNums.size === 0) {
                return `No matches found for "${input.pattern}" in ${path.basename(filePath)}`;
            }

            // Build output
            const output: string[] = [];
            output.push(`Found matches in ${path.basename(filePath)}:\n`);

            const sortedNums = Array.from(matchedLineNums).sort((a, b) => a - b);
            let lastNum = -2;

            for (const num of sortedNums) {
                if (num > lastNum + 1) {
                    output.push('---');
                }
                const isMatch = lines[num].toLowerCase().includes(pattern);
                const prefix = isMatch ? '>' : ' ';
                output.push(`${prefix} L${num + 1}: ${lines[num]}`);
                lastNum = num;
            }

            return output.join('\n');

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Get all search tools
 */
export function getSearchTools(): Tool[] {
    return [
        ripgrepSearchTool,
        findFilesTool,
        grepInFileTool,
    ];
}
