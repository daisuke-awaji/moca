/**
 * Backend API Configuration
 * Manage environment variables and application settings
 */

import { loadEnvFile } from '../utils/load-env.js';
import { z } from 'zod';

// Load environment variables
loadEnvFile();

/**
 * Environment variable schema definition
 */
const envSchema = z.object({
  // Server configuration
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Cognito configuration (required for JWT verification)
  COGNITO_USER_POOL_ID: z.string({
    required_error: 'COGNITO_USER_POOL_ID is required for JWT verification',
  }),
  COGNITO_REGION: z.string({
    required_error: 'COGNITO_REGION is required for JWT verification',
  }),
  COGNITO_CLIENT_ID: z.string().optional(),

  // CORS configuration
  CORS_ALLOWED_ORIGINS: z.string().default('*'),

  // AgentCore Memory configuration
  AGENTCORE_MEMORY_ID: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // AgentCore Gateway configuration
  AGENTCORE_GATEWAY_ENDPOINT: z.string().url().optional(),

  // User Storage configuration
  USER_STORAGE_BUCKET_NAME: z.string().optional(),

  // Agents Table configuration
  AGENTS_TABLE_NAME: z.string().optional(),

  // Sessions Table configuration
  SESSIONS_TABLE_NAME: z.string().optional(),
});

/**
 * Validate and parse environment variables
 */
function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variable configuration:', error);
    process.exit(1);
  }
}

const env = parseEnv();

/**
 * Application configuration
 */
export const config = {
  // Server configuration
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',

  // Cognito configuration (used by aws-jwt-verify)
  cognito: {
    userPoolId: env.COGNITO_USER_POOL_ID,
    region: env.COGNITO_REGION,
    clientId: env.COGNITO_CLIENT_ID,
  },

  // CORS configuration
  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
  },

  // AgentCore Memory configuration
  agentcore: {
    memoryId: env.AGENTCORE_MEMORY_ID,
    region: env.AWS_REGION,
  },

  // AgentCore Gateway configuration
  gateway: {
    endpoint: env.AGENTCORE_GATEWAY_ENDPOINT,
  },

  // User Storage configuration
  userStorageBucketName: env.USER_STORAGE_BUCKET_NAME,

  // Agents Table configuration
  agentsTableName: env.AGENTS_TABLE_NAME,

  // Sessions Table configuration
  sessionsTableName: env.SESSIONS_TABLE_NAME,
} as const;

console.log('⚙️  Backend API configuration loaded:', {
  port: config.port,
  nodeEnv: config.nodeEnv,
  hasCognitoUserPoolId: !!config.cognito.userPoolId,
  hasCognitoClientId: !!config.cognito.clientId,
  corsOrigins: config.cors.allowedOrigins,
});
