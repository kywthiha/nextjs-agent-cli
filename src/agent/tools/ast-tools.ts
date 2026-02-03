/**
 * AST tools for the AI Agent
 * Uses TypeScript Compiler API for accurate code structure analysis
 */

import { Tool } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import ts from 'typescript';

/**
 * Symbol info extracted from AST
 */
interface SymbolInfo {
    name: string;
    kind: string;
    line: number;
    endLine: number;
    signature: string;
    exported: boolean;
    modifiers: string[];
    parent?: string;
}

/**
 * Parse a TypeScript/JavaScript file and extract symbols using TS Compiler API
 */
function parseFileSymbols(filePath: string, content: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    const ext = path.extname(filePath).toLowerCase();
    if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        return symbols;
    }

    // Determine script kind
    let scriptKind: ts.ScriptKind;
    switch (ext) {
        case '.tsx': scriptKind = ts.ScriptKind.TSX; break;
        case '.jsx': scriptKind = ts.ScriptKind.JSX; break;
        case '.js':
        case '.mjs':
        case '.cjs': scriptKind = ts.ScriptKind.JS; break;
        default: scriptKind = ts.ScriptKind.TS;
    }

    // Create source file
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
    );

    /**
     * Get the kind name for a node
     */
    function getKindName(node: ts.Node): string {
        if (ts.isFunctionDeclaration(node)) return 'function';
        if (ts.isArrowFunction(node)) return 'arrow_function';
        if (ts.isFunctionExpression(node)) return 'function_expression';
        if (ts.isMethodDeclaration(node)) return 'method';
        if (ts.isClassDeclaration(node)) return 'class';
        if (ts.isInterfaceDeclaration(node)) return 'interface';
        if (ts.isTypeAliasDeclaration(node)) return 'type';
        if (ts.isEnumDeclaration(node)) return 'enum';
        if (ts.isVariableDeclaration(node)) return 'variable';
        if (ts.isPropertyDeclaration(node)) return 'property';
        if (ts.isGetAccessor(node)) return 'getter';
        if (ts.isSetAccessor(node)) return 'setter';
        if (ts.isConstructorDeclaration(node)) return 'constructor';
        if (ts.isModuleDeclaration(node)) return 'namespace';
        return 'unknown';
    }

    /**
     * Check if a node is exported
     */
    function isExported(node: ts.Node): boolean {
        if (!ts.canHaveModifiers(node)) return false;
        const mods = ts.getModifiers(node);
        if (!mods) return false;
        return mods.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    }

    /**
     * Get modifiers as strings
     */
    function getModifiers(node: ts.Node): string[] {
        if (!ts.canHaveModifiers(node)) return [];
        const mods = ts.getModifiers(node);
        if (!mods) return [];
        return mods
            .map(m => {
                switch (m.kind) {
                    case ts.SyntaxKind.PublicKeyword: return 'public';
                    case ts.SyntaxKind.PrivateKeyword: return 'private';
                    case ts.SyntaxKind.ProtectedKeyword: return 'protected';
                    case ts.SyntaxKind.StaticKeyword: return 'static';
                    case ts.SyntaxKind.ReadonlyKeyword: return 'readonly';
                    case ts.SyntaxKind.AsyncKeyword: return 'async';
                    case ts.SyntaxKind.AbstractKeyword: return 'abstract';
                    case ts.SyntaxKind.ExportKeyword: return 'export';
                    case ts.SyntaxKind.DefaultKeyword: return 'default';
                    default: return '';
                }
            })
            .filter(m => m);
    }

    /**
     * Get signature for a node
     */
    function getSignature(node: ts.Node): string {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const lines = content.split('\n');
        let sig = lines[line]?.trim() || '';

        // Clean up signature - remove body
        sig = sig.replace(/\{[\s\S]*$/, '').trim();
        if (sig.endsWith('{')) sig = sig.slice(0, -1).trim();

        // Limit length
        if (sig.length > 100) sig = sig.substring(0, 97) + '...';

        return sig;
    }

    /**
     * Get name from a node
     */
    function getName(node: ts.Node): string | null {
        if ('name' in node && node.name) {
            const name = node.name as ts.Node;
            if (ts.isIdentifier(name)) {
                return name.text;
            }
        }
        return null;
    }

    /**
     * Walk the AST and collect symbols
     */
    function visit(node: ts.Node, parentName?: string) {
        const kind = getKindName(node);

        // Skip unknown or unimportant nodes
        if (kind === 'unknown') {
            ts.forEachChild(node, child => visit(child, parentName));
            return;
        }

        // Handle variable declarations specially
        if (ts.isVariableStatement(node)) {
            const isExp = isExported(node);
            const mods = getModifiers(node);

            node.declarationList.declarations.forEach(decl => {
                const name = getName(decl);
                if (!name) return;

                // Check if it's a function (arrow function or function expression)
                let declKind = 'variable';
                if (decl.initializer) {
                    if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
                        declKind = 'function';
                    } else if (ts.isClassExpression(decl.initializer)) {
                        declKind = 'class';
                    }
                }

                const { line } = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
                const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(decl.getEnd());

                symbols.push({
                    name,
                    kind: declKind,
                    line: line + 1,
                    endLine: endLine + 1,
                    signature: getSignature(decl),
                    exported: isExp,
                    modifiers: mods,
                    parent: parentName
                });
            });
            return;
        }

        const name = getName(node);
        if (name) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

            symbols.push({
                name,
                kind,
                line: line + 1,
                endLine: endLine + 1,
                signature: getSignature(node),
                exported: isExported(node),
                modifiers: getModifiers(node),
                parent: parentName
            });

            // For classes, recursively process members
            if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
                ts.forEachChild(node, child => visit(child, name));
                return;
            }
        }

        ts.forEachChild(node, child => visit(child, parentName));
    }

    visit(sourceFile);
    return symbols;
}

