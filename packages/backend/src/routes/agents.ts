/**
 * Agent management API endpoints
 * API for managing user Agents in DynamoDB
 */

import { Router, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest, getCurrentAuth } from '../middleware/auth.js';
import {
  createAgentsService,
  CreateAgentInput,
  UpdateAgentInput,
  Agent as BackendAgent,
} from '../services/agents-service.js';

const router = Router();

/**
 * Convert Backend Agent to Frontend Agent
 * Map agentId -> id
 * Include userId if includeUserId is true (for shared agents)
 */
function toFrontendAgent(agent: BackendAgent, includeUserId: boolean = false) {
  const { userId, agentId, ...rest } = agent;
  return {
    id: agentId,
    ...(includeUserId && { userId }), // Include userId for shared agents
    ...rest,
  };
}

/**
 * Default Agent definitions
 * Defined in translation key format, translation applied in frontend
 */
const DEFAULT_AGENTS: CreateAgentInput[] = [
  {
    name: 'defaultAgents.generalAssistant.name',
    description: 'defaultAgents.generalAssistant.description',
    icon: 'Bot',
    systemPrompt: `You are a helpful and knowledgeable AI assistant. Please provide accurate and easy-to-understand answers to user questions.

Please keep the following in mind:
- Respond naturally in the user's language
- Explain technical content in a way that beginners can understand
- Honestly say "I don't know" when unsure
- Ask clarifying questions when needed`,
    enabledTools: ['file_editor', 's3_list_files', 's3_get_presigned_urls', 'tavily_search'],
    scenarios: [
      {
        title: 'defaultAgents.generalAssistant.scenarios.question.title',
        prompt: 'defaultAgents.generalAssistant.scenarios.question.prompt',
      },
      {
        title: 'defaultAgents.generalAssistant.scenarios.correction.title',
        prompt: 'defaultAgents.generalAssistant.scenarios.correction.prompt',
      },
      {
        title: 'defaultAgents.generalAssistant.scenarios.webSearch.title',
        prompt: 'defaultAgents.generalAssistant.scenarios.webSearch.prompt',
      },
      {
        title: 'defaultAgents.generalAssistant.scenarios.summary.title',
        prompt: 'defaultAgents.generalAssistant.scenarios.summary.prompt',
      },
      {
        title: 'defaultAgents.generalAssistant.scenarios.ideation.title',
        prompt: 'defaultAgents.generalAssistant.scenarios.ideation.prompt',
      },
      {
        title: 'defaultAgents.generalAssistant.scenarios.comparison.title',
        prompt: 'defaultAgents.generalAssistant.scenarios.comparison.prompt',
      },
    ],
  },
];

/**
 * Agent list retrieval endpoint
 * GET /agents
 * JWT authentication required
 */
router.get('/', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getCurrentAuth(req);
    const userId = auth.userId;

    if (!userId) {
      return res.status(400).json({
        error: 'Invalid authentication',
        message: 'Failed to retrieve user ID',
        requestId: auth.requestId,
      });
    }

    console.log(`📋 Agent list retrieval started (${auth.requestId}):`, {
      userId,
      username: auth.username,
    });

    const agentsService = createAgentsService();
    const agents = await agentsService.listAgents(userId);

    console.log(`✅ Agent list retrieval completed (${auth.requestId}): ${agents.length} items`);

    res.status(200).json({
      agents: agents.map((agent) => toFrontendAgent(agent)),
      metadata: {
        requestId: auth.requestId,
        timestamp: new Date().toISOString(),
        userId,
        count: agents.length,
      },
    });
  } catch (error) {
    const auth = getCurrentAuth(req);
    console.error(`💥 Agent list retrieval error (${auth.requestId}):`, error);

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to retrieve Agent list',
      requestId: auth.requestId,
    });
  }
});

/**
 * Specific Agent retrieval endpoint
 * GET /agents/:agentId
 * JWT authentication required
 */
