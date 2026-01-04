/**
 * Load and validate mcp.json configuration file
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import type { MCPConfig, MCPServerConfig } from './types.js';
import { MCPConfigError } from './types.js';

/**
 * Logger function type definition
 */
interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
}

/**
 * Default logger (using console)
 */
const defaultLogger: Logger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

/**
 * Zod schema definition
 */
const MCPServerBaseSchema = z.object({
  enabled: z.boolean().optional().default(true),
  prefix: z.string().optional(),
});

const StdioMCPServerSchema = z
  .object({
    transport: z.literal('stdio'),
    command: z.string().min(1, 'command is required'),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .merge(MCPServerBaseSchema);

const HttpMCPServerSchema = z
  .object({
    transport: z.literal('http'),
    url: z.string().url('url must be a valid URL'),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .merge(MCPServerBaseSchema);

const SseMCPServerSchema = z
  .object({
    transport: z.literal('sse'),
    url: z.string().url('url must be a valid URL'),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .merge(MCPServerBaseSchema);

const MCPServerConfigSchema = z.union([
  StdioMCPServerSchema,
  HttpMCPServerSchema,
  SseMCPServerSchema,
]);

const MCPConfigSchema = z.object({
  mcpServers: z.record(z.string(), MCPServerConfigSchema),
});

/**
 * Expand environment variables
 * Replace ${VAR_NAME} format strings with process.env.VAR_NAME
 */
function expandEnvVars(value: string, logger: Logger = defaultLogger): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      logger.warn(`Environment variable ${varName} is not defined: ${match}`);
      return match; // Return original string without replacement
    }
    return envValue;
  });
}

/**
 * Expand environment variables for all string values in object
 */
function expandEnvVarsInObject<T>(obj: T, logger: Logger = defaultLogger): T {
  if (typeof obj === 'string') {
    return expandEnvVars(obj, logger) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item, logger)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value, logger);
    }
    return result as T;
  }
  return obj;
}

/**
 * Auto-infer and add transport field to MCP server configuration
 * - stdio if command exists
 * - http if url exists (default)
 */
function inferTransport(serverConfig: Record<string, unknown>): Record<string, unknown> {
  // Return as-is if transport already specified
  if (serverConfig.transport) {
    return serverConfig;
  }

  // stdio if command exists
  if (serverConfig.command) {
    console.debug('Auto-inferring transport: stdio (command field exists)');
    return { ...serverConfig, transport: 'stdio' };
  }

  // http if url exists (default, SSE detection can be added in future)
  if (serverConfig.url) {
    console.debug('Auto-inferring transport: http (url field exists)');
    return { ...serverConfig, transport: 'http' };
  }

  // Return as-is if neither exists (will error in Zod validation)
  return serverConfig;
}

/**
 * Load mcp.json configuration file
 *
 * @param configPath Configuration file path (defaults to MCP_CONFIG_PATH env var or ./mcp.json if omitted)
 * @param logger Logger (defaults to console if omitted)
 * @returns MCPConfig object, or null if file doesn't exist
 */
export function loadMCPConfig(
  configPath?: string,
  logger: Logger = defaultLogger
): MCPConfig | null {
  // Determine configuration file path
  const path = configPath || process.env.MCP_CONFIG_PATH || resolve(process.cwd(), 'mcp.json');

  // Check file existence
  if (!existsSync(path)) {
    logger.info(`MCP configuration file not found: ${path}`);
    return null;
  }

  try {
    logger.info(`Loading MCP configuration file: ${path}`);

    // Read file
    const content = readFileSync(path, 'utf-8');
    const rawConfig = JSON.parse(content);

    // Expand environment variables
    const expandedConfig = expandEnvVarsInObject(rawConfig, logger);

    // Auto-infer transport
    if (expandedConfig.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(expandedConfig.mcpServers)) {
        expandedConfig.mcpServers[serverName] = inferTransport(
          serverConfig as Record<string, unknown>
        );
      }
    }

    // Validate with Zod
    const validatedConfig = MCPConfigSchema.parse(expandedConfig) as MCPConfig;

    // Check number of enabled servers
    const enabledServers = Object.entries(validatedConfig.mcpServers).filter(
      ([, serverConfig]) => serverConfig.enabled !== false
    );

    logger.info(
      `✅ MCP configuration loaded: ${Object.keys(validatedConfig.mcpServers).length} server definitions (enabled: ${enabledServers.length})`
    );

    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
      throw new MCPConfigError(`MCP configuration validation error:\n${issues.join('\n')}`, error);
    }

    if (error instanceof SyntaxError) {
      throw new MCPConfigError(`MCP configuration JSON parse error: ${error.message}`, error);
    }

    throw new MCPConfigError(
      `Failed to load MCP configuration: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Extract only enabled MCP server configurations
 * Apply auto-inference if transport is not specified
 */
export function getEnabledMCPServers(config: MCPConfig): Array<{
  name: string;
  config: MCPServerConfig;
}> {
  return Object.entries(config.mcpServers)
    .filter(([, serverConfig]) => serverConfig.enabled !== false)
    .map(([name, serverConfig]) => ({
      name,
      config: inferTransport(
        serverConfig as unknown as Record<string, unknown>
      ) as unknown as MCPServerConfig,
    }));
}
