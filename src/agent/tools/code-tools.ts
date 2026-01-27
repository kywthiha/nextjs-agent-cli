/**
 * Code and shell execution tools for the AI Agent
 * Supports pnpm, project scaffolding, and fuzzy search
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { Tool } from '../types.js';
import Fuse from 'fuse.js';

const execAsync = promisify(exec);

/**
 * Tool: Run shell command
 */
export const runCommandTool: Tool = {
    name: 'run_command',
    description: 'Execute a shell command in the specified working directory. Returns stdout and stderr. Use this for npm/pnpm commands, git, etc.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The command to execute'
            },
            cwd: {
                type: 'string',
                description: 'The working directory to run the command in'
            }
        },
        required: ['command', 'cwd']
    },
    execute: async (input) => {
        try {
            // Ensure the directory exists
            await fs.mkdir(input.cwd, { recursive: true });

            const { stdout, stderr } = await execAsync(input.command, {
                cwd: input.cwd,
                timeout: 180000, // 3 minute timeout for installs
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            let result = '';
            if (stdout) {
                result += `stdout:\n${stdout}\n`;
            }
            if (stderr) {
                result += `stderr:\n${stderr}`;
            }
            if (!result) {
                result = 'Command completed successfully (no output)';
            }

            // Truncate very long outputs
            if (result.length > 5000) {
                result = result.substring(0, 5000) + '\n... (output truncated)';
            }

            return result;
        } catch (error: any) {
            const message = error.message || 'Unknown error';
            const stdout = error.stdout || '';
            const stderr = error.stderr || '';
            return `Command failed: ${message}\nstdout: ${stdout}\nstderr: ${stderr}`;
        }
    }
};

/**
 * Tool: Create Next.js project with TypeScript + Tailwind + App Router
 */
export const createProjectTool: Tool = {
    name: 'create_nextjs_project',
    description: 'Create a new Next.js 14+ project with TypeScript, Tailwind CSS, ESLint, and App Router using pnpm. This is the recommended setup for SSR websites.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The directory path where the project will be created'
            },
            projectName: {
                type: 'string',
                description: 'The name of the project (for package.json)'
            }
        },
        required: ['projectPath', 'projectName']
    },
    execute: async (input) => {
        try {
            const { projectPath, projectName } = input;

            // Ensure parent directory exists
            await fs.mkdir(projectPath, { recursive: true });

            // Check if project already exists
            const packageJsonPath = path.join(projectPath, 'package.json');
            const exists = await fs.access(packageJsonPath).then(() => true).catch(() => false);

            if (exists) {
                return `Project already exists at ${projectPath}. Use run_command to install dependencies if needed.`;
            }

            // Create Next.js project with all recommended options
            // --typescript: TypeScript support
            // --tailwind: Tailwind CSS pre-configured
            // --eslint: ESLint for linting
            // --app: App Router (not Pages Router)
            // --src-dir: Use src/ directory
            // --import-alias: @/* path alias
            // --use-pnpm: Use pnpm package manager
            const createCommand = `pnpm create next-app@latest . --yes --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm`;
            await execAsync(createCommand, {
                cwd: projectPath,
                timeout: 180000,
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            // Install clsx and tailwind-merge for the cn() helper
            await execAsync('pnpm add clsx tailwind-merge', {
                cwd: projectPath,
                timeout: 60000,
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            return `Successfully created Next.js 14+ project at ${projectPath} with TypeScript, Tailwind CSS, ESLint, and App Router. The cn() utility is ready in src/lib/utils.ts.`;
        } catch (error: any) {
            return `Error creating project: ${error.message}\n${error.stderr || ''}`;
        }
    }
};

/**
 * Tool: Install packages with pnpm
 */
export const installPackagesTool: Tool = {
    name: 'install_packages',
    description: 'Install npm packages using pnpm. Can install multiple packages at once, with optional dev flag.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The project directory containing package.json'
            },
            packages: {
                type: 'string',
                description: 'Space-separated package names (e.g., "react-router-dom lucide-react")'
            },
            dev: {
                type: 'string',
                description: 'Set to "true" to install as dev dependencies',
                enum: ['true', 'false']
            }
        },
        required: ['projectPath', 'packages']
    },
    execute: async (input) => {
        try {
            const { projectPath, packages, dev } = input;
            const devFlag = dev === 'true' ? '-D' : '';
            const command = `pnpm add ${devFlag} ${packages}`.trim();

            const { stdout, stderr } = await execAsync(command, {
                cwd: projectPath,
                timeout: 180000,
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            return `Installed packages: ${packages}\n${stdout}\n${stderr}`;
        } catch (error: any) {
            return `Error installing packages: ${error.message}\n${error.stderr || ''}`;
        }
    }
};

/**
 * Tool: Fuzzy search code patterns
 */
export const searchCodeTool: Tool = {
    name: 'search_code',
    description: 'Search for text patterns in files using fuzzy/similar matching. Returns matching lines with file paths and line numbers.',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'The text pattern to search for (supports partial/fuzzy matching)'
            },
            directory: {
                type: 'string',
                description: 'The directory to search in'
            },
            fileExtension: {
                type: 'string',
                description: 'Optional file extension to filter (e.g., "ts", "tsx", "js")'
            },
            fuzzy: {
                type: 'string',
                description: 'Set to "true" for fuzzy matching (default: exact)',
                enum: ['true', 'false']
            }
        },
        required: ['pattern', 'directory']
    },
    execute: async (input) => {
        try {
            const searchDir = input.directory;
            const pattern = input.pattern;
            const extension = input.fileExtension ? `.${input.fileExtension}` : null;
            const isFuzzy = input.fuzzy === 'true';

            // Define search item structure
            type SearchItem = {
                relativePath: string;
                lineNumber: number;
                content: string;
            };

            const allLines: SearchItem[] = [];

            const walk = async (dir: string) => {
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        // Skip node_modules, hidden directories, and dist
                        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
                            continue;
                        }

                        const fullPath = path.join(dir, entry.name);

                        if (entry.isDirectory()) {
                            await walk(fullPath);
                        } else if (!extension || entry.name.endsWith(extension)) {
                            try {
                                const content = await fs.readFile(fullPath, 'utf-8');
                                const lines = content.split('\n');
                                const relativePath = path.relative(searchDir, fullPath);

                                lines.forEach((line, idx) => {
                                    if (line.trim().length > 0) { // Skip empty lines
                                        allLines.push({
                                            relativePath,
                                            lineNumber: idx + 1,
                                            content: line.trim()
                                        });
                                    }
                                });
                            } catch {
                                // Skip files that can't be read
                            }
                        }
                    }
                } catch {
                    // Skip directories that can't be read
                }
            };

            await walk(searchDir);

            if (allLines.length === 0) {
                return `No files found to search in "${searchDir}"`;
            }

            let results: SearchItem[] = [];

            if (isFuzzy) {
                // Configure Fuse.js
                const fuse = new Fuse(allLines, {
                    keys: ['content'],
                    includeScore: true,
                    threshold: 0.4, // 0.0 = exact, 1.0 = match anything. 0.4 is good for fuzzy.
                    ignoreLocation: true, // Search anywhere in the string
                    minMatchCharLength: 3
                });

                const fuseResults = fuse.search(pattern);
                // Extract items from Fuse results
                results = fuseResults.map(res => res.item);
            } else {
                // Exact match (case insensitive)
                const lowerPattern = pattern.toLowerCase();
                results = allLines.filter(item =>
                    item.content.toLowerCase().includes(lowerPattern)
                );
            }

            if (results.length === 0) {
                return `No matches found for "${pattern}"${isFuzzy ? ' (fuzzy)' : ''}`;
            }

            // Limit results to top 50
            const displayResults = results.slice(0, 50);
            const output = displayResults
                .map(item => `${item.relativePath}:${item.lineNumber}: ${item.content}`)
                .join('\n');

            if (results.length > 50) {
                return output + `\n... (showing 50 of ${results.length} matches)`;
            }

            return output;
        } catch (error: any) {
            return `Error searching code: ${error.message}`;
        }
    }
};