router.get('/:agentId', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getCurrentAuth(req);
    const userId = auth.userId;
    const { agentId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'Invalid authentication',
        message: 'Failed to retrieve user ID',
        requestId: auth.requestId,
      });
    }

    if (!agentId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Agent ID is not specified',
        requestId: auth.requestId,
      });
    }

    console.log(`🔍 Agent retrieval started (${auth.requestId}):`, {
      userId,
      username: auth.username,
      agentId,
    });

    const agentsService = createAgentsService();
    const agent = await agentsService.getAgent(userId, agentId);

    if (!agent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
        requestId: auth.requestId,
      });
    }

    console.log(`✅ Agent retrieval completed (${auth.requestId}): ${agent.name}`);

    res.status(200).json({
      agent: toFrontendAgent(agent),
      metadata: {
        requestId: auth.requestId,
        timestamp: new Date().toISOString(),
        userId,
      },
    });
  } catch (error) {
    const auth = getCurrentAuth(req);
    console.error(`💥 Agent retrieval error (${auth.requestId}):`, error);

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to retrieve Agent',
      requestId: auth.requestId,
    });
  }
});

/**
 * Agent creation endpoint
 * POST /agents
 * JWT authentication required
 */
router.post('/', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getCurrentAuth(req);
    const userId = auth.userId;
    const input: CreateAgentInput = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Invalid authentication',
        message: 'Failed to retrieve user ID',
        requestId: auth.requestId,
      });
    }

    // Validation
    if (!input.name || !input.description || !input.systemPrompt || !input.enabledTools) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Required fields are missing',
        requestId: auth.requestId,
      });
    }

    console.log(`➕ Agent creation started (${auth.requestId}):`, {
      userId,
      username: auth.username,
      agentName: input.name,
    });

    const agentsService = createAgentsService();
    const agent = await agentsService.createAgent(userId, input, auth.username);

    console.log(`✅ Agent creation completed (${auth.requestId}): ${agent.agentId}`);

    res.status(201).json({
      agent: toFrontendAgent(agent),
      metadata: {
        requestId: auth.requestId,
        timestamp: new Date().toISOString(),
        userId,
      },
    });
  } catch (error) {
    const auth = getCurrentAuth(req);
    console.error(`💥 Agent creation error (${auth.requestId}):`, error);

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create Agent',
      requestId: auth.requestId,
    });
  }
});

/**
 * Agent update endpoint
 * PUT /agents/:agentId
 * JWT authentication required
 */
router.put('/:agentId', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getCurrentAuth(req);
    const userId = auth.userId;
    const { agentId } = req.params;
    const input: Partial<CreateAgentInput> = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Invalid authentication',
        message: 'Failed to retrieve user ID',
        requestId: auth.requestId,
      });
    }

    if (!agentId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Agent ID is not specified',
        requestId: auth.requestId,
      });
    }

    console.log(`📝 Agent update started (${auth.requestId}):`, {
      userId,
      username: auth.username,
      agentId,
    });

    const agentsService = createAgentsService();
    const updateInput: UpdateAgentInput = {
      agentId,
      ...input,
    };
    const agent = await agentsService.updateAgent(userId, updateInput);

    console.log(`✅ Agent update completed (${auth.requestId}): ${agent.name}`);

    res.status(200).json({
      agent: toFrontendAgent(agent),
      metadata: {
        requestId: auth.requestId,
        timestamp: new Date().toISOString(),
        userId,
      },
    });
  } catch (error) {
    const auth = getCurrentAuth(req);
    console.error(`💥 Agent update error (${auth.requestId}):`, error);

    if (error instanceof Error && error.message === 'Agent not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
        requestId: auth.requestId,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to update Agent',
      requestId: auth.requestId,
    });
  }
});

/**
 * Agent deletion endpoint
 * DELETE /agents/:agentId
 * JWT authentication required
 */
