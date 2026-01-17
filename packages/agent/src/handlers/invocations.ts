/**
 * Agent invocation endpoint handler
 */

import { Request, Response } from 'express';
import { createAgent } from '../agent.js';
import { getContextMetadata, getCurrentContext } from '../context/request-context.js';
import { setupSession, getSessionStorage } from '../session/session-helper.js';
import { initializeWorkspaceSync } from '../services/workspace-sync-helper.js';
import { logger } from '../config/index.js';
import {
  createErrorMessage,
  sanitizeErrorMessage,
  serializeStreamEvent,
  buildInputContent,
} from '../utils/index.js';
import { validateImageData } from '../validation/index.js';
import type { InvocationRequest } from './types.js';

/**
 * Required OAuth scope for machine user invocation
 */
export const REQUIRED_MACHINE_USER_SCOPE = 'agent/invoke';

/**
 * Validate OAuth scopes for machine user
 * @param scopes - Array of OAuth scopes from the token
 * @returns Validation result with error if scopes are insufficient
 */
export function validateMachineUserScopes(scopes?: string[]): {
  valid: boolean;
  error?: { status: number; message: string };
} {
  if (!scopes || scopes.length === 0) {
    return {
      valid: false,
      error: {
        status: 403,
        message: `Insufficient scope: '${REQUIRED_MACHINE_USER_SCOPE}' scope is required for machine user invocation`,
      },
    };
  }

  if (!scopes.includes(REQUIRED_MACHINE_USER_SCOPE)) {
    return {
      valid: false,
      error: {
        status: 403,
        message: `Insufficient scope: '${REQUIRED_MACHINE_USER_SCOPE}' scope is required, but only [${scopes.join(', ')}] provided`,
      },
    };
  }

  return { valid: true };
}

/**
 * Validate targetUserId format
 * - Must be non-empty
 * - Must be a valid email format (basic validation for Cognito username)
 * @param targetUserId - Target user ID to validate
 * @returns Validation result with error if invalid
 */
export function validateTargetUserId(targetUserId: string): {
  valid: boolean;
  error?: { status: number; message: string };
} {
  // Check for empty or whitespace-only
  if (!targetUserId.trim()) {
    return {
      valid: false,
      error: {
        status: 400,
        message: 'targetUserId cannot be empty or whitespace',
      },
    };
  }

  // Basic email format validation (Cognito typically uses email as username)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(targetUserId)) {
    return {
      valid: false,
      error: {
        status: 400,
        message: 'targetUserId must be a valid email format',
      },
    };
  }

  // Check for potential injection attempts (basic sanitization)
  const dangerousPatterns = [
    /[<>]/, // HTML injection
    /[\r\n]/, // Header injection
    /javascript:/i, // XSS attempt
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(targetUserId)) {
      return {
        valid: false,
        error: {
          status: 400,
          message: 'targetUserId contains invalid characters',
        },
      };
    }
  }

  return { valid: true };
}

/**
 * Resolve effective user ID based on authentication type
 * - Machine user (Client Credentials Flow): Use targetUserId from request body
 * - Regular user: Use userId from JWT
 */
export function resolveEffectiveUserId(
  context: ReturnType<typeof getCurrentContext>,
  targetUserId?: string
): { userId: string; error?: { status: number; message: string } } {
  const isMachineUser = context?.isMachineUser ?? false;

  if (isMachineUser) {
    // Machine user: Validate OAuth scopes first
    const scopeValidation = validateMachineUserScopes(context?.scopes);
    if (!scopeValidation.valid && scopeValidation.error) {
      return {
        userId: '',
        error: scopeValidation.error,
      };
    }

    // Machine user: targetUserId is required
    if (!targetUserId) {
      return {
        userId: '',
        error: {
          status: 400,
          message: 'targetUserId is required for machine user (Client Credentials Flow)',
        },
      };
    }

    // Validate targetUserId format
    const targetUserIdValidation = validateTargetUserId(targetUserId);
    if (!targetUserIdValidation.valid && targetUserIdValidation.error) {
      return {
        userId: '',
        error: targetUserIdValidation.error,
      };
    }

    logger.info('Machine user authentication detected:', {
      clientId: context?.clientId,
      targetUserId,
      scopes: context?.scopes,
    });
    return { userId: targetUserId };
  }

  // Regular user: targetUserId is not allowed
  if (targetUserId) {
    return {
      userId: '',
      error: {
        status: 403,
        message: 'targetUserId is not allowed for regular users',
      },
    };
  }

  return { userId: context?.userId || 'anonymous' };
}

/**
 * Agent invocation endpoint (with streaming support)
 * Create Agent for each session and persist history
 */
