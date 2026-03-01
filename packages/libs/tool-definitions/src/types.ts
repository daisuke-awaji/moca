import { z } from 'zod';
import { zodToJsonSchema } from './utils/schema-converter.js';

/**
 * JSON Schema format tool definition (for MCP/Backend)
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool definition supporting both Zod and JSON Schema
 */
export interface ToolDefinition<T extends z.ZodType = z.ZodObject<z.ZodRawShape>> {
  name: string;
  description: string;
  zodSchema: T;
  jsonSchema: MCPToolDefinition['inputSchema'];
}

/**
 * Create a ToolDefinition from a Zod schema.
 * jsonSchema is automatically derived from zodSchema — no manual conversion needed.
 */
export function defineToolDefinition<T extends z.ZodType>(opts: {
  name: string;
  description: string;
  zodSchema: T;
}): ToolDefinition<T> {
  return {
    ...opts,
    jsonSchema: zodToJsonSchema(opts.zodSchema),
  };
}