/**
 * Tool: List Symbols
 * List all code symbols in a file using TypeScript Compiler API
 */
export const listSymbolsTool: Tool = {
    name: 'list_symbols',
    description: `List all code symbols (functions, classes, interfaces, types) in a file.
Uses TypeScript Compiler API for accurate parsing.

Output format:
L<line>-<endLine> [kind] name (modifiers)
  signature

Filter by kind: function, class, interface, type, enum, method, variable`,
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Path to the file to analyze'
            },
            kind: {
                type: 'string',
                description: 'Filter by symbol kind',
                enum: ['function', 'class', 'interface', 'type', 'enum', 'method', 'variable', 'all']
            },
            exportedOnly: {
                type: 'string',
                description: 'Show only exported symbols',
                enum: ['true', 'false']
            }
        },
        required: ['filePath']
    },
    execute: async (input) => {
        try {
            const filePath = input.filePath;
            const filterKind = input.kind || 'all';
            const exportedOnly = input.exportedOnly === 'true';

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

            const symbols = parseFileSymbols(filePath, content);

            // Filter
            let filtered = symbols;
            if (filterKind !== 'all') {
                filtered = filtered.filter(s => s.kind === filterKind);
            }
            if (exportedOnly) {
                filtered = filtered.filter(s => s.exported);
            }

            if (filtered.length === 0) {
                return `No symbols found in ${path.basename(filePath)}${filterKind !== 'all' ? ` (kind: ${filterKind})` : ''}`;
            }

            // Format output
            const output: string[] = [];
            output.push(`File: ${path.basename(filePath)}`);
            output.push(`Symbols: ${filtered.length}\n`);

            // Group by kind
            const byKind: Record<string, SymbolInfo[]> = {};
            for (const sym of filtered) {
                if (!byKind[sym.kind]) byKind[sym.kind] = [];
                byKind[sym.kind].push(sym);
            }

            for (const [kind, syms] of Object.entries(byKind)) {
                output.push(`=== ${kind.toUpperCase()}S (${syms.length}) ===`);
                for (const sym of syms) {
                    const exportMark = sym.exported ? 'export ' : '';
                    const mods = sym.modifiers.filter(m => m !== 'export').join(' ');
                    const parentMark = sym.parent ? ` (in ${sym.parent})` : '';

                    output.push(`L${sym.line}-${sym.endLine}: ${exportMark}${mods ? mods + ' ' : ''}${sym.name}${parentMark}`);
                    output.push(`  ${sym.signature}`);
                }
                output.push('');
            }

            return output.join('\n');

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Tool: Find Definition
 * Find where a symbol is defined using TS Compiler API
 */
export const findDefinitionTool: Tool = {
    name: 'find_definition',
    description: `Find where a symbol (function, class, variable) is defined.
Uses TypeScript Compiler API for accurate matching.

Returns file path, line range, kind, and signature.`,
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'Name of the symbol to find'
            },
            searchPath: {
                type: 'string',
                description: 'File or directory to search in'
            },
            kind: {
                type: 'string',
                description: 'Optional: filter by kind',
                enum: ['function', 'class', 'interface', 'type', 'enum', 'variable', 'all']
            }
        },
        required: ['symbol', 'searchPath']
    },
    execute: async (input) => {
        try {
            const symbol = input.symbol;
            const searchPath = input.searchPath;
            const filterKind = input.kind || 'all';

            // Check if path exists
            let stat;
            try {
                stat = await fs.stat(searchPath);
            } catch {
                return `Error: Path not found: ${searchPath}`;
            }

            const results: { file: string; symbol: SymbolInfo }[] = [];

            const processFile = async (filePath: string) => {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const symbols = parseFileSymbols(filePath, content);

                    for (const sym of symbols) {
                        if (sym.name === symbol) {
                            if (filterKind === 'all' || sym.kind === filterKind) {
                                results.push({ file: filePath, symbol: sym });
                            }
                        }
                    }
                } catch {
                    // Skip unreadable files
                }
            };

            if (stat.isFile()) {
                await processFile(searchPath);
            } else {
                // Walk directory
                const walk = async (dir: string) => {
                    try {
                        const entries = await fs.readdir(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (entry.name === 'node_modules' ||
                                entry.name === '.git' ||
                                entry.name === 'dist' ||
                                entry.name === '.next' ||
                                entry.name.startsWith('.')) {
                                continue;
                            }

                            const fullPath = path.join(dir, entry.name);
                            if (entry.isDirectory()) {
                                await walk(fullPath);
                            } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
                                await processFile(fullPath);
                            }
                        }
                    } catch {
                        // Skip
                    }
                };
                await walk(searchPath);
            }

            if (results.length === 0) {
                return `No definition found for "${symbol}"${filterKind !== 'all' ? ` (kind: ${filterKind})` : ''}`;
            }

            const output: string[] = [];
            output.push(`Found ${results.length} definition(s) for "${symbol}":\n`);

            for (const { file, symbol: sym } of results) {
                const relPath = stat.isDirectory() ? path.relative(searchPath, file) : path.basename(file);
                output.push(`=== ${relPath}:${sym.line}-${sym.endLine} ===`);
                output.push(`Kind: ${sym.kind}`);
                output.push(`Exported: ${sym.exported}`);
                output.push(`Modifiers: ${sym.modifiers.join(', ') || 'none'}`);
                output.push(`Signature: ${sym.signature}`);
                if (sym.parent) {
                    output.push(`Parent: ${sym.parent}`);
                }
                output.push('');
            }

            return output.join('\n');

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Tool: Find References
 * Find all usages of a symbol
 */
