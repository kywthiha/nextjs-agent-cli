import { Command } from 'commander';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger.js';
import { getCredPath, getGeminiApiKey, setGeminiApiKey } from '../../utils/cred-store.js';

export const configCommand = new Command('config')
    .description('Manage CLI configuration');

/**
 * Subcommand: set-api-key
 * Prompts for and saves the Gemini API key to credential store
 */
configCommand
    .command('set-api-key')
    .description('Set or update the Gemini API key')
    .action(async () => {
        try {
            const currentKey = await getGeminiApiKey();

            if (currentKey) {
                const redactedKey = currentKey.slice(0, 6) + '...' + currentKey.slice(-4);
                logger.info(`Current API key: ${redactedKey}`);
            }

            const answer = await inquirer.prompt([{
                type: 'password',
                name: 'apiKey',
                message: 'Enter your Gemini API Key:',
                validate: (input: string) => input.length > 0 ? true : 'API Key is required'
            }]);

            await setGeminiApiKey(answer.apiKey);
            logger.success(`API key saved to ${getCredPath()}`);

        } catch (error: any) {
            logger.error(`Failed to set API key: ${error.message}`);
            process.exit(1);
        }
    });

/**
 * Subcommand: show
 * Displays current configuration info
 */
configCommand
    .command('show')
    .description('Show current configuration')
    .action(async () => {
        try {
            const credPath = getCredPath();
            const apiKey = await getGeminiApiKey();

            console.log('\n--- Configuration ---');
            console.log(`Config file: ${credPath}`);

            if (apiKey) {
                const redactedKey = apiKey.slice(0, 6) + '...' + apiKey.slice(-4);
                console.log(`Gemini API Key: ${redactedKey}`);
            } else {
                console.log('Gemini API Key: (not set)');
            }
            console.log('');

        } catch (error: any) {
            logger.error(`Failed to show config: ${error.message}`);
            process.exit(1);
        }
    });
