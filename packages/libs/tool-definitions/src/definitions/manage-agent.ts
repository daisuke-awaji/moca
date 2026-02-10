import { z } from 'zod';
import { zodToJsonSchema } from '../utils/schema-converter.js';
import type { ToolDefinition } from '../types.js';

const scenarioSchema = z.object({
  title: z.string().describe('Scenario title (e.g., "Code Review Request")'),
  prompt: z.string().describe('Prompt template for this scenario'),
});

export const manageAgentSchema = z.object({
  action: z
    .enum(['create', 'update', 'get'])
    .describe(
      "Action: 'create' to create new agent, 'update' to modify existing, 'get' to retrieve details"
    ),

  // Agent ID (required for update/get)
  agentId: z.string().optional().describe('Agent ID (required for update/get actions)'),

  // Agent configuration (required for create, optional for update)
  name: z.string().optional().describe('Agent name (e.g., "Code Reviewer", "Data Analyst")'),
  description: z.string().optional().describe('Brief description of what this agent does'),
  systemPrompt: z
    .string()
    .optional()
    .describe('System prompt that defines the agent behavior and capabilities'),
  enabledTools: z
    .array(z.string())
    .optional()
    .describe(
      'Array of tool names to enable (e.g., ["execute_command", "file_editor", "tavily_search"])'
    ),
  icon: z.string().optional().describe('Lucide icon name (e.g., "Bot", "Code", "Brain", "Search")'),
  scenarios: z
    .array(scenarioSchema)
    .optional()
    .describe('Predefined scenarios/prompts for quick access'),
});

export const manageAgentDefinition: ToolDefinition<typeof manageAgentSchema> = {
  name: 'manage_agent',
  description: `Create, update, or retrieve AI agent configurations.

**Available Actions:**
- 'create': Create a new agent with custom configuration
- 'update': Modify an existing agent's settings
- 'get': Retrieve details of a specific agent

**For 'create' action (required parameters):**
- name: Human-readable name for the agent
- description: What the agent does
- systemPrompt: Instructions that define agent behavior
- enabledTools: Which tools the agent can use
- icon (optional): Visual icon from Lucide icons
- scenarios (optional): Quick-access prompt templates

**For 'update' action:**
- agentId (required): ID of the agent to update
- Any combination of: name, description, systemPrompt, enabledTools, icon, scenarios
- Only provided fields will be updated (partial update supported)

**For 'get' action:**
- agentId (required): ID of the agent to retrieve

**Available Tools for enabledTools:**
- execute_command: Run shell commands
- file_editor: Create and edit files
- tavily_search: Web search
- tavily_extract: Extract content from URLs
- tavily_crawl: Crawl websites
- s3_list_files: List S3 files
- code_interpreter: Execute Python code
- nova_canvas: Generate images
- image_to_text: Analyze images
- call_agent: Invoke other agents
- nova_reel: Generate videos
- manage_agent: Manage agents

**Returns:**
- For create/update: agentId, name, success status
- For get: Full agent configuration`,
  zodSchema: manageAgentSchema,
  jsonSchema: zodToJsonSchema(manageAgentSchema),
};
