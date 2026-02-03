/**
 * Tool registry - exports all tools for the agent
 */
export { getFileTools } from './file-tools.js';
export { getCodeTools } from './code-tools.js';
export { getSearchTools } from './search-tools.js';
export { getAstTools } from './ast-tools.js';
export { getShellTools } from './shell-tools.js';

import { Tool } from '../types.js';
import { getFileTools } from './file-tools.js';
import { getCodeTools } from './code-tools.js';
import { getSearchTools } from './search-tools.js';
import { getAstTools } from './ast-tools.js';
import { getShellTools } from './shell-tools.js';

/**
 * Get all available tools
 */
export function getAllTools(): Tool[] {
    return [
        ...getFileTools(),
        ...getCodeTools(),
        ...getSearchTools(),
        ...getAstTools(),
        ...getShellTools(),
    ];
}