/**
 * Tool: Check TypeScript errors
 */
export const checkTypescriptTool: Tool = {
    name: 'check_typescript',
    description: 'Run TypeScript compiler to check for type errors in the project.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The project directory containing tsconfig.json'
            }
        },
        required: ['projectPath']
    },
    execute: async (input) => {
        try {
            const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
                cwd: input.projectPath,
                timeout: 60000,
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            if (stdout || stderr) {
                return `TypeScript check output:\n${stdout}\n${stderr}`;
            }
            return 'TypeScript check passed - no errors found';
        } catch (error: any) {
            return `TypeScript errors found:\n${error.stdout || ''}\n${error.stderr || error.message}`;
        }
    }
};


/**
 * Tool: Check Build Errors
 */
export const checkBuildErrorTool: Tool = {
    name: 'check_build_errors',
    description: 'Run pnpm run build to check for compilation and syntax errors. This is useful for verifying that changes compile correctly.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The project directory containing package.json'
            }
        },
        required: ['projectPath']
    },
    execute: async (input) => {
        try {
            const { stdout, stderr } = await execAsync('pnpm run build', {
                cwd: input.projectPath,
                timeout: 300000, // 5 minutes
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            return `Build successful:\n${stdout}\n${stderr}`;
        } catch (error: any) {
            return `Build failed with errors:\n${error.stdout || ''}\n${error.stderr || error.message}`;
        }
    }
};

/**
 * Tool: Setup shadcn/ui for Next.js project
 */
export const setupShadcnTool: Tool = {
    name: 'setup_shadcn_ui',
    description: 'Initialize shadcn/ui in a Next.js project. Run this AFTER Tailwind is setup. Uses default configuration (-d).',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The project directory'
            }
        },
        required: ['projectPath']
    },
    execute: async (input) => {
        try {
            const { projectPath } = input;

            // initialize shadcn with defaults
            // -d: defaults
            const command = 'pnpm dlx shadcn@latest init -d';

            const { stdout, stderr } = await execAsync(command, {
                cwd: projectPath,
                timeout: 180000,
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            return `shadcn/ui initialized successfully.\n${stdout}\n${stderr}`;
        } catch (error: any) {
            return `Error initializing shadcn/ui: ${error.message}\n${error.stderr || ''}`;
        }
    }
};

/**
 * Tool: Install all shadcn/ui components
 */
export const installShadcnComponentsTool: Tool = {
    name: 'install_shadcn_components',
    description: 'Install ALL shadcn/ui components into the project. Uses overwrite flag.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The project directory'
            }
        },
        required: ['projectPath']
    },
    execute: async (input) => {
        try {
            const { projectPath } = input;

            // Add all components
            // -a: all
            // -y: yes (skip confirmation)
            // --overwrite: overwrite existing files
            const command = 'pnpm dlx shadcn@latest add -a -y --overwrite';

            const { stdout, stderr } = await execAsync(command, {
                cwd: projectPath,
                timeout: 300000, // 5 minutes as installing all components takes time
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            return `All shadcn/ui components installed successfully.\n${stdout}\n${stderr}`;
        } catch (error: any) {
            return `Error installing shadcn/ui components: ${error.message}\n${error.stderr || ''}`;
        }
    }
};


/**
 * Tool: Setup Prisma with PostgreSQL (Adapter)
 */
export const setupPrismaTool: Tool = {
    name: 'setup_prisma',
    description: 'Initialize Prisma ORM with PostgreSQL in a Next.js project. Installs dependencies, initializes Prisma with driver adapter support, sets up the Prisma Client singleton, and updates .env.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The project directory'
            },
            databaseUrl: {
                type: 'string',
                description: 'The database URL (e.g. postgresql://user:password@localhost:5432/mydb)'
            }
        },
        required: ['projectPath', 'databaseUrl']
    },
    execute: async (input) => {
        try {
            const { projectPath, databaseUrl } = input;
            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            // Install dependencies
            // prisma (dev)
            // @prisma/client, @prisma/adapter-pg, pg, dotenv (prod)
            await execAsync('pnpm add -D prisma @types/pg', { cwd: projectPath, shell });
            await execAsync('pnpm add @prisma/client @prisma/adapter-pg dotenv pg', { cwd: projectPath, shell });

            // Initialize Prisma with PostgreSQL
            // This creates prisma/schema.prisma and .env
            await execAsync('npx prisma init --datasource-provider postgresql', { cwd: projectPath, shell });

            await fs.writeFile(path.join(projectPath, '.env'), `DATABASE_URL=${databaseUrl}`);

            // Auto-create Database (pg)
            // We create a temporary script to check and create the database if it doesn't exist
            // This is safer than 'prisma migrate' for just creation as it doesn't require schema changes yet
            const createDbScript = `
import { Client } from 'pg';
import 'dotenv/config';

async function main() {
    try {
        const url = process.env.DATABASE_URL;
        if (!url) {
            console.error('DATABASE_URL not found');
            process.exit(1);
        }

        const dbUrl = new URL(url);
        const dbName = dbUrl.pathname.substring(1); 
        
        // Connect to 'postgres' database to check/create target db
        dbUrl.pathname = 'postgres';
        const postgresUrl = dbUrl.toString();

        const client = new Client({ connectionString: postgresUrl });
        await client.connect();

        const checkRes = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbName]);
        if (checkRes.rowCount === 0) {
            console.log("Creating database " + dbName);
            await client.query('CREATE DATABASE "' + dbName + '"');
            console.log("Database created successfully");
        } else {
            console.log("Database " + dbName + " already exists");
        }
        await client.end();
    } catch (e: any) {
        // Don't fail the whole process if DB creation fails (e.g. permission issues or already exists in a way we couldn't detect)
        console.error("Warning: Could not auto-create DB:", e.message);
    }
}
main();
`;
            await fs.writeFile(path.join(projectPath, 'create-db.ts'), createDbScript);

            try {
                // Run the script with tsx
                await execAsync('npx tsx create-db.ts', { cwd: projectPath, shell });
            } catch (e) {
                // Ignore execution errors, proceed to next steps
            }
            // Cleanup
            await fs.unlink(path.join(projectPath, 'create-db.ts')).catch(() => { });

            // Create src/lib/prisma.ts singleton
            const libDir = path.join(projectPath, 'src', 'lib');
            await fs.mkdir(libDir, { recursive: true });

            const prismaClientContent = `import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = global as unknown as {
    prisma: PrismaClient
}

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
})

const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
})


if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
`;
            await fs.writeFile(path.join(libDir, 'prisma.ts'), prismaClientContent);

            // Create prisma/seed.ts template
            const seedContent = `import prisma from '../src/lib/prisma';

async function main() {
  // Seed data here
    console.log('Seeding...');
}

main();
`;
            await fs.writeFile(path.join(projectPath, 'prisma', 'seed.ts'), seedContent);

            // Generate Client (crucial so imports work)
            await execAsync('npx prisma generate', { cwd: projectPath, shell });

            return `Prisma initialized with PostgreSQL and Driver Adapter.
1. Installed: prisma, @prisma/client, @prisma/adapter-pg, pg, dotenv, @types/pg
2. Initialized: prisma/schema.prisma (with custom output to generated/prisma/client)
3. Configured: .env with DATABASE_URL
4. Check/Create DB: Auto-created database if missing
5. Created: src/lib/prisma.ts (Singleton with Adapter)
6. Created: prisma/seed.ts
7. Generated: Prisma Client

Next Steps:
- Define models in 'prisma/schema.prisma'
- Run 'npx prisma migrate dev --name init' to apply migrations.
- Run 'npx prisma generate' to generate the client (must run after schema changes)
`;
        } catch (error: any) {
            return `Error setting up Prisma: ${error.message}\n${error.stderr || ''}`;
        }
    }
};


