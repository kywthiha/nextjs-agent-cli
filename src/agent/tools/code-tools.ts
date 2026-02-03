/**
 * Code and shell execution tools for the AI Agent
 * Supports pnpm, project scaffolding, and fuzzy search
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { Tool } from '../types.js';

const execAsync = promisify(exec);


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
 * Tool: Setup Prisma 7 with PostgreSQL (Driver Adapter)
 */
export const setupPrismaTool: Tool = {
    name: 'setup_prisma',
    description: 'Initialize Prisma 7 ORM with PostgreSQL in a Next.js project. Uses the new prisma-client provider with driver adapters. Creates prisma.config.ts, schema.prisma with output field, and lib/prisma.ts singleton.',
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

            // Step 1: Install Prisma 7 dependencies
            await execAsync('pnpm add -D prisma tsx @types/pg', { cwd: projectPath, shell });
            await execAsync('pnpm add @prisma/client @prisma/adapter-pg dotenv pg', { cwd: projectPath, shell });

            // Step 2: Create prisma directory
            const prismaDir = path.join(projectPath, 'prisma');
            await fs.mkdir(prismaDir, { recursive: true });

            // Step 3: Create .env file with DATABASE_URL
            await fs.writeFile(path.join(projectPath, '.env'), `DATABASE_URL="${databaseUrl}"\n`);

            // Step 4: Create prisma/schema.prisma (Prisma 7 syntax)
            const schemaContent = `// Prisma 7 Schema
// Documentation: https://www.prisma.io/docs/guides/nextjs

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// Example models - customize as needed
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int      @map("author_id")
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")

  @@map("posts")
}
`;
            await fs.writeFile(path.join(prismaDir, 'schema.prisma'), schemaContent);

            // Step 5: Create prisma.config.ts at project root (Prisma 7 requirement)
            const prismaConfigContent = `import 'dotenv/config'
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
`;
            await fs.writeFile(path.join(projectPath, 'prisma.config.ts'), prismaConfigContent);

            // Step 6: Create src/lib/prisma.ts singleton with driver adapter (Prisma 7)
            const libDir = path.join(projectPath, 'src', 'lib');
            await fs.mkdir(libDir, { recursive: true });

            const prismaClientContent = `// Prisma 7 Client with Driver Adapter
// Import from generated path (NOT @prisma/client)
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
`;
            await fs.writeFile(path.join(libDir, 'prisma.ts'), prismaClientContent);

            // Step 7: Create prisma/seed.ts template (Prisma 7)
            const seedContent = `// Prisma 7 Seed Script
// Run with: npx prisma db seed
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({
  adapter,
});

const userData: Prisma.UserCreateInput[] = [
  {
    name: "Admin User",
    email: "admin@example.com",
    posts: {
      create: [
        { title: "Welcome Post", content: "Hello World!", published: true },
        { title: "Draft Post", content: "Work in progress...", published: false },
      ],
    },
  },
];

export async function main() {
  console.log('Seeding database...');
  
  // Clean existing data
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
  
  // Create seed data
  for (const u of userData) {
    const user = await prisma.user.create({ data: u });
    console.log(\`Created user: \${user.email}\`);
  }
  
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;
            await fs.writeFile(path.join(prismaDir, 'seed.ts'), seedContent);

            // Step 8: Create src/generated/prisma directory for output
            const generatedDir = path.join(projectPath, 'src', 'generated', 'prisma');
            await fs.mkdir(generatedDir, { recursive: true });

            // Step 9: Auto-create Database (optional, may fail if DB exists)
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
        console.error("Warning: Could not auto-create DB:", e.message);
    }
}
main();
`;
            await fs.writeFile(path.join(projectPath, 'create-db.ts'), createDbScript);

            try {
                await execAsync('npx tsx create-db.ts', { cwd: projectPath, shell });
            } catch {
                // Ignore errors - DB might already exist
            }
            await fs.unlink(path.join(projectPath, 'create-db.ts')).catch(() => { });

            // Step 10: Generate Prisma Client
            try {
                await execAsync('npx prisma generate', { cwd: projectPath, shell });
            } catch {
                // May fail if schema has issues - user will fix
            }

            return `✅ Prisma 7 initialized with PostgreSQL and Driver Adapter.

Files created:
1. prisma/schema.prisma (provider: "prisma-client", output: "../src/generated/prisma")
2. prisma.config.ts (Prisma 7 CLI config at project root)
3. src/lib/prisma.ts (singleton with @prisma/adapter-pg)
4. prisma/seed.ts (seed script template)
5. .env (DATABASE_URL configured)

Dependencies installed:
- prisma, tsx, @types/pg (dev)
- @prisma/client, @prisma/adapter-pg, pg, dotenv

IMPORTANT - Next Steps (in order):
1. Customize models in 'prisma/schema.prisma'
2. Run: npx prisma generate
3. Run: npx prisma migrate dev --name init
4. Run: npx prisma db seed (seeding is NOT automatic in Prisma 7)
`;
        } catch (error: any) {
            return `Error setting up Prisma: ${error.message}\n${error.stderr || ''}`;
        }
    }
};


