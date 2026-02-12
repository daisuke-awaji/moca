/**
 * Tool registry
 *
 * Manages available tools and provides lookup by name.
 */

import { Tool, ToolHandler } from './types.js';
import { athenaQueryTool } from './athena-query.js';
import { athenaListTablesTool } from './athena-list-tables.js';
import { athenaDescribeTableTool } from './athena-describe-table.js';
import { logger } from '../logger.js';

/**
 * Registry of available tools
 */
export const toolRegistry = new Map<string, Tool>([
  ['athena-query', athenaQueryTool],
  ['athena-list-tables', athenaListTablesTool],
  ['athena-describe-table', athenaDescribeTableTool],
]);

/**
 * Default tool (used when tool name is unknown)
 */
export const defaultTool = athenaListTablesTool;

/**
 * Get a tool handler by name
 *
 * @param toolName - Tool name (null falls back to default tool)
 * @returns Tool handler function
 */
export function getToolHandler(toolName: string | null): ToolHandler {
  if (!toolName) {
    logger.info('TOOL_REGISTRY', {
      action: 'get_default_tool',
      defaultTool: defaultTool.name,
      reason: 'no_tool_name_provided',
    });
    return defaultTool.handler;
  }

  const tool = toolRegistry.get(toolName);

  if (!tool) {
    logger.warn('TOOL_REGISTRY', {
      action: 'tool_not_found',
      requestedTool: toolName,
      availableTools: Array.from(toolRegistry.keys()),
      fallbackTool: defaultTool.name,
    });
    return defaultTool.handler;
  }

  logger.info('TOOL_REGISTRY', {
    action: 'tool_found',
    toolName: tool.name,
    toolVersion: tool.version,
  });

  return tool.handler;
}

/**
 * Get all available tool names
 *
 * @returns Array of tool names
 */
export function getToolNames(): string[] {
  return Array.from(toolRegistry.keys());
}

/**
 * Initialize and validate the registry
 */
function initializeRegistry(): void {
  logger.info('TOOL_REGISTRY', {
    action: 'registry_initialized',
    totalTools: toolRegistry.size,
    toolNames: Array.from(toolRegistry.keys()),
    defaultTool: defaultTool.name,
  });
}

initializeRegistry();
