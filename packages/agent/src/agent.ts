/**
 * Strands AI Agent for AgentCore Runtime
 * AI Agent that runs on AgentCore Runtime and uses AgentCore Gateway tools
 */

import { Agent, HookProvider, Message, McpClient } from '@strands-agents/sdk';
import { logger, config } from './config/index.js';
import { localTools, convertMCPToolsToStrands } from './tools/index.js';
import { buildSystemPrompt } from './prompts/index.js';
import { createBedrockModel } from './models/index.js';
import { MCPToolDefinition } from './schemas/types.js';
import { mcpClient } from './mcp/client.js';
import { getEnabledMCPServers, createMCPClients } from './mcp/index.js';
import { getCurrentStoragePath } from './context/request-context.js';
import type { SessionStorage, SessionConfig } from './session/types.js';
import { retrieveLongTermMemory } from './session/memory-retriever.js';
import type { MCPConfig } from './mcp/types.js';

/**
 * Strands Agent creation options for AgentCore Runtime
 */
export interface CreateAgentOptions {
  modelId?: string; // Model ID to use (uses environment variable if not specified)
  enabledTools?: string[]; // Array of tool names to enable (undefined=all, []=none)
  systemPrompt?: string; // Custom system prompt (auto-generated if not specified)
  // For session restoration (for parallel processing)
  sessionStorage?: SessionStorage;
  sessionConfig?: SessionConfig;
  // For long-term memory reference
  memoryEnabled?: boolean; // Whether to enable long-term memory (default: false)
  memoryContext?: string; // Search query (e.g., user's latest message)
  actorId?: string; // User ID
  memoryTopK?: number; // Number of long-term memories to retrieve (default: 10)
  // User-defined MCP server configuration
  mcpConfig?: Record<string, unknown>; // Configuration in mcp.json format
}

/**
 * Filter tools
 */