export const findReferencesTool: Tool = {
    name: 'find_references',
    description: `Find all usages/references of a symbol in the codebase.
Uses word boundary matching for accurate results.

Returns list of files and lines where the symbol is used.`,
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'Symbol name to find references for'
            },
            searchPath: {
                type: 'string',
                description: 'Directory to search in'
            }
        },
        required: ['symbol', 'searchPath']
    },
    execute: async (input) => {
        try {
            const symbol = input.symbol;
            const searchPath = input.searchPath;

            // Check path exists
            try {
                await fs.access(searchPath);
            } catch {
                return `Error: Path not found: ${searchPath}`;
            }

            const references: { file: string; line: number; content: string; isDefinition: boolean }[] = [];

            // Word boundary regex for accurate matching
            const symbolRegex = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

            const walk = async (dir: string) => {
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.name === 'node_modules' ||
                            entry.name === '.git' ||
                            entry.name === 'dist' ||
                            entry.name === '.next' ||
                            entry.name.startsWith('.')) {
                            continue;
                        }

                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            await walk(fullPath);
                        } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
                            try {
                                const content = await fs.readFile(fullPath, 'utf-8');
                                const lines = content.split('\n');
                                const symbols = parseFileSymbols(fullPath, content);
                                const definitionLines = new Set(symbols.filter(s => s.name === symbol).map(s => s.line));

                                lines.forEach((line, idx) => {
                                    if (symbolRegex.test(line)) {
                                        references.push({
                                            file: fullPath,
                                            line: idx + 1,
                                            content: line.trim(),
                                            isDefinition: definitionLines.has(idx + 1)
                                        });
                                    }
                                });
                            } catch {
                                // Skip
                            }
                        }
                    }
                } catch {
                    // Skip
                }
            };

            await walk(searchPath);

            if (references.length === 0) {
                return `No references found for "${symbol}"`;
            }

            // Separate definitions from usages
            const definitions = references.filter(r => r.isDefinition);
            const usages = references.filter(r => !r.isDefinition);

            // Group by file
            const byFile: Record<string, { line: number; content: string; isDefinition: boolean }[]> = {};
            for (const ref of references) {
                const relPath = path.relative(searchPath, ref.file);
                if (!byFile[relPath]) byFile[relPath] = [];
                byFile[relPath].push({ line: ref.line, content: ref.content, isDefinition: ref.isDefinition });
            }

            const output: string[] = [];
            output.push(`Found ${references.length} references to "${symbol}"`);
            output.push(`  Definitions: ${definitions.length}`);
            output.push(`  Usages: ${usages.length}`);
            output.push(`  Files: ${Object.keys(byFile).length}\n`);

            for (const [file, refs] of Object.entries(byFile)) {
                const defCount = refs.filter(r => r.isDefinition).length;
                const useCount = refs.length - defCount;
                output.push(`=== ${file} (${defCount} def, ${useCount} use) ===`);

                for (const ref of refs.slice(0, 15)) {
                    const marker = ref.isDefinition ? '[DEF]' : '[USE]';
                    output.push(`L${ref.line} ${marker}: ${ref.content.substring(0, 80)}${ref.content.length > 80 ? '...' : ''}`);
                }
                if (refs.length > 15) {
                    output.push(`... and ${refs.length - 15} more in this file`);
                }
                output.push('');
            }

            return output.join('\n');

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Tool: Get File Outline
 * Get a quick outline of a file's structure
 */
