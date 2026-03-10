/**
 * Tools builder
 *
 * Integrates local tools, AgentCore Gateway MCP tools, and user-defined MCP clients
 * into a unified tool set for the agent.
 */

import type { McpClient } from '@strands-agents/sdk';
import { logger } from '../config/index.js';
import { localTools, convertMCPToolsToStrands } from '../tools/index.js';
import { mcpClient } from '../mcp/client.js';
import type { MCPToolDefinition } from '../schemas/types.js';

/**
 * Select enabled tools from the provided list.
 *
 * Behavior:
 * - `enabledTools === undefined` → returns empty array (no tools enabled by default)
 * - `enabledTools === []` → returns empty array (explicitly disabled)
 * - `enabledTools === ['tool1', 'tool2']` → returns only matching tools
 */
export function selectEnabledTools<T extends { name: string }>(
  tools: T[],
  enabledTools?: string[]
): T[] {
  if (enabledTools === undefined) return [];
  if (enabledTools.length === 0) {
    logger.info('🔧 Tools disabled: Empty array specified');
    return [];
  }

  const filtered = tools.filter((tool) => enabledTools.includes(tool.name));
  logger.info(`🔧 Filtering tools: ${enabledTools.join(', ')}`);
  return filtered;
}

/**
 * Result of building the complete tool set
 */
export interface ToolSetResult {
  /** All tools ready for Agent consumption */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allTools: any[];
  /** Raw Gateway MCP tool definitions (used for prompt generation) */
  gatewayMCPTools: MCPToolDefinition[];
  /** Total tool count breakdown for logging */
  counts: {
    local: number;
    gateway: number;
    userMCP: number;
    total: number;
  };
}

/**
 * Build the complete tool set by combining local, Gateway MCP, and user MCP tools.
 *
 * @param enabledTools - Tool name filter (undefined=none, []=none, ['name',...]=filtered)
 * @param userMCPClients - MCP clients from user configuration (always fully included)
 */
export async function buildToolSet(
  enabledTools?: string[],
  userMCPClients: McpClient[] = []
): Promise<ToolSetResult> {
  // Fetch Gateway MCP tools
  const gatewayMCPTools = (await mcpClient.listTools()) as MCPToolDefinition[];

  // Convert Gateway MCP tools to Strands format
  const gatewayStrandsTools = convertMCPToolsToStrands(gatewayMCPTools);

  // Filter local + gateway tools by enabledTools list
  const filteredTools = selectEnabledTools([...localTools, ...gatewayStrandsTools], enabledTools);

  // Combine: filtered tools + user MCP clients (always all enabled)
  const allTools = [...filteredTools, ...userMCPClients];

  const counts = {
    local: localTools.length,
    gateway: gatewayStrandsTools.length,
    userMCP: userMCPClients.length,
    total: allTools.length,
  };

  logger.info(
    `✅ Prepared total of ${counts.total} tools (Local: ${counts.local}, Gateway: ${counts.gateway}, User MCP: ${counts.userMCP})`
  );

  return { allTools, gatewayMCPTools, counts };
}
