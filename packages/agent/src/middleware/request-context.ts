/**
 * Request Context Middleware
 * Express middleware that sets request context
 */

import { Request, Response, NextFunction } from 'express';
import { createRequestContext, runWithContext } from '../context/request-context.js';
import { logger } from '../config/index.js';

/**
 * Extract userId from JWT (simple implementation)
 * For production use, using jwt library is recommended
 */
function extractUserIdFromJWT(authHeader?: string): string | undefined {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }

  try {
    const token = authHeader.substring(7); // Remove 'Bearer '
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    // Extract userId from common JWT claims
    return payload.sub || payload.userId || payload.user_id || payload.username;
  } catch (error) {
    logger.warn('JWT parsing failed:', { error });
    return undefined;
  }
}

/**
 * Middleware to set request context
 * Extract Authorization header and set context with AsyncLocalStorage
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get Authorization header from multiple sources
  const authHeader =
    req.headers.authorization ||
    (req.headers['x-amzn-bedrock-agentcore-runtime-custom-authorization'] as string);

  // Extract userId from JWT
  const userId = extractUserIdFromJWT(authHeader);

  // Create request context
  const requestContext = createRequestContext(authHeader);
  // Set userId
  if (userId) {
    requestContext.userId = userId;
  }

  // Log request context
  logger.info('📝 Request context middleware activated:', {
    requestId: requestContext.requestId,
    userId: requestContext.userId,
    hasAuth: !!authHeader,
    authType: authHeader?.split(' ')[0] || 'None',
    path: req.path,
    method: req.method,
  });

  // Set context with AsyncLocalStorage and execute next()
  runWithContext(requestContext, () => {
    next();
  });
}
