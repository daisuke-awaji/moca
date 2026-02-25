import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load environment variables from a .env file.
 * Silently skips if the file does not exist.
 */
export function loadEnvFile(filePath = '.env', options?: { override?: boolean }): void {
  let content: string;
  try {
    content = readFileSync(resolve(filePath), 'utf-8');
  } catch {
    return;
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (options?.override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