router.delete('/:agentId', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getCurrentAuth(req);
    const userId = auth.userId;
    const { agentId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'Invalid authentication',
        message: 'Failed to retrieve user ID',
        requestId: auth.requestId,
      });
    }

    if (!agentId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Agent ID is not specified',
        requestId: auth.requestId,
      });
    }

    console.log(`🗑️  Agent deletion started (${auth.requestId}):`, {
      userId,
      username: auth.username,
      agentId,
    });

    const agentsService = createAgentsService();
    await agentsService.deleteAgent(userId, agentId);

    console.log(`✅ Agent deletion completed (${auth.requestId}): ${agentId}`);

    res.status(200).json({
      success: true,
      metadata: {
        requestId: auth.requestId,
        timestamp: new Date().toISOString(),
        userId,
      },
    });
  } catch (error) {
    const auth = getCurrentAuth(req);
    console.error(`💥 Agent deletion error (${auth.requestId}):`, error);

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to delete Agent',
      requestId: auth.requestId,
    });
  }
});

/**
 * Agent share status toggle endpoint
 * PUT /agents/:agentId/share
 * JWT authentication required
 */
router.put(
  '/:agentId/share',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const auth = getCurrentAuth(req);
      const userId = auth.userId;
      const { agentId } = req.params;

      if (!userId) {
        return res.status(400).json({
          error: 'Invalid authentication',
          message: 'Failed to retrieve user ID',
          requestId: auth.requestId,
        });
      }

      if (!agentId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Agent ID is not specified',
          requestId: auth.requestId,
        });
      }

      console.log(`🔄 Agent share status toggle started (${auth.requestId}):`, {
        userId,
        username: auth.username,
        agentId,
      });

      const agentsService = createAgentsService();
      const agent = await agentsService.toggleShare(userId, agentId);

      console.log(
        `✅ Agent share status toggle completed (${auth.requestId}): isShared=${agent.isShared}`
      );

      res.status(200).json({
        agent: toFrontendAgent(agent),
        metadata: {
          requestId: auth.requestId,
          timestamp: new Date().toISOString(),
          userId,
        },
      });
    } catch (error) {
      const auth = getCurrentAuth(req);
      console.error(`💥 Agent share status toggle error (${auth.requestId}):`, error);

      if (error instanceof Error && error.message === 'Agent not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Agent not found',
          requestId: auth.requestId,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to change Agent share status',
        requestId: auth.requestId,
      });
    }
  }
);

/**
 * Default Agent initialization endpoint
 * POST /agents/initialize
 * JWT authentication required
 * Create default Agents on first login
 */
router.post('/initialize', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getCurrentAuth(req);
    const userId = auth.userId;

    if (!userId) {
      return res.status(400).json({
        error: 'Invalid authentication',
        message: 'Failed to retrieve user ID',
        requestId: auth.requestId,
      });
    }

    console.log(`🔧 Default Agent initialization started (${auth.requestId}):`, {
      userId,
      username: auth.username,
    });

    const agentsService = createAgentsService();

    // Check if existing Agents exist
    const existingAgents = await agentsService.listAgents(userId);

    if (existingAgents.length > 0) {
      console.log(`ℹ️  Skipping initialization because existing Agents exist (${auth.requestId})`);
      return res.status(200).json({
        agents: existingAgents.map((agent) => toFrontendAgent(agent)),
        skipped: true,
        message: 'Initialization skipped because existing Agents exist',
        metadata: {
          requestId: auth.requestId,
          timestamp: new Date().toISOString(),
          userId,
          count: existingAgents.length,
        },
      });
    }

    // Create default Agents
    const agents = await agentsService.initializeDefaultAgents(
      userId,
      DEFAULT_AGENTS,
      auth.username
    );

    console.log(
      `✅ Default Agent initialization completed (${auth.requestId}): ${agents.length} items`
    );

    res.status(201).json({
      agents: agents.map((agent) => toFrontendAgent(agent)),
      skipped: false,
      metadata: {
        requestId: auth.requestId,
        timestamp: new Date().toISOString(),
        userId,
        count: agents.length,
      },
    });
  } catch (error) {
    const auth = getCurrentAuth(req);
    console.error(`💥 Default Agent initialization error (${auth.requestId}):`, error);

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to initialize default Agents',
      requestId: auth.requestId,
    });
  }
});

/**
 * Shared Agent list retrieval endpoint (with pagination support)
 * GET /shared-agents/list
 * Query parameters:
 *   - q: Search query (optional)
 *   - limit: Number of items to retrieve (default: 20)
 *   - cursor: Pagination cursor (optional)
 * JWT authentication required
 */
