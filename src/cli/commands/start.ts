import 'dotenv/config'; // Load env vars
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { logger } from '../../utils/logger.js';
import { Agent, AgentConfig, AgentTask } from '../../agent/index.js';
import fs from 'fs/promises';
import path from 'path';

export const startCommand = new Command('start')
    .description('Start the AI Agent')
    .option('-n, --project-name <name>', 'Project name (will be created in current directory)')
    .option('-m, --max-iterations <number>', 'Maximum agent iterations', '100')
    .option('--skip-db', 'Skip PostgreSQL configuration (for static sites)')
    .option('--no-verbose', 'Disable verbose logging')
    .action(async (options) => {
        try {
            // 1. Initial Input Resolution
            let currentPrompt: string | undefined;
            let projectName = options.projectName;

            if (!projectName) {
                const answer = await inquirer.prompt([{
                    type: 'input',
                    name: 'projectName',
                    message: 'What is your project name?',
                    default: 'my-app',
                    validate: (input: string) => {
                        // Validate project name (no spaces, special chars)
                        if (/^[a-z0-9-]+$/.test(input)) return true;
                        return 'Project name should only contain lowercase letters, numbers, and hyphens';
                    }
                }]);
                projectName = answer.projectName;
            }

            // Derive projectPath from projectName (absolute path for consistency)
            const projectPath = path.resolve(process.cwd(), projectName);

            let geminiKey = process.env.GEMINI_API_KEY;
            if (!geminiKey) {
                // Prompt for key
                const answers = await inquirer.prompt([{
                    type: 'password',
                    name: 'apiKey',
                    message: 'Please enter your Gemini API Key:',
                    validate: (input) => input.length > 0 ? true : 'API Key is required'
                }]);

                const key = answers.apiKey;

                // Save to .env
                const envContent = `GEMINI_API_KEY=${key}\n`;
                await fs.writeFile('.env', envContent, { flag: 'a' }); // Append or create

                // Set in current process
                process.env.GEMINI_API_KEY = key;
                geminiKey = key;
                logger.success('API Key saved to .env file');
            }

            if (!geminiKey) {
                logger.error('Failed to resolve Gemini API Key');
                process.exit(1);
            }

            const maxIterations = parseInt(options.maxIterations, 10);
            const verbose = options.verbose ?? true; // Commander with --no-verbose sets this to true by default, false if flag used.

            // 2. Interactive Loop
            let iteration = 1;
            let active = true;

            // Ask for model selection
            const modelAnswer = await inquirer.prompt([{
                type: 'select',
                name: 'model',
                message: 'Select Gemini Model:',
                choices: [
                    'gemini-3-flash-preview',
                    'gemini-3-pro-preview'
                ],
                default: 'gemini-3-flash-preview'
            }]);

            // Database Creds (Step-by-Step) - Skip if --skip-db is used
            let databaseUrl: string | undefined;

            if (!options.skipDb) {
                const defaultDbName = projectName;
                console.log('\n--- PostgreSQL Configuration ---');

                const dbCreds = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'host',
                        message: 'Host:',
                        default: 'localhost'
                    },
                    {
                        type: 'input',
                        name: 'port',
                        message: 'Port:',
                        default: '5432'
                    },
                    {
                        type: 'input',
                        name: 'username',
                        message: 'Username:',
                        default: 'postgres'
                    },
                    {
                        type: 'input',
                        name: 'password',
                        message: 'Password:',
                        default: 'postgres'
                    },
                    {
                        type: 'input',
                        name: 'dbName',
                        message: 'Database Name:',
                        default: defaultDbName
                    }
                ]);

                databaseUrl = `postgresql://${dbCreds.username}:${dbCreds.password}@${dbCreds.host}:${dbCreds.port}/${dbCreds.dbName}`;
            } else {
                logger.info('Skipping PostgreSQL configuration (--skip-db)');
            }

            const config: AgentConfig = {
                geminiApiKey: geminiKey,
                maxIterations: maxIterations,
                verbose: verbose,
                modelName: modelAnswer.model
            };

            // Initialize agent once
            const agent = new Agent(config);
            await agent.init();

            while (active) {
                if (!currentPrompt) {
                    const answer = await inquirer.prompt([{
                        type: 'input',
                        name: 'prompt',
                        message: 'What do you want to build or modify?',
                        validate: (input: string) => input.trim() !== '' ? true : 'Prompt is required'
                    }]);
                    currentPrompt = answer.prompt;
                }

                if (currentPrompt && currentPrompt.toLowerCase() === 'exit') {
                    console.log('Exiting...');
                    break;
                }

                logger.info(`\n--- Iteration ${iteration} ---`);
                logger.info(`Goal: ${currentPrompt}`);
                logger.info(`Project: ${projectPath}`);

                // Enhance prompt with serial artifact instructions
                const enhancedPrompt = `${currentPrompt}\n\nIMPORTANT RULES:
1. You MUST create the following plan files inside "${projectPath}/.agent":
   - "plan${iteration}.md" (Implementation Plan)
   - "task${iteration}.md" (Task Checklist)
   - Update "task${iteration}.md" as you progress.
2. If creating a new project, use "create_nextjs_project" with "projectPath" set EXACTLY to "${projectPath}".
3. CRITICAL: Treat "${projectPath}" as your ROOT working directory. All file writes and commands must be executed relative to this path. Do NOT create arbitrary subdirectories for the project itself.`;

                // Execute agent
                try {
                    if (iteration === 1) {
                        const task: AgentTask = {
                            prompt: enhancedPrompt,
                            projectPath: projectPath,
                            databaseUrl: databaseUrl
                        };
                        await agent.start(task);
                    } else {
                        await agent.chat(enhancedPrompt);
                    }

                    logger.success(`Iteration ${iteration} completed!`);

                    // Post-generation Guide
                    console.log(`\n--------------------------------------------`);
                    console.log(`To run your project:`);
                    console.log(`  cd ${projectPath}`);
                    console.log(`  pnpm dev`);
                    console.log(`--------------------------------------------`);
                    console.log(`Artifacts stored in: ${projectPath}/.agent/plan${iteration}.md`);
                    console.log(`--------------------------------------------\n`);

                } catch (error: any) {
                    logger.error(`Iteration failed: ${error.message}`);
                    // Don't exit process, allow user to try again or exit
                }

                // Prepare for next loop
                iteration++;
                currentPrompt = ''; // Reset prompt to force simple ask

                // Simple "Next" Prompt
                const nextStep = await inquirer.prompt([{
                    type: 'input',
                    name: 'next',
                    message: 'Enter your next request, feedback, or type "exit" to quit:'
                }]);

                const userNext = nextStep.next.trim();
                if (userNext.toLowerCase() === 'exit') {
                    active = false;
                } else {
                    currentPrompt = userNext;
                }
            }

            logger.success('Session ended. Happy coding!');

        } catch (error: any) {
            logger.error(`Error: ${error.message || 'Unknown error'}`);
            process.exit(1);
        }
    });