export const fileOutlineTool: Tool = {
    name: 'file_outline',
    description: `Get a quick structural outline of a file.
Shows the hierarchy of classes, functions, and their members.

Best for understanding file structure at a glance.`,
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Path to the file'
            }
        },
        required: ['filePath']
    },
    execute: async (input) => {
        try {
            const filePath = input.filePath;

            let content: string;
            try {
                content = await fs.readFile(filePath, 'utf-8');
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return `Error: File not found: ${filePath}`;
                }
                return `Error reading file: ${error.message}`;
            }

            const symbols = parseFileSymbols(filePath, content);
            const totalLines = content.split('\n').length;

            if (symbols.length === 0) {
                return `No symbols found in ${path.basename(filePath)} (${totalLines} lines)`;
            }

            // Build tree structure
            const output: string[] = [];
            output.push(`File: ${path.basename(filePath)}`);
            output.push(`Lines: ${totalLines}`);
            output.push(`Symbols: ${symbols.length}\n`);

            // Group top-level and nested symbols
            const topLevel = symbols.filter(s => !s.parent);
            const nested = symbols.filter(s => s.parent);

            for (const sym of topLevel) {
                const exp = sym.exported ? 'export ' : '';
                const mods = sym.modifiers.filter(m => m !== 'export').join(' ');
                output.push(`${exp}${mods ? mods + ' ' : ''}${sym.kind} ${sym.name} [L${sym.line}-${sym.endLine}]`);

                // Add nested members
                const members = nested.filter(n => n.parent === sym.name);
                for (const member of members) {
                    const memberMods = member.modifiers.join(' ');
                    output.push(`  └─ ${memberMods ? memberMods + ' ' : ''}${member.kind} ${member.name} [L${member.line}]`);
                }
            }

            return output.join('\n');

        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }
};

/**
 * Get all AST tools
 */
export function getAstTools(): Tool[] {
    return [
        listSymbolsTool,
        findDefinitionTool,
        findReferencesTool,
        fileOutlineTool,
    ];
}
