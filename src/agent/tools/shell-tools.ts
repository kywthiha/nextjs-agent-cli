/**
 * Shell tools for the AI Agent
 * Safe shell execution with command validation
 */

import { Tool } from '../types.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Dangerous commands and patterns that should be blocked
 */
const DANGEROUS_PATTERNS = [
    /rm\s+(-rf?|--recursive)\s+[\/\\]/, // rm -rf /
    /rm\s+(-rf?|--recursive)\s+~/, // rm -rf ~
    /rm\s+(-rf?|--recursive)\s+\*/, // rm -rf *
    /del\s+\/[sf]\s+[a-z]:\\/i, // Windows: del /s C:\
    /format\s+[a-z]:/i, // Windows: format C:
    /mkfs\./i, // Linux filesystem format
    /dd\s+if=.*of=\/dev/i, // dd to device
    />\s*\/dev\/sd[a-z]/i, // Write to disk device
    /chmod\s+777\s+\//i, // chmod 777 /
    /chown\s+-R.*\//i, // chown -R /
    /:\s*\(\)\s*\{\s*:\|:&\s*\}/, // Fork bomb
    /wget.*\|\s*(ba)?sh/i, // Download and execute
    /curl.*\|\s*(ba)?sh/i, // Download and execute
    /shutdown/i,
    /reboot/i,
    /init\s+0/,
    /halt/i,
    /poweroff/i,
];

/**
 * Commands that require extra caution but aren't blocked
 */
const CAUTION_PATTERNS = [
    /npm\s+publish/i,
    /git\s+push\s+--force/i,
    /git\s+push\s+-f/i,
    /DROP\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /TRUNCATE/i,
    /DELETE\s+FROM.*WHERE\s+1\s*=\s*1/i,
];

/**
 * Check if a command is safe to execute
 */
function validateCommand(command: string): { safe: boolean; reason?: string; caution?: string } {
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
            return {
                safe: false,
                reason: `Blocked: Command matches dangerous pattern. Pattern: ${pattern.toString()}`
            };
        }
    }

    // Check for caution patterns
    for (const pattern of CAUTION_PATTERNS) {
        if (pattern.test(command)) {
            return {
                safe: true,
                caution: `Warning: This command may have significant effects: ${pattern.toString()}`
            };
        }
    }

    return { safe: true };
}

/**
 * Tool: Execute Command
 * Safe shell execution with validation
 */
