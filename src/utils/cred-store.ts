import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_DIR_NAME = '.nextjs-agent-cli';
const CRED_FILE_NAME = 'cred.json';

export interface Credentials {
    geminiApiKey?: string;
}

/**
 * Get the path to the config directory
 */
export function getConfigDir(): string {
    return path.join(os.homedir(), CONFIG_DIR_NAME);
}

/**
 * Get the path to the credentials file
 */
export function getCredPath(): string {
    return path.join(getConfigDir(), CRED_FILE_NAME);
}

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
    const configDir = getConfigDir();
    try {
        await fs.mkdir(configDir, { recursive: true });
    } catch (error: any) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Load credentials from the store
 */
export async function loadCredentials(): Promise<Credentials> {
    try {
        const credPath = getCredPath();
        const content = await fs.readFile(credPath, 'utf-8');
        return JSON.parse(content) as Credentials;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

/**
 * Save credentials to the store
 */
export async function saveCredentials(creds: Credentials): Promise<void> {
    await ensureConfigDir();
    const credPath = getCredPath();
    await fs.writeFile(credPath, JSON.stringify(creds, null, 2), 'utf-8');
}

/**
 * Get the Gemini API key from the credential store
 */
export async function getGeminiApiKey(): Promise<string | undefined> {
    const creds = await loadCredentials();
    return creds.geminiApiKey;
}

/**
 * Set the Gemini API key in the credential store
 */
export async function setGeminiApiKey(key: string): Promise<void> {
    const creds = await loadCredentials();
    creds.geminiApiKey = key;
    await saveCredentials(creds);
}