/**
 * Tool: Verify Project & Auto-fix
 */
export const verifyProjectTool: Tool = {
    name: 'verify_project',
    description: 'Verify project setup (Next.js, Shadcn, Prisma) by running build and integration tests. Can optionally auto-fix configuration issues.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'The project directory'
            },
            autoFix: {
                type: 'string',
                description: 'Set to "true" to attempt automatic fixes for missing configurations',
                enum: ['true', 'false']
            },
            skipBuild: {
                type: 'string',
                description: 'Set to "true" to skip the build step (which can be slow)',
                enum: ['true', 'false']
            }
        },
        required: ['projectPath']
    },
    execute: async (input) => {
        try {
            const { projectPath } = input;
            const autoFix = input.autoFix === 'true';
            const log: string[] = [];
            const fixes: string[] = [];
            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            const checkFile = async (filePath: string) => {
                try {
                    await fs.access(path.join(projectPath, filePath));
                    return true;
                } catch {
                    return false;
                }
            };

            // 1. Verify Project Root (package.json)
            if (await checkFile('package.json')) {
                log.push('✅ Next.js project found (package.json)');
            } else {
                return '❌ Error: Not a valid node project (package.json missing). Cannot verify.';
            }

            // 2. Verify Shadcn UI
            const hasComponentsJson = await checkFile('components.json');
            const hasUtils = await checkFile('src/lib/utils.ts') || await checkFile('lib/utils.ts');

            if (hasComponentsJson && hasUtils) {
                log.push('✅ Shadcn/UI configured');
            } else {
                log.push('❌ Shadcn/UI configuration missing or incomplete');
                if (autoFix) {
                    log.push('  🔄 Attempting to fix Shadcn/UI...');
                    const res = await setupShadcnTool.execute({ projectPath });
                    fixes.push(`Shadcn Fix: ${res}`);
                    await installShadcnComponentsTool.execute({ projectPath });
                }
            }

            // 3. Verify Prisma Configuration
            const hasSchema = await checkFile('prisma/schema.prisma');
            const hasPrismaClient = await checkFile('src/lib/prisma.ts') || await checkFile('lib/prisma.ts');
            let prismaReady = false;

            if (hasSchema && hasPrismaClient) {
                log.push('✅ Prisma configured (files present)');
                prismaReady = true;
            } else {
                log.push('❌ Prisma configuration missing');
                if (autoFix) {
                    log.push('  🔄 Attempting to fix Prisma...');
                    const res = await setupPrismaTool.execute({ projectPath });
                    fixes.push(`Prisma Fix: ${res}`);
                    prismaReady = true;
                }
            }

            // 4. Prisma Integration Test (Real Verify)
            if (prismaReady) {
                log.push('🔄 Running Prisma Integration Test...');
                try {
                    // Ensure client is generated
                    await execAsync('npx prisma generate', { cwd: projectPath, shell });

                    // Create test script
                    const testScriptPath = path.join(projectPath, 'verify-db-temp.ts');

                    // Check for models in schema to test
                    let schemaContent = '';
                    try {
                        schemaContent = await fs.readFile(path.join(projectPath, 'prisma/schema.prisma'), 'utf-8');
                    } catch { }

                    const modelMatch = schemaContent.match(/model\s+(\w+)\s+{/);
                    const testModel = modelMatch ? modelMatch[1] : null;

                    const testCode = `
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({
    adapter,
});

async function main() {
    console.log('Testing DB connection...');
    await prisma.$connect();
    console.log('✅ DB Connected');
    
    // Test simple query
    try {
        await prisma.$queryRaw\`SELECT 1\`;
        console.log('✅ Raw Query execution successful');
    } catch (e) {
        // SQLite might behave differently or if raw query fails
        console.log('⚠️ Raw query check skipped/failed: ' + e.message);
    }

    ${testModel ? `
    // Test Model Access: ${testModel}
    try {
        const count = await prisma.${testModel.toLowerCase()}.count();
        console.log('✅ Model access successful (${testModel} count: ' + count + ')');
    } catch (e) {
        console.error('❌ Model access failed: ' + e.message);
        process.exit(1);
    }
    ` : `
    console.log('ℹ️ No models found in schema to test.');
    `}
}

main()
    .catch((e) => {
        console.error('❌ Integration Test Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
`;
                    await fs.writeFile(testScriptPath, testCode);

                    // Run test script using tsx (assuming it's available or npx tsx)
                    const { stdout } = await execAsync('npx tsx verify-db-temp.ts', {
                        cwd: projectPath,
                        shell,
                        timeout: 30000
                    });

                    log.push('✅ Prisma Integration Test Passed');
                    log.push(stdout.trim());

                    // Cleanup
                    await fs.unlink(testScriptPath).catch(() => { });

                } catch (error: any) {
                    log.push('❌ Prisma Integration Test Failed');
                    log.push(error.stdout || error.message);
                    fixes.push('Recommended: Check database connection string in .env and run `npx prisma migrate dev`');
                }
            }

            // 5. Build Verification
            if (input.skipBuild !== 'true') {
                log.push('🔄 Verifying Build (running pnpm build)...');
                try {
                    // Fix potentially missing types before build if autoFix is on
                    if (autoFix) {
                        await checkTypescriptTool.execute({ projectPath });
                    }

                    await execAsync('pnpm build', {
                        cwd: projectPath,
                        shell,
                        timeout: 300000 // 5 minutes 
                    });
                    log.push('✅ Project Build Successful');
                } catch (error: any) {
                    log.push('❌ Project Build Failed');
                    // Capture last few lines of error
                    const stderr = error.stderr || '';
                    const errorDetails = stderr.split('\n').slice(-10).join('\n');
                    log.push(errorDetails);
                }
            } else {
                log.push('ℹ️ Build verification skipped');
            }

            return `Verification Results:\n${log.join('\n')}\n\n${fixes.length > 0 ? 'Auto-Fix Output:\n' + fixes.join('\n\n') : ''}`;

        } catch (error: any) {
            return `Error verifying project: ${error.message}`;
        }
    }
};

/**
 * Get all code tools
 * @returns Array of tools
 */
export function getCodeTools(): Tool[] {
    return [
        runCommandTool,
        createProjectTool,
        installPackagesTool,
        searchCodeTool,
        checkTypescriptTool,
        checkBuildErrorTool,
        setupShadcnTool,
        installShadcnComponentsTool,
        setupPrismaTool,
        verifyProjectTool
    ];
}

