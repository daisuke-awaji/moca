/**
 * Express application factory for AgentCore Runtime
 */

import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import { corsOptions } from './middleware/cors.js';
import { requestContextMiddleware } from './middleware/request-context.js';
import { handleInvocation, handlePing, handleRoot, handleNotFound } from './handlers/index.js';
import { logger } from './config/index.js';

/**
 * Create and configure Express application
 * @returns Configured Express application
 */
export function createApp(): Express {
  const app = express();

  // Apply CORS middleware
  app.use(cors(corsOptions));

  // Configure to receive request body as JSON
  app.use(
    express.json({
      limit: '100mb',
    })
  );

  // Apply request context middleware (endpoints requiring authentication)
  app.use('/invocations', requestContextMiddleware);

  // Route handlers
  app.get('/ping', handlePing);
  app.get('/', handleRoot);
  app.post('/invocations', handleInvocation);

  // 404 handler
  app.use('*', handleNotFound);

  // Error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('💥 Unhandled error:', { error: err, path: req.path, method: req.method });
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  });

  return app;
}