export const execCommandTool: Tool = {
    name: 'exec_command',
    description: `Execute a shell command safely.
Blocks dangerous commands (rm -rf /, format, etc.)
Captures stdout, stderr, and exit code.

Automatically uses the correct shell for the OS:
- Windows: PowerShell
- Unix: bash

Best for:
- Running build commands (npm, pnpm, yarn)
- Git operations
- File operations
- Development servers`,
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute'
            },
            cwd: {
                type: 'string',
                description: 'Working directory for the command'
            },
            timeout: {
                type: 'string',
                description: 'Timeout in seconds (default: 60, max: 300)'
            },
            background: {
                type: 'string',
                description: 'Run command in background (for servers)',
                enum: ['true', 'false']
            }
        },
        required: ['command']
    },
    execute: async (input) => {
        try {
            const command = input.command;
            const cwd = input.cwd || process.cwd();
            const timeoutSec = Math.min(parseInt(input.timeout || '60', 10), 300);
            const background = input.background === 'true';

            // Validate command
            const validation = validateCommand(command);
            if (!validation.safe) {
                return `Error: ${validation.reason}`;
            }

            // Check cwd exists
            try {
                await fs.access(cwd);
            } catch {
                return `Error: Working directory does not exist: ${cwd}`;
            }

            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            // Output any caution warnings
            let output = '';
            if (validation.caution) {
                output += `⚠️ ${validation.caution}\n\n`;
            }

            if (background) {
                // For background processes, use spawn and detach
                const args = process.platform === 'win32'
                    ? ['-Command', command]
                    : ['-c', command];

                const child = spawn(shell, args, {
                    cwd,
                    detached: true,
                    stdio: 'ignore'
                });

                child.unref();

                return output + `Started background process with PID: ${child.pid}\nCommand: ${command}\nWorking directory: ${cwd}`;
            }

            // Execute command
            try {
                const { stdout, stderr } = await execAsync(command, {
                    cwd,
                    shell,
                    timeout: timeoutSec * 1000,
                    maxBuffer: 10 * 1024 * 1024, // 10MB
                    encoding: 'utf-8'
                });

                output += `Command: ${command}\n`;
                output += `Working directory: ${cwd}\n`;
                output += `Exit code: 0\n\n`;

                if (stdout) {
                    const lines = stdout.split('\n');
                    if (lines.length > 100) {
                        output += `--- STDOUT (${lines.length} lines, showing last 100) ---\n`;
                        output += lines.slice(-100).join('\n');
                    } else {
                        output += `--- STDOUT ---\n${stdout}`;
                    }
                }

                if (stderr) {
                    output += `\n--- STDERR ---\n${stderr}`;
                }

                if (!stdout && !stderr) {
                    output += '(no output)';
                }

                return output;

            } catch (error: any) {
                output += `Command: ${command}\n`;
                output += `Working directory: ${cwd}\n`;
                output += `Exit code: ${error.code || 'unknown'}\n\n`;

                if (error.stdout) {
                    output += `--- STDOUT ---\n${error.stdout}\n`;
                }
                if (error.stderr) {
                    output += `--- STDERR ---\n${error.stderr}\n`;
                }
                if (!error.stdout && !error.stderr) {
                    output += `Error: ${error.message}`;
                }

                return output;
            }

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Tool: Get Process Info
 * Check if a process is running
 */
export const processInfoTool: Tool = {
    name: 'process_info',
    description: `Get information about running processes.
Search by name or PID.

Useful for checking if servers are running.`,
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Process name to search for'
            },
            pid: {
                type: 'string',
                description: 'Process ID to check'
            }
        },
        required: []
    },
    execute: async (input) => {
        try {
            const name = input.name;
            const pid = input.pid;

            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            let command: string;
            if (process.platform === 'win32') {
                if (pid) {
                    command = `Get-Process -Id ${pid} | Format-List Name,Id,CPU,WorkingSet`;
                } else if (name) {
                    command = `Get-Process -Name *${name}* | Format-Table Name,Id,CPU,WorkingSet -AutoSize`;
                } else {
                    command = `Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 | Format-Table Name,Id,CPU,WorkingSet -AutoSize`;
                }
            } else {
                if (pid) {
                    command = `ps -p ${pid} -o pid,ppid,user,%cpu,%mem,command`;
                } else if (name) {
                    command = `ps aux | grep -i "${name}" | grep -v grep | head -20`;
                } else {
                    command = `ps aux --sort=-%cpu | head -11`;
                }
            }

            try {
                const { stdout } = await execAsync(command, { shell, timeout: 10000 });

                if (!stdout.trim()) {
                    return 'No matching processes found';
                }

                return `Process Information:\n${stdout}`;
            } catch {
                return 'No matching processes found';
            }

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Tool: Kill Process
 * Terminate a process by PID
 */
export const killProcessTool: Tool = {
    name: 'kill_process',
    description: `Terminate a process by PID.
Use with caution - only kill processes you started.`,
    parameters: {
        type: 'object',
        properties: {
            pid: {
                type: 'string',
                description: 'Process ID to terminate'
            },
            force: {
                type: 'string',
                description: 'Force kill (SIGKILL)',
                enum: ['true', 'false']
            }
        },
        required: ['pid']
    },
    execute: async (input) => {
        try {
            const pid = parseInt(input.pid, 10);
            const force = input.force === 'true';

            if (isNaN(pid)) {
                return 'Error: Invalid PID';
            }

            // Safety check - don't kill system processes
            if (pid <= 1) {
                return 'Error: Cannot kill system processes';
            }

            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            let command: string;
            if (process.platform === 'win32') {
                command = force
                    ? `Stop-Process -Id ${pid} -Force`
                    : `Stop-Process -Id ${pid}`;
            } else {
                command = force
                    ? `kill -9 ${pid}`
                    : `kill ${pid}`;
            }

            try {
                await execAsync(command, { shell, timeout: 5000 });
                return `Process ${pid} terminated successfully`;
            } catch (error: any) {
                return `Error terminating process: ${error.message}`;
            }

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Get all shell tools
 */
export function getShellTools(): Tool[] {
    return [
        execCommandTool,
        processInfoTool,
        killProcessTool,
    ];
}
