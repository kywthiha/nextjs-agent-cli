#!/usr/bin/env node
import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
    .name('next-agent')
    .description('Next.js Fullstack Agent CLI')
    .version('1.0.0');

program.addCommand(startCommand);
program.addCommand(configCommand);

program.parse();