export async function handleInvocation(req: Request, res: Response): Promise<void> {
  try {
    // Get each parameter from request body
    const {
      prompt,
      modelId,
      enabledTools,
      systemPrompt,
      storagePath,
      memoryEnabled,
      memoryTopK,
      mcpConfig,
      images,
      targetUserId,
    } = req.body as InvocationRequest;

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Empty prompt provided' });
      return;
    }

    // Server-side image validation
    if (images && images.length > 0) {
      const validation = validateImageData(images);
      if (!validation.valid) {
        logger.warn('Image validation failed:', { error: validation.error });
        res.status(400).json({ error: validation.error });
        return;
      }
      logger.info(`Image validation passed: ${images.length} image(s)`);
    }

    // Get context information (retrieve once)
    const context = getCurrentContext();
    const requestId = context?.requestId || 'unknown';

    // Resolve effective user ID based on authentication type
    const userIdResult = resolveEffectiveUserId(context, targetUserId);
    if (userIdResult.error) {
      logger.warn('User ID resolution failed:', {
        requestId,
        error: userIdResult.error.message,
        isMachineUser: context?.isMachineUser,
        targetUserId,
      });
      res.status(userIdResult.error.status).json({ error: userIdResult.error.message });
      return;
    }
    const actorId = userIdResult.userId;

    // Set userId and storagePath in context
    if (context) {
      context.userId = actorId;
      context.storagePath = storagePath || '/';
    }

    // Get session ID from header (optional)
    const sessionId = req.headers['x-amzn-bedrock-agentcore-runtime-session-id'] as
      | string
      | undefined;

    logger.info('Request received:', {
      requestId,
      prompt,
      actorId,
      sessionId: sessionId || 'none (sessionless mode)',
      isMachineUser: context?.isMachineUser,
      clientId: context?.clientId,
    });

    // Initialize workspace sync (if storagePath is specified)
    const workspaceSyncResult = initializeWorkspaceSync(actorId, storagePath, context);

    // Setup session (if sessionId exists)
    const sessionResult = setupSession(actorId, sessionId);
    const sessionStorage = getSessionStorage();

    // Agent creation options
    const agentOptions = {
      modelId,
      enabledTools,
      systemPrompt,
      ...(sessionResult && {
        sessionStorage,
        sessionConfig: sessionResult.config,
      }),
      // Long-term memory parameters (use JWT userId as actorId)
      memoryEnabled,
      memoryContext: memoryEnabled ? prompt : undefined,
      actorId: memoryEnabled ? actorId : undefined,
      memoryTopK,
      // User-defined MCP server configuration
      mcpConfig,
    };

    // Create Agent (register all hooks)
    const hooks = [sessionResult?.hook, workspaceSyncResult?.hook].filter(
      (hook) => hook !== null && hook !== undefined
    );
    const { agent, metadata } = await createAgent(hooks, agentOptions);

    // Log Agent creation completion
    logger.info('Agent creation completed:', {
      requestId,
      loadedMessages: metadata.loadedMessagesCount,
      longTermMemories: metadata.longTermMemoriesCount,
      tools: metadata.toolsCount,
    });

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      logger.info('Agent streaming started:', { requestId });

      // Build input content (text + images for multimodal)
      const agentInput = buildInputContent(prompt, images);

      // Send streaming events as NDJSON
      for await (const event of agent.stream(agentInput)) {
        // For messageAddedEvent, save in real-time (only if session exists)
        if (event.type === 'messageAddedEvent' && event.message && sessionResult) {
          try {
            await sessionStorage.appendMessage(sessionResult.config, event.message);
            logger.info('Message saved in real-time:', {
              role: event.message.role,
              contentBlocks: event.message.content.length,
            });
          } catch (saveError) {
            logger.error('Message save failed (streaming continues):', saveError);
            // Continue streaming even if save error occurs
          }
        }

        // Serialize event avoiding circular references
        const safeEvent = serializeStreamEvent(event);
        res.write(`${JSON.stringify(safeEvent)}\n`);
      }

      logger.info('Agent streaming completed:', { requestId });

      // Get metadata with duration for completion event
      const contextMeta = getContextMetadata();

      // Send completion metadata
      const completionEvent = {
        type: 'serverCompletionEvent',
        metadata: {
          requestId,
          duration: contextMeta.duration,
          sessionId: sessionId,
          actorId: actorId,
          conversationLength: agent.messages.length,
          agentMetadata: metadata,
        },
      };
      res.write(`${JSON.stringify(completionEvent)}\n`);

      res.end();
    } catch (streamError) {
      logger.error('Agent streaming error:', {
        requestId,
        error: streamError,
      });

      // Save error message to session history (if session is configured)
      if (sessionResult) {
        try {
          const errorMessage = createErrorMessage(streamError, requestId);
          await sessionStorage.appendMessage(sessionResult.config, errorMessage);
          logger.info('Error message saved to session history:', {
            requestId,
            sessionId: sessionResult.config.sessionId,
          });
        } catch (saveError) {
          logger.error('Failed to save error message to session:', saveError);
          // Continue even if save fails - still send error event to client
        }
      }

      // Send error event
      const errorEvent = {
        type: 'serverErrorEvent',
        error: {
          message: sanitizeErrorMessage(streamError),
          requestId,
          // Include flag to indicate this error was saved to history
          savedToHistory: !!sessionResult,
        },
      };
      res.write(`${JSON.stringify(errorEvent)}\n`);
      res.end();
    }
  } catch (error) {
    const contextMeta = getContextMetadata();
    logger.error('Error processing request:', {
      requestId: contextMeta.requestId,
      error,
    });

    // JSON response for initial error
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId: contextMeta.requestId,
      });
      return;
    }
  }
}
