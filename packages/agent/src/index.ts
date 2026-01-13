/**
 * AgentCore Runtime HTTP Server - Entry Point
 */

import { createApp } from './app.js';
import { logger } from './config/index.js';

const PORT = process.env.PORT || 8080;

/**
 * Start application
 */
async function startServer(): Promise<void> {
  try {
    const app = createApp();

    // Start HTTP server (Agent initialization executed on first request)
    app.listen(PORT, () => {
      logger.info('🚀 AgentCore Runtime server started:', {
        port: PORT,
        healthCheck: `http://localhost:${PORT}/ping`,
        agentEndpoint: `POST http://localhost:${PORT}/invocations`,
        note: 'Agent is initialized on first request',
      });
    });
  } catch (error) {
    logger.error('💥 Server start failed:', { error });
    process.exit(1);
  }
}

// Start server
startServer();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
});
