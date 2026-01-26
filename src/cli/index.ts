#!/usr/bin/env node
import { Command } from 'commander';
import { generateCommand } from './commands/generate.js';

const program = new Command();

program
    .name('next-agent')
    .description('Next.js Fullstack Agent CLI')
    .version('1.0.0');

program.addCommand(generateCommand);

program.parse();
