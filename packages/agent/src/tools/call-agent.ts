/**
 * Call Agent Tool
 * Invoke sub-agents asynchronously with action-based workflow
 */

import { tool, ToolContext } from '@strands-agents/sdk';
import { z } from 'zod';
import { subAgentTaskManager } from '../services/sub-agent-task-manager.js';
import { listAgents } from '../services/agent-registry.js';
import { logger } from '../config/index.js';

/**
 * Sleep utility for polling
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handle list_agents action
 */
async function handleListAgents(): Promise<Record<string, unknown>> {
  try {
    const agents = await listAgents();

    return {
      agents: agents.map((agent) => ({
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
      })),
      count: agents.length,
    };
  } catch (error) {
    logger.error('❌ Failed to list agents:', { error });
    return {
      error: 'Failed to list agents',
      message: error instanceof Error ? error.message : 'Unknown error',
      agents: [],
      count: 0,
    };
  }
}

/**
 * Handle start_task action
 */
async function handleStartTask(
  input: {
    agentId?: string;
    query?: string;
    modelId?: string;
    storagePath?: string;
  },
  context?: ToolContext
): Promise<Record<string, unknown>> {
  // Validate required parameters
  if (!input.agentId || !input.query) {
    return {
      error: 'Missing required parameters',
      message: 'agentId and query are required for start_task action',
    };
  }

  // Check recursion depth
  const currentDepth = (context?.agent?.state?.get('subAgentDepth') as number) || 0;
  const maxDepth = 2; // Default max depth

  if (currentDepth >= maxDepth) {
    return {
      error: 'Maximum recursion depth reached',
      message: `Cannot invoke sub-agent at depth ${currentDepth}. Max depth is ${maxDepth}.`,
      currentDepth,
      maxDepth,
    };
  }

  try {
    // Get session ID from agent state if available
    const parentSessionId = context?.agent?.state?.get('sessionId') as string | undefined;

    // Get storagePath from input or inherit from parent
    const storagePath = input.storagePath || context?.agent?.state?.get('storagePath');

    // Create task
    const taskId = await subAgentTaskManager.createTask(input.agentId, input.query, {
      modelId: input.modelId,
      parentSessionId,
      currentDepth,
      maxDepth,
      storagePath: storagePath as string | undefined,
    });

    return {
      taskId,
      status: 'started',
      agentId: input.agentId,
      message: `Sub-agent task started. Use call_agent with action='status' and taskId="${taskId}" to check results.`,
    };
  } catch (error) {
    logger.error('❌ Failed to start sub-agent task:', { error });
    return {
      error: 'Failed to start task',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle status action with optional polling
 */
async function handleStatus(
  input: {
    taskId?: string;
    waitForCompletion?: boolean;
    pollingInterval?: number;
    maxWaitTime?: number;
  },
  _context?: ToolContext
): Promise<Record<string, unknown>> {
  // Validate required parameters
  if (!input.taskId) {
    return {
      error: 'Missing required parameter',
      message: 'taskId is required for status action',
    };
  }

  const waitForCompletion = input.waitForCompletion ?? false;
  const pollingInterval = (input.pollingInterval ?? 30) * 1000; // Convert to ms
  const maxWaitTime = (input.maxWaitTime ?? 1200) * 1000; // Convert to ms

  const startTime = Date.now();
  let pollCount = 0;

  try {
    while (true) {
      pollCount++;

      // Get current task status
      const task = await subAgentTaskManager.getTask(input.taskId);

      if (!task) {
        return {
          error: 'Task not found',
          message: `No task found with ID: ${input.taskId}`,
          taskId: input.taskId,
        };
      }

      const elapsedTime = Math.floor((Date.now() - task.createdAt) / 1000);

      // If task is completed or failed, return immediately
      if (task.status === 'completed') {
        return {
          taskId: task.taskId,
          status: 'completed',
          agentId: task.agentId,
          result: task.result,
          elapsedTime,
          pollCount: waitForCompletion ? pollCount : undefined,
        };
      }

      if (task.status === 'failed') {
        return {
          taskId: task.taskId,
          status: 'failed',
          agentId: task.agentId,
          error: task.error,
          elapsedTime,
          pollCount: waitForCompletion ? pollCount : undefined,
        };
      }

      // If not waiting for completion, return current status
      if (!waitForCompletion) {
        return {
          taskId: task.taskId,
          status: task.status,
          agentId: task.agentId,
          progress: task.progress,
          elapsedTime,
          message: task.progress || `Task is ${task.status}`,
        };
      }

      // Check if max wait time exceeded
      const totalElapsed = Date.now() - startTime;
      if (totalElapsed >= maxWaitTime) {
        return {
          taskId: task.taskId,
          status: task.status,
          agentId: task.agentId,
          message: `Task still ${task.status} after max wait time (${input.maxWaitTime}s). Check again later.`,
          elapsedTime,
          pollCount,
          timedOut: true,
        };
      }

      // Wait before next poll
      logger.info('⏳ Polling sub-agent task:', {
        taskId: input.taskId,
        status: task.status,
        pollCount,
        elapsedTime,
      });

      await sleep(pollingInterval);
    }
  } catch (error) {
    logger.error('❌ Failed to check task status:', { error });
    return {
      error: 'Failed to check status',
      message: error instanceof Error ? error.message : 'Unknown error',
      taskId: input.taskId,
    };
  }
}

/**
 * Call Agent Tool
 * Unified tool for starting and checking sub-agent tasks
 */
export const callAgentTool = tool({
  name: 'call_agent',
  description: `Invoke specialized sub-agents asynchronously to handle specific tasks that require different expertise.

**Available Actions:**
- 'list_agents': Get list of available agents with their IDs and descriptions
- 'start_task': Start a new sub-agent task (returns taskId)
- 'status': Check task status (with optional polling until completion)

**To discover available agents:**
First use action='list_agents' to get the current list of agents with their agentIds.
Then use those agentIds with action='start_task' to invoke them.

**Usage Pattern:**
1. List agents: action='list_agents'
2. Start task: action='start_task', agentId='<agentId from list>', query='...'
3. Check status: action='status', taskId='task_xxx'
   - Set waitForCompletion=true to wait for results (with polling)
   - Set waitForCompletion=false for immediate status check

**Important:**
- Sub-agents run independently with no shared history
- Tasks can run for minutes or hours
- Use polling (waitForCompletion=true) for shorter tasks
- Use immediate checks (waitForCompletion=false) for long-running tasks`,
  inputSchema: z.object({
    action: z
      .enum(['list_agents', 'start_task', 'status'])
      .describe("Action: 'list_agents' to list, 'start_task' to start, 'status' to check"),

    // start_task parameters
    agentId: z
      .string()
      .optional()
      .describe('Agent ID (required for start_task, e.g., "web-researcher")'),
    query: z.string().optional().describe('Query to send to the agent (required for start_task)'),
    modelId: z.string().optional().describe('Model ID to use (optional, defaults to agent config)'),
    storagePath: z
      .string()
      .optional()
      .describe(
        'S3 storage path for sub-agent (e.g., "/project-a/"). Inherits from parent if not specified.'
      ),

    // status parameters
    taskId: z.string().optional().describe('Task ID (required for status action)'),

    // Polling options (for status action)
    waitForCompletion: z
      .boolean()
      .default(false)
      .describe('Wait for completion with polling (default: false)'),
    pollingInterval: z.number().default(30).describe('Polling interval in seconds (default: 30)'),
    maxWaitTime: z.number().default(1200).describe('Max wait time in seconds (default: 1200)'),
  }),
  callback: async (input, context?: ToolContext) => {
    let result: Record<string, unknown>;

    if (input.action === 'list_agents') {
      result = await handleListAgents();
    } else if (input.action === 'start_task') {
      result = await handleStartTask(input, context);
    } else {
      result = await handleStatus(input, context);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result as any;
  },
});