router.get(
  '/shared-agents/list',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const auth = getCurrentAuth(req);
      const { q: searchQuery, limit, cursor } = req.query;

      console.log(`📋 Shared Agent list retrieval started (${auth.requestId}):`, {
        searchQuery,
        limit,
        hasCursor: !!cursor,
      });

      const agentsService = createAgentsService();
      const result = await agentsService.listSharedAgents(
        limit ? parseInt(limit as string, 10) : 20,
        searchQuery as string | undefined,
        cursor as string | undefined
      );

      console.log(
        `✅ Shared Agent list retrieval completed (${auth.requestId}): ${result.items.length} items`
      );

      res.status(200).json({
        agents: result.items.map((agent) => toFrontendAgent(agent, true)),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        metadata: {
          requestId: auth.requestId,
          timestamp: new Date().toISOString(),
          count: result.items.length,
        },
      });
    } catch (error) {
      const auth = getCurrentAuth(req);
      console.error(`💥 Shared Agent list retrieval error (${auth.requestId}):`, error);

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to retrieve shared Agent list',
        requestId: auth.requestId,
      });
    }
  }
);

/**
 * Shared Agent detail retrieval endpoint
 * GET /shared-agents/:userId/:agentId
 * JWT authentication required
 */
router.get(
  '/shared-agents/:userId/:agentId',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const auth = getCurrentAuth(req);
      const { userId, agentId } = req.params;

      if (!userId || !agentId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'User ID or Agent ID is not specified',
          requestId: auth.requestId,
        });
      }

      console.log(`🔍 Shared Agent detail retrieval started (${auth.requestId}):`, {
        userId,
        agentId,
      });

      const agentsService = createAgentsService();
      const agent = await agentsService.getSharedAgent(userId, agentId);

      if (!agent) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Shared Agent not found',
          requestId: auth.requestId,
        });
      }

      console.log(`✅ Shared Agent detail retrieval completed (${auth.requestId}): ${agent.name}`);

      res.status(200).json({
        agent: toFrontendAgent(agent, true),
        metadata: {
          requestId: auth.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const auth = getCurrentAuth(req);
      console.error(`💥 Shared Agent detail retrieval error (${auth.requestId}):`, error);

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to retrieve shared Agent details',
        requestId: auth.requestId,
      });
    }
  }
);

/**
 * Shared Agent clone endpoint
 * POST /shared-agents/:userId/:agentId/clone
 * JWT authentication required
 */
router.post(
  '/shared-agents/:userId/:agentId/clone',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const auth = getCurrentAuth(req);
      const targetUserId = auth.userId;
      const { userId: sourceUserId, agentId: sourceAgentId } = req.params;

      if (!targetUserId) {
        return res.status(400).json({
          error: 'Invalid authentication',
          message: 'Failed to retrieve user ID',
          requestId: auth.requestId,
        });
      }

      if (!sourceUserId || !sourceAgentId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Source User ID or Agent ID is not specified',
          requestId: auth.requestId,
        });
      }

      console.log(`📥 Shared Agent clone started (${auth.requestId}):`, {
        targetUserId,
        targetUsername: auth.username,
        sourceUserId,
        sourceAgentId,
      });

      const agentsService = createAgentsService();
      const clonedAgent = await agentsService.cloneAgent(
        targetUserId,
        sourceUserId,
        sourceAgentId,
        auth.username
      );

      console.log(`✅ Shared Agent clone completed (${auth.requestId}): ${clonedAgent.agentId}`);

      res.status(201).json({
        agent: toFrontendAgent(clonedAgent),
        metadata: {
          requestId: auth.requestId,
          timestamp: new Date().toISOString(),
          userId: targetUserId,
        },
      });
    } catch (error) {
      const auth = getCurrentAuth(req);
      console.error(`💥 Shared Agent clone error (${auth.requestId}):`, error);

      if (error instanceof Error && error.message === 'Shared agent not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Shared Agent not found',
          requestId: auth.requestId,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to clone shared Agent',
        requestId: auth.requestId,
      });
    }
  }
);

export default router;
