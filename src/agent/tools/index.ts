/**
 * Tool registry - exports all tools for the agent
 */
export { getFileTools } from './file-tools.js';
export { getCodeTools } from './code-tools.js';

import { Tool } from '../types.js';
import { getFileTools } from './file-tools.js';
import { getCodeTools } from './code-tools.js';

/**
 * Get all available tools
 */
export function getAllTools(): Tool[] {
    return [
        ...getFileTools(),
        ...getCodeTools()
    ];
}
