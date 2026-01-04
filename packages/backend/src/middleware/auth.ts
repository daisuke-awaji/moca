/**
 * JWT Authentication Middleware
 * Express middleware that executes JWT authentication
 */

import { Request, Response, NextFunction } from 'express';
import { verifyJWT, extractJWTFromHeader, CognitoJWTPayload } from '../utils/jwks.js';
import { config } from '../config/index.js';

/**
 * Authenticated request type definition
 * Add JWT information to Express Request object
 */
export interface AuthenticatedRequest extends Request {
  /** JWT payload */
  jwt?: CognitoJWTPayload;
  /** User ID */
  userId?: string;
  /** Request ID (for log tracking) */
  requestId?: string;
}

/**
 * Authentication error response type definition
 */
interface AuthErrorResponse {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate authentication error response
 */
function createAuthErrorResponse(
  code: string,
  message: string,
  requestId: string
): AuthErrorResponse {
  return {
    error: 'Authentication Error',
    message,
    code,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * JWT authentication middleware
 * Verify JWT in Authorization header and add authentication information to request
 */
export function jwtAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const requestId = generateRequestId();
  req.requestId = requestId;

  console.log(`🔐 JWT authentication started (${requestId}):`, {
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent')?.substring(0, 50),
  });

  // Get Authorization header
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    console.warn(`❌ Authorization header not set (${requestId})`);
    res
      .status(401)
      .json(
        createAuthErrorResponse(
          'MISSING_AUTHORIZATION',
          'Authorization header is required',
          requestId
        )
      );
    return;
  }

  // Extract JWT token
  const token = extractJWTFromHeader(authHeader);

  if (!token) {
    console.warn(
      `❌ Invalid Authorization header format (${requestId}):`,
      authHeader.substring(0, 50)
    );
    res
      .status(401)
      .json(
        createAuthErrorResponse(
          'INVALID_AUTHORIZATION_FORMAT',
          'Authorization header must be in "Bearer <token>" format',
          requestId
        )
      );
    return;
  }

  // In production: JWKS verification, in development: branch based on configuration
  if (config.isProduction || config.jwks.uri) {
    // Execute JWKS verification
    verifyJWT(token)
      .then((result) => {
        if (!result.valid) {
          console.warn(`❌ JWT verification failed (${requestId}):`, result.error);
          res
            .status(401)
            .json(
              createAuthErrorResponse(
                'INVALID_JWT',
                result.error || 'JWT verification failed',
                requestId
              )
            );
          return;
        }

        // Verification successful: Add authentication information to request
        req.jwt = result.payload;
        req.userId = result.payload?.sub || result.payload?.['cognito:username'];

        console.log(`✅ JWT authentication successful (${requestId}):`, {
          userId: req.userId,
          username: result.payload?.['cognito:username'] || result.payload?.username,
          tokenUse: result.payload?.token_use,
        });

        next();
      })
      .catch((error) => {
        console.error(`💥 JWT verification error (${requestId}):`, error);
        res
          .status(500)
          .json(
            createAuthErrorResponse(
              'JWT_VERIFICATION_ERROR',
              'Internal error during JWT verification',
              requestId
            )
          );
      });
  } else {
    // In development environment with JWKS not configured: decode only (no verification)
    console.warn(
      `⚠️  Development environment: Skipping verification due to JWKS not configured (${requestId})`
    );

    try {
      // Base64 decode JWT (no verification)
      const parts = token.split('.');
      if (parts.length !== 3) {
        res
          .status(401)
          .json(createAuthErrorResponse('INVALID_JWT_FORMAT', 'Invalid JWT format', requestId));
        return;
      }

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      req.jwt = payload as CognitoJWTPayload;
      req.userId = payload.sub || payload['cognito:username'];

      console.log(`🔧 JWT decode successful (no verification) (${requestId}):`, {
        userId: req.userId,
        username: payload['cognito:username'],
        tokenUse: payload.token_use,
      });

      next();
    } catch (error) {
      console.error(`❌ JWT decode error (${requestId}):`, error);
      res
        .status(401)
        .json(createAuthErrorResponse('JWT_DECODE_ERROR', 'Failed to decode JWT', requestId));
      return;
    }
  }
}

/**
 * Optional authentication middleware
 * Verify only if JWT exists, pass through if it doesn't
 */
export function optionalJwtAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    // Pass through if authentication header doesn't exist
    return next();
  }

  // Execute normal authentication if authentication header exists
  return jwtAuthMiddleware(req, res, next);
}

/**
 * Authentication information type definition
 */
export interface AuthInfo {
  authenticated: boolean;
  userId?: string;
  username?: string;
  email?: string;
  groups: string[];
  tokenUse?: 'access' | 'id';
  requestId?: string;
}

/**
 * Helper function to get current authentication information
 */
export function getCurrentAuth(req: AuthenticatedRequest): AuthInfo {
  return {
    authenticated: !!req.jwt,
    userId: req.userId,
    username: req.jwt?.['cognito:username'] || req.jwt?.username,
    email: req.jwt?.email,
    groups: req.jwt?.['cognito:groups'] || [],
    tokenUse: req.jwt?.token_use,
    requestId: req.requestId,
  };
}