function filterTools<T extends { name: string }>(tools: T[], enabledTools?: string[]): T[] {
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
 * Load session history
 */
async function loadSessionHistory(
  sessionStorage?: SessionStorage,
  sessionConfig?: SessionConfig
): Promise<Message[]> {
  if (!sessionStorage || !sessionConfig) {
    return [];
  }
  return sessionStorage.loadMessages(sessionConfig);
}

/**
 * Retrieve long-term memories
 */
async function fetchLongTermMemories(options?: CreateAgentOptions): Promise<{
  memories: string[];
  conditions: {
    memoryEnabled: boolean;
    hasActorId: boolean;
    hasMemoryContext: boolean;
    hasMemoryId: boolean;
  };
}> {
  // Check conditions
  const conditions = {
    memoryEnabled: !!options?.memoryEnabled,
    hasActorId: !!options?.actorId,
    hasMemoryContext: !!options?.memoryContext,
    hasMemoryId: !!config.AGENTCORE_MEMORY_ID,
  };

  logger.info('🧠 Long-term memory retrieval condition check:', conditions);

  if (!options?.memoryEnabled) {
    logger.info('🧠 Long-term memory is disabled');
    return { memories: [], conditions };
  }

  // If required conditions not met
  if (!conditions.hasMemoryId) {
    logger.warn('⚠️ AGENTCORE_MEMORY_ID is not configured');
    return { memories: [], conditions };
  }
  if (!conditions.hasActorId) {
    logger.warn('⚠️ actorId is not provided');
    return { memories: [], conditions };
  }
  if (!conditions.hasMemoryContext) {
    logger.warn('⚠️ memoryContext is not provided');
    return { memories: [], conditions };
  }

  // Retrieve long-term memories (use non-null assertion since conditions are checked)
  const memories = await retrieveLongTermMemory(
    config.AGENTCORE_MEMORY_ID!,
    options.actorId!,
    options.memoryContext!,
    options.memoryTopK || 10,
    config.BEDROCK_REGION
  );

  return { memories, conditions };
}

/**
 * Agent creation result
 */
export interface CreateAgentResult {
  agent: Agent;
  metadata: {
    loadedMessagesCount: number;
    longTermMemoriesCount: number;
    toolsCount: number;
    memoryConditions?: {
      memoryEnabled: boolean;
      hasActorId: boolean;
      hasMemoryContext: boolean;
      hasMemoryId: boolean;
    };
  };
}

/**
 * Create Strands Agent for AgentCore Runtime
 * @param hooks Array of HookProviders (e.g., session persistence)
 * @param options Agent creation options (model ID, tools, system prompt, session config)
 */
export async function createAgent(
  hooks?: HookProvider[],
  options?: CreateAgentOptions
): Promise<CreateAgentResult> {
  logger.info('Initializing Strands Agent...');

  try {
    // 1. Generate user-defined MCP clients (mcpConfig received from request)
    let userMCPClients: McpClient[] = [];
    if (options?.mcpConfig) {
      try {
        logger.info('🔧 Processing user-defined MCP configuration...');
        const userMCPServers = getEnabledMCPServers(options.mcpConfig as unknown as MCPConfig);
        userMCPClients = createMCPClients(userMCPServers);
        logger.info(`✅ User-defined MCP clients: ${userMCPClients.length} items`);
      } catch (error) {
        logger.error('❌ Failed to generate user-defined MCP clients:', error);
        // Skip and continue even if error occurs
      }
    }

    // 2. Execute in parallel: restore session history, get Gateway MCP tools, retrieve long-term memories
    const [savedMessages, gatewayMCPTools, longTermMemoriesResult] = await Promise.all([
      loadSessionHistory(options?.sessionStorage, options?.sessionConfig),
      mcpClient.listTools(),
      fetchLongTermMemories(options),
    ]);

    const longTermMemories = longTermMemoriesResult.memories;
    const memoryConditions = longTermMemoriesResult.conditions;

    logger.info(`📖 Session history restored: ${savedMessages.length} messages`);
    if (longTermMemories.length > 0) {
      logger.info(`🧠 Long-term memories retrieved: ${longTermMemories.length} items`);
    }

    // 3. Convert Gateway MCP tools to Strands format
    const gatewayStrandsTools = convertMCPToolsToStrands(gatewayMCPTools as MCPToolDefinition[]);

    // 4. Integrate all tools
    // - Local Python tools etc. (filtered by enabledTools)
    // - Tools via AgentCore Gateway (filtered by enabledTools)
    // - User-defined MCP servers (from request, always all enabled)
    const filteredTools = filterTools(
      [...localTools, ...gatewayStrandsTools],
      options?.enabledTools
    );
    const allTools = [...filteredTools, ...userMCPClients] as unknown[];

    logger.info(
      `✅ Prepared total of ${allTools.length} tools (Local: ${localTools.length}, Gateway: ${gatewayStrandsTools.length}, User MCP: ${userMCPClients.length})`
    );

    // 3. Create Bedrock model
    const model = createBedrockModel({ modelId: options?.modelId });
    logger.info(`🤖 Using model: ${options?.modelId || 'default'}`);

    // 5. Generate system prompt (including storage path info and long-term memories)
    const storagePath = getCurrentStoragePath();
    const systemPrompt = buildSystemPrompt({
      customPrompt: options?.systemPrompt,
      tools: allTools as Array<{ name: string; description?: string }>,
      mcpTools: gatewayMCPTools as MCPToolDefinition[],
      storagePath,
      longTermMemories,
    });

    if (options?.systemPrompt) {
      logger.info('📝 Using custom system prompt');
    } else {
      logger.info('📝 Generated default system prompt');
    }
    logger.info('📝 Generated system prompt with default context');

    logger.info({ systemPrompt });

    // 6. Create Agent

    const agent = new Agent({
      model,
      systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: allTools as any,
      messages: savedMessages,
      hooks,
    });

    // Set storagePath in agent state for sub-agent inheritance
    if (storagePath) {
      agent.state.set('storagePath', storagePath);
      logger.info('📂 Set storagePath in agent state:', { storagePath });
    }

    // 7. Log output
    if (hooks && hooks.length > 0) {
      logger.info(`✅ Registered ${hooks.length} hooks`);
    }

    logger.info('✅ Strands Agent initialization completed');

    // Return metadata
    return {
      agent,
      metadata: {
        loadedMessagesCount: savedMessages.length,
        longTermMemoriesCount: longTermMemories.length,
        toolsCount: allTools.length,
        memoryConditions,
      },
    };
  } catch (error) {
    logger.error('❌ Strands Agent initialization failed:', error);
    throw error;
  }
}
