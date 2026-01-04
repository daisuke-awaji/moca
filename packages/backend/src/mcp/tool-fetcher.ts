/**
 * Utility to retrieve tool list from MCP servers
 */
import { MCPConfig } from './types.js';
import { getEnabledMCPServers } from './config-loader.js';
import { createMCPClients } from './client-factory.js';

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
 * MCP tool information type definition
 */
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  serverName: string; // For identifying which server the tool belongs to
}

/**
 * Retrieve tool list from MCP configuration
 *
 * @param mcpConfig MCP server configuration
 * @param logger Logger (defaults to console if omitted)
 * @returns Array of tool information
 */
export async function fetchToolsFromMCPConfig(
  mcpConfig: MCPConfig,
  logger: Logger = defaultLogger
): Promise<MCPToolInfo[]> {
  const servers = getEnabledMCPServers(mcpConfig);
  const clients = createMCPClients(servers, logger);
  const allTools: MCPToolInfo[] = [];

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const serverName = servers[i].name;

    try {
      logger.info(`🔍 Tool retrieval started: ${serverName}`);
      const tools = await client.listTools();

      for (const tool of tools) {
        const toolWithSchema = tool as {
          name: string;
          description?: string;
          inputSchema?: Record<string, unknown>;
          input_schema?: Record<string, unknown>;
        };

        allTools.push({
          name: toolWithSchema.name,
          description: toolWithSchema.description,
          inputSchema: toolWithSchema.inputSchema || toolWithSchema.input_schema || {},
          serverName,
        });
      }

      logger.info(`✅ Tool retrieval successful: ${serverName} (${tools.length} items)`);
    } catch (error) {
      logger.error(`❌ Tool retrieval failed (${serverName}):`, error);
      // Skip and continue even if error occurs (retrieve tools from other servers)
    }
  }

  return allTools;
}
