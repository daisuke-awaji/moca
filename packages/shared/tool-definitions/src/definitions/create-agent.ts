import { z } from 'zod';
import { zodToJsonSchema } from '../utils/schema-converter.js';
import type { ToolDefinition } from '../types.js';

const scenarioSchema = z.object({
  title: z.string().describe('Scenario title (e.g., "Code Review Request")'),
  prompt: z.string().describe('Prompt template for this scenario'),
});

export const createAgentSchema = z.object({
  name: z.string().describe('Agent name (e.g., "Code Reviewer", "Data Analyst")'),
  description: z.string().describe('Brief description of what this agent does'),
  systemPrompt: z
    .string()
    .describe('System prompt that defines the agent behavior and capabilities'),
  enabledTools: z
    .array(z.string())
    .describe(
      'Array of tool names to enable (e.g., ["execute_command", "file_editor", "tavily_search"])'
    ),
  icon: z.string().optional().describe('Lucide icon name (e.g., "Bot", "Code", "Brain", "Search")'),
  scenarios: z
    .array(scenarioSchema)
    .optional()
    .describe('Predefined scenarios/prompts for quick access'),
});

export const createAgentDefinition: ToolDefinition<typeof createAgentSchema> = {
  name: 'create_agent',
  description: `Create a new AI agent with specific capabilities and configuration.

**Use Cases:**
- Create specialized agents for specific tasks (e.g., code reviewer, data analyst)
- Set up agents with custom system prompts tailored to particular domains
- Configure agents with specific tool sets

**Parameters:**
- name: Human-readable name for the agent
- description: What the agent does
- systemPrompt: Instructions that define agent behavior
- enabledTools: Which tools the agent can use
- icon (optional): Visual icon from Lucide icons
- scenarios (optional): Quick-access prompt templates

**Available Tools:**
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
- create_agent: Create new agents

**Returns:**
- agentId: Unique identifier for the created agent
- name: Agent name
- success: Whether creation was successful`,
  zodSchema: createAgentSchema,
  jsonSchema: zodToJsonSchema(createAgentSchema),
};
