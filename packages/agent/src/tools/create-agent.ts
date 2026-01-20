/**
 * Create Agent Tool
 * Allows agents to create new agents programmatically
 */

import { tool } from '@strands-agents/sdk';
import { logger } from '../config/index.js';
import { getCurrentContext, getCurrentAuthHeader } from '../context/request-context.js';
import { createAgentDefinition } from '@fullstack-agentcore/tool-definitions';

/**
 * Get backend API URL
 */
function getBackendApiUrl(): string {
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    return backendUrl;
  }
  return 'http://localhost:3000';
}

/**
 * Backend API response type
 */
interface CreateAgentResponse {
  agent: {
    agentId: string;
    name: string;
    description: string;
    systemPrompt: string;
    enabledTools: string[];
    icon?: string;
    scenarios?: Array<{ id: string; title: string; prompt: string }>;
    createdAt: string;
    updatedAt: string;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    userId: string;
  };
}

/**
 * Create Agent Tool Implementation
 */
export const createAgentTool = tool({
  name: createAgentDefinition.name,
  description: createAgentDefinition.description,
  inputSchema: createAgentDefinition.zodSchema,
  callback: async (input) => {
    const { name, description, systemPrompt, enabledTools, icon, scenarios } = input;

    logger.info('🤖 create_agent tool called:', {
      name,
      enabledTools,
    });

    // Validate required fields
    if (!name || !description || !systemPrompt || !enabledTools) {
      return JSON.stringify({
        success: false,
        error: 'Missing required parameters',
        message: 'name, description, systemPrompt, and enabledTools are required',
      });
    }

    // Get auth header from request context
    const authHeader = getCurrentAuthHeader();
    if (!authHeader) {
      return JSON.stringify({
        success: false,
        error: 'Authentication required',
        message: 'No authentication token available. Cannot create agent.',
      });
    }

    // Get current context for logging
    const currentContext = getCurrentContext();

    try {
      const backendUrl = getBackendApiUrl();
      const url = `${backendUrl}/agents`;

      logger.info('📤 Creating agent via backend API:', {
        url,
        agentName: name,
        userId: currentContext?.userId,
      });

      // Prepare request body
      const requestBody = {
        name,
        description,
        systemPrompt,
        enabledTools,
        icon,
        scenarios: scenarios || [],
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ Failed to create agent:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return JSON.stringify({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: errorText,
        });
      }

      const data = (await response.json()) as CreateAgentResponse;

      logger.info('✅ Agent created successfully:', {
        agentId: data.agent.agentId,
        name: data.agent.name,
      });

      return JSON.stringify({
        success: true,
        agentId: data.agent.agentId,
        name: data.agent.name,
        description: data.agent.description,
        enabledTools: data.agent.enabledTools,
        icon: data.agent.icon,
        createdAt: data.agent.createdAt,
        message: `Agent "${data.agent.name}" created successfully with ID: ${data.agent.agentId}`,
      });
    } catch (error) {
      logger.error('❌ Error creating agent:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return JSON.stringify({
        success: false,
        error: 'Failed to create agent',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  },
});