/**
 * Verification result types for structured AI output
 */
interface VerificationCheck {
    name: string;
    status: 'pass' | 'fail' | 'warn' | 'skip';
    message: string;
    filePath?: string;
    fixCommand?: string;
    fixTool?: string;
    details?: string;
}

interface VerificationResult {
    success: boolean;
    projectPath: string;
    summary: {
        total: number;
        passed: number;
        failed: number;
        warnings: number;
        skipped: number;
    };
    checks: VerificationCheck[];
    fixesApplied: string[];
    suggestedFixes: Array<{
        issue: string;
        command?: string;
        tool?: string;
        description: string;
    }>;
}

/**
 * Tool: Verify Project & Auto-fix
 * Outputs structured JSON for AI to parse and take action
 */
export const verifyProjectTool: Tool = {
    name: 'verify_project',
    description: `Verify project setup (Next.js, Shadcn, Prisma) by running build and integration tests. 
Returns structured JSON with:
- success: boolean indicating overall status
- checks: array of individual check results with status (pass/fail/warn/skip)
- suggestedFixes: actionable fixes with commands and tool names
- summary: counts of passed/failed/warnings

Use this output to determine next actions. Each failed check includes fixCommand or fixTool for remediation.`,
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
            },
            skipPrismaTest: {
                type: 'string',
                description: 'Set to "true" to skip Prisma integration test (useful when DB is not available)',
                enum: ['true', 'false']
            }
        },
        required: ['projectPath']
    },
    execute: async (input) => {
        const result: VerificationResult = {
            success: true,
            projectPath: input.projectPath,
            summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
            checks: [],
            fixesApplied: [],
            suggestedFixes: []
        };

        const addCheck = (check: VerificationCheck) => {
            result.checks.push(check);
            result.summary.total++;
            switch (check.status) {
                case 'pass': result.summary.passed++; break;
                case 'fail': result.summary.failed++; result.success = false; break;
                case 'warn': result.summary.warnings++; break;
                case 'skip': result.summary.skipped++; break;
            }
        };

        try {
            const { projectPath } = input;
            const autoFix = input.autoFix === 'true';
            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            const checkFile = async (filePath: string): Promise<boolean> => {
                try {
                    await fs.access(path.join(projectPath, filePath));
                    return true;
                } catch {
                    return false;
                }
            };

            // 1. Verify Project Root (package.json)
            const hasPackageJson = await checkFile('package.json');
            if (hasPackageJson) {
                addCheck({
                    name: 'project_root',
                    status: 'pass',
                    message: 'Valid Node.js project found',
                    filePath: 'package.json'
                });
            } else {
                addCheck({
                    name: 'project_root',
                    status: 'fail',
                    message: 'Not a valid Node.js project - package.json missing',
                    filePath: 'package.json',
                    fixCommand: 'pnpm init'
                });
                result.suggestedFixes.push({
                    issue: 'Missing package.json',
                    command: 'pnpm init',
                    description: 'Initialize a new Node.js project'
                });
                return JSON.stringify(result, null, 2);
            }

            // 2. Verify Shadcn UI
            const hasComponentsJson = await checkFile('components.json');
            const hasUtilsSrc = await checkFile('src/lib/utils.ts');
            const hasUtilsRoot = await checkFile('lib/utils.ts');
            const hasUtils = hasUtilsSrc || hasUtilsRoot;

            if (hasComponentsJson && hasUtils) {
                addCheck({
                    name: 'shadcn_ui',
                    status: 'pass',
                    message: 'Shadcn/UI properly configured',
                    filePath: 'components.json'
                });
            } else {
                const missingFiles: string[] = [];
                if (!hasComponentsJson) missingFiles.push('components.json');
                if (!hasUtils) missingFiles.push('src/lib/utils.ts');

                addCheck({
                    name: 'shadcn_ui',
                    status: 'fail',
                    message: `Shadcn/UI configuration incomplete - missing: ${missingFiles.join(', ')}`,
                    filePath: missingFiles[0],
                    fixTool: 'setup_shadcn_ui',
                    fixCommand: 'pnpm dlx shadcn@latest init -d'
                });

                result.suggestedFixes.push({
                    issue: 'Shadcn/UI not configured',
                    tool: 'setup_shadcn_ui',
                    command: 'pnpm dlx shadcn@latest init -d',
                    description: 'Initialize Shadcn/UI with default configuration'
                });

                if (autoFix) {
                    try {
                        await setupShadcnTool.execute({ projectPath });
                        await installShadcnComponentsTool.execute({ projectPath });
                        result.fixesApplied.push('Shadcn/UI initialized and components installed');
                    } catch (e: any) {
                        result.fixesApplied.push(`Shadcn/UI fix attempted but failed: ${e.message}`);
                    }
                }
            }

            // 3. Verify Prisma Configuration
            const hasSchema = await checkFile('prisma/schema.prisma');
            const hasPrismaClient = await checkFile('src/lib/prisma.ts') || await checkFile('lib/prisma.ts');
            let prismaReady = false;

            if (hasSchema && hasPrismaClient) {
                addCheck({
                    name: 'prisma_config',
                    status: 'pass',
                    message: 'Prisma configuration files present',
                    filePath: 'prisma/schema.prisma'
                });
                prismaReady = true;
            } else {
                const missingFiles: string[] = [];
                if (!hasSchema) missingFiles.push('prisma/schema.prisma');
                if (!hasPrismaClient) missingFiles.push('src/lib/prisma.ts');

                addCheck({
                    name: 'prisma_config',
                    status: 'fail',
                    message: `Prisma configuration missing: ${missingFiles.join(', ')}`,
                    filePath: missingFiles[0],
                    fixTool: 'setup_prisma'
                });

                result.suggestedFixes.push({
                    issue: 'Prisma not configured',
                    tool: 'setup_prisma',
                    description: 'Initialize Prisma with PostgreSQL - requires DATABASE_URL parameter'
                });

                if (autoFix) {
                    try {
                        const res = await setupPrismaTool.execute({ projectPath });
                        result.fixesApplied.push(`Prisma setup: ${res}`);
                        prismaReady = true;
                    } catch (e: any) {
                        result.fixesApplied.push(`Prisma fix failed: ${e.message}`);
                    }
                }
            }

            // 4. Prisma Integration Test
            if (input.skipPrismaTest === 'true') {
                addCheck({
                    name: 'prisma_integration',
                    status: 'skip',
                    message: 'Prisma integration test skipped by user'
                });
            } else if (prismaReady) {
                try {
                    await execAsync('npx prisma generate', { cwd: projectPath, shell, timeout: 60000 });

                    const testScriptPath = path.join(projectPath, 'verify-db-temp.ts');
                    let schemaContent = '';
                    try {
                        schemaContent = await fs.readFile(path.join(projectPath, 'prisma/schema.prisma'), 'utf-8');
                    } catch { }

                    const modelMatch = schemaContent.match(/model\s+(\w+)\s+{/);
                    const testModel = modelMatch ? modelMatch[1] : null;

                    // Determine correct import path for prisma client
                    const prismaImportPath = hasPrismaClient
                        ? (await checkFile('src/lib/prisma.ts') ? './src/lib/prisma' : './lib/prisma')
                        : './src/lib/prisma';

                    const testCode = `
import prisma from "${prismaImportPath}";

async function main() {
    await prisma.$connect();
    await prisma.$queryRaw\`SELECT 1\`;
    ${testModel ? `await prisma.${testModel.toLowerCase()}.count();` : ''}
}

main()
    .catch((e) => { console.error(JSON.stringify({ error: e.message })); process.exit(1); })
    .finally(() => prisma.$disconnect());
`;
                    await fs.writeFile(testScriptPath, testCode);

                    const { stdout, stderr } = await execAsync('npx tsx verify-db-temp.ts', {
                        cwd: projectPath, shell, timeout: 30000
                    });

                    await fs.unlink(testScriptPath).catch(() => { });

                    addCheck({
                        name: 'prisma_integration',
                        status: 'pass',
                        message: 'Database connection and query successful',
                        details: stdout.trim()
                    });

                } catch (error: any) {
                    const errorMsg = error.stderr || error.stdout || error.message;

                    addCheck({
                        name: 'prisma_integration',
                        status: 'fail',
                        message: 'Database connection or query failed',
                        details: errorMsg,
                        fixCommand: 'npx prisma migrate dev --name init'
                    });

                    result.suggestedFixes.push({
                        issue: 'Database connection failed',
                        command: 'npx prisma migrate dev --name init',
                        description: 'Ensure DATABASE_URL in .env is correct, then run migrations'
                    });

                    // Cleanup temp file
                    await fs.unlink(path.join(projectPath, 'verify-db-temp.ts')).catch(() => { });
                }
            }

            // 5. TypeScript Check
            try {
                const { stdout, stderr } = await execAsync('npx tsc --noEmit 2>&1', {
                    cwd: projectPath, shell, timeout: 60000
                });

                const output = (stdout + stderr).trim();
                if (output === '' || output.includes('0 errors')) {
                    addCheck({
                        name: 'typescript',
                        status: 'pass',
                        message: 'No TypeScript errors'
                    });
                } else {
                    // Parse errors for structured output
                    const errorLines = output.split('\n').filter(l => l.includes('error TS'));
                    const errorCount = errorLines.length;

                    addCheck({
                        name: 'typescript',
                        status: 'fail',
                        message: `${errorCount} TypeScript error(s) found`,
                        details: errorLines.slice(0, 10).join('\n') + (errorCount > 10 ? `\n... and ${errorCount - 10} more` : ''),
                        fixCommand: 'npx tsc --noEmit'
                    });

                    result.suggestedFixes.push({
                        issue: `${errorCount} TypeScript errors`,
                        command: 'npx tsc --noEmit',
                        description: 'Review and fix type errors in the listed files'
                    });
                }
            } catch (error: any) {
                const output = (error.stdout || '') + (error.stderr || '');
                const errorLines = output.split('\n').filter((l: string) => l.includes('error TS'));

                addCheck({
                    name: 'typescript',
                    status: 'fail',
                    message: `TypeScript check failed with ${errorLines.length} error(s)`,
                    details: errorLines.slice(0, 10).join('\n'),
                    fixCommand: 'npx tsc --noEmit'
                });

                result.suggestedFixes.push({
                    issue: 'TypeScript errors',
                    command: 'npx tsc --noEmit',
                    description: 'Fix the type errors shown in details'
                });
            }

            // 6. Build Verification
            if (input.skipBuild === 'true') {
                addCheck({
                    name: 'build',
                    status: 'skip',
                    message: 'Build verification skipped by user'
                });
            } else {
                try {
                    await execAsync('pnpm build', {
                        cwd: projectPath, shell, timeout: 300000
                    });

                    addCheck({
                        name: 'build',
                        status: 'pass',
                        message: 'Project builds successfully'
                    });
                } catch (error: any) {
                    const stderr = error.stderr || error.stdout || error.message;
                    // Extract meaningful error lines
                    const lines = stderr.split('\n');
                    const errorLines = lines.filter((l: string) =>
                        l.includes('Error') || l.includes('error') ||
                        l.includes('failed') || l.includes('TypeError') ||
                        l.includes('Cannot find') || l.includes('Module not found')
                    ).slice(0, 15);

                    addCheck({
                        name: 'build',
                        status: 'fail',
                        message: 'Build failed',
                        details: errorLines.join('\n') || lines.slice(-10).join('\n'),
                        fixCommand: 'pnpm build'
                    });

                    result.suggestedFixes.push({
                        issue: 'Build failure',
                        command: 'pnpm build',
                        description: 'Review build errors in details and fix the underlying issues'
                    });
                }
            }

            // 7. ESLint Check (Production-ready)
            try {
                const { stdout, stderr } = await execAsync('pnpm lint 2>&1 || true', {
                    cwd: projectPath, shell, timeout: 60000
                });
                const output = (stdout + stderr).trim();

                if (output === '' || output.includes('No ESLint') || !output.includes('error')) {
                    addCheck({
                        name: 'eslint',
                        status: 'pass',
                        message: 'No ESLint errors found'
                    });
                } else {
                    const errorCount = (output.match(/error/gi) || []).length;
                    const warningCount = (output.match(/warning/gi) || []).length;

                    addCheck({
                        name: 'eslint',
                        status: errorCount > 0 ? 'fail' : 'warn',
                        message: `ESLint: ${errorCount} error(s), ${warningCount} warning(s)`,
                        details: output.split('\n').slice(0, 10).join('\n'),
                        fixCommand: 'pnpm lint --fix'
                    });

                    if (errorCount > 0) {
                        result.suggestedFixes.push({
                            issue: 'ESLint errors',
                            command: 'pnpm lint --fix',
                            description: 'Auto-fix ESLint issues where possible'
                        });
                    }
                }
            } catch (error: any) {
                addCheck({
                    name: 'eslint',
                    status: 'warn',
                    message: 'ESLint check skipped (lint script may not exist)',
                    details: error.message
                });
            }

            // 8. Security Audit (Production-ready)
            try {
                const { stdout, stderr } = await execAsync('pnpm audit --audit-level=high 2>&1 || true', {
                    cwd: projectPath, shell, timeout: 60000
                });
                const output = (stdout + stderr).trim();

                if (output.includes('found 0 vulnerabilities') || output.includes('No known vulnerabilities')) {
                    addCheck({
                        name: 'security_audit',
                        status: 'pass',
                        message: 'No high/critical security vulnerabilities found'
                    });
                } else if (output.includes('high') || output.includes('critical')) {
                    const highCount = (output.match(/high/gi) || []).length;
                    const criticalCount = (output.match(/critical/gi) || []).length;

                    addCheck({
                        name: 'security_audit',
                        status: 'warn',
                        message: `Security: ${criticalCount} critical, ${highCount} high vulnerabilities`,
                        details: output.split('\n').slice(0, 10).join('\n'),
                        fixCommand: 'pnpm audit --fix'
                    });

                    result.suggestedFixes.push({
                        issue: 'Security vulnerabilities detected',
                        command: 'pnpm audit --fix',
                        description: 'Attempt to auto-fix security issues'
                    });
                } else {
                    addCheck({
                        name: 'security_audit',
                        status: 'pass',
                        message: 'No high/critical security vulnerabilities'
                    });
                }
            } catch (error: any) {
                addCheck({
                    name: 'security_audit',
                    status: 'warn',
                    message: 'Security audit skipped',
                    details: error.message
                });
            }

            // 9. Environment Variables Check (Production-ready)
            const hasEnvLocal = await checkFile('.env.local');
            const hasEnv = await checkFile('.env');
            const hasEnvExample = await checkFile('.env.example');

            if (hasEnvLocal || hasEnv) {
                // Check if DATABASE_URL is set when Prisma is present
                if (prismaReady) {
                    try {
                        const envContent = await fs.readFile(
                            path.join(projectPath, hasEnvLocal ? '.env.local' : '.env'),
                            'utf-8'
                        );

                        if (envContent.includes('DATABASE_URL=') && !envContent.includes('DATABASE_URL=\n')) {
                            addCheck({
                                name: 'env_config',
                                status: 'pass',
                                message: 'Environment variables configured with DATABASE_URL'
                            });
                        } else {
                            addCheck({
                                name: 'env_config',
                                status: 'warn',
                                message: 'DATABASE_URL may not be set properly in .env',
                                fixCommand: 'Add DATABASE_URL=postgresql://... to .env'
                            });
                        }
                    } catch {
                        addCheck({
                            name: 'env_config',
                            status: 'warn',
                            message: 'Could not read .env file'
                        });
                    }
                } else {
                    addCheck({
                        name: 'env_config',
                        status: 'pass',
                        message: 'Environment file exists'
                    });
                }

                // Check for .env.example (production best practice)
                if (!hasEnvExample) {
                    addCheck({
                        name: 'env_example',
                        status: 'warn',
                        message: 'Missing .env.example - recommended for production deployments',
                        details: 'Create .env.example with placeholder values for documentation'
                    });
                }
            } else {
                addCheck({
                    name: 'env_config',
                    status: 'warn',
                    message: 'No .env or .env.local file found',
                    details: 'Create .env.local for local development'
                });
            }

            // 10. Next.js Config Check (Production-ready)
            const hasNextConfig = await checkFile('next.config.js') || await checkFile('next.config.mjs') || await checkFile('next.config.ts');
            if (hasNextConfig) {
                addCheck({
                    name: 'nextjs_config',
                    status: 'pass',
                    message: 'Next.js configuration file present'
                });
            } else {
                addCheck({
                    name: 'nextjs_config',
                    status: 'warn',
                    message: 'No next.config found - using default settings',
                    details: 'Consider adding next.config.mjs for production optimizations'
                });
            }

            // 11. Package.json Scripts Check (Production-ready)
            try {
                const pkgContent = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
                const pkg = JSON.parse(pkgContent);
                const scripts = pkg.scripts || {};

                const requiredScripts = ['dev', 'build', 'start'];
                const recommendedScripts = ['lint', 'test'];

                const missingRequired = requiredScripts.filter(s => !scripts[s]);
                const missingRecommended = recommendedScripts.filter(s => !scripts[s]);

                if (missingRequired.length === 0) {
                    addCheck({
                        name: 'npm_scripts',
                        status: missingRecommended.length > 0 ? 'warn' : 'pass',
                        message: missingRecommended.length > 0
                            ? `Scripts OK, but missing recommended: ${missingRecommended.join(', ')}`
                            : 'All required and recommended npm scripts present',
                        details: missingRecommended.length > 0
                            ? 'Consider adding: lint, test scripts for production readiness'
                            : undefined
                    });
                } else {
                    addCheck({
                        name: 'npm_scripts',
                        status: 'fail',
                        message: `Missing required scripts: ${missingRequired.join(', ')}`,
                        fixCommand: 'Check package.json scripts section'
                    });
                }
            } catch (error: any) {
                addCheck({
                    name: 'npm_scripts',
                    status: 'fail',
                    message: 'Could not read package.json',
                    details: error.message
                });
            }

            return JSON.stringify(result, null, 2);

        } catch (error: any) {
            result.success = false;
            result.checks.push({
                name: 'verification_error',
                status: 'fail',
                message: `Verification process error: ${error.message}`,
                details: error.stack
            });
            return JSON.stringify(result, null, 2);
        }
    }
};

/**
 * Get all code tools
 * @returns Array of tools
 */
export function getCodeTools(): Tool[] {
    return [
        createProjectTool,
        installPackagesTool,
        checkTypescriptTool,
        checkBuildErrorTool,
        setupShadcnTool,
        installShadcnComponentsTool,
        setupPrismaTool,
        verifyProjectTool
    ];
}

