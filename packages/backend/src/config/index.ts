/**
 * Backend API Configuration
 * Manage environment variables and application settings
 */

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load environment variables
loadEnv();

/**
 * Environment variable schema definition
 */
const envSchema = z.object({
  // Server configuration
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Cognito/JWKS configuration
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_REGION: z.string().optional(),
  JWKS_URI: z.string().url().optional(),

  // CORS configuration
  CORS_ALLOWED_ORIGINS: z.string().default('*'),

  // JWT configuration
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),

  // AgentCore Memory configuration
  AGENTCORE_MEMORY_ID: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // AgentCore Gateway configuration
  AGENTCORE_GATEWAY_ENDPOINT: z.string().url().optional(),

  // User Storage configuration
  USER_STORAGE_BUCKET_NAME: z.string().optional(),

  // Agents Table configuration
  AGENTS_TABLE_NAME: z.string().optional(),
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

  // Build JWKS configuration
  jwks: {
    uri:
      env.JWKS_URI ||
      (env.COGNITO_USER_POOL_ID && env.COGNITO_REGION
        ? `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
        : undefined),
    cacheDuration: 10 * 60 * 1000, // Cache for 10 minutes
  },

  // JWT configuration
  jwt: {
    issuer:
      env.JWT_ISSUER ||
      (env.COGNITO_USER_POOL_ID && env.COGNITO_REGION
        ? `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`
        : undefined),
    audience: env.JWT_AUDIENCE,
    algorithms: ['RS256'] as const,
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
} as const;

/**
 * Validate configuration
 */
export function validateConfig() {
  const issues: string[] = [];

  if (!config.jwks.uri) {
    issues.push(
      'JWKS URI is not configured (JWKS_URI or COGNITO_USER_POOL_ID + COGNITO_REGION required)'
    );
  }

  if (!config.jwt.issuer) {
    issues.push(
      'JWT Issuer is not configured (JWT_ISSUER or COGNITO_USER_POOL_ID + COGNITO_REGION required)'
    );
  }

  if (issues.length > 0) {
    console.warn('⚠️  Configuration issues found:');
    issues.forEach((issue) => console.warn(`  - ${issue}`));

    if (config.isProduction) {
      console.error('❌ All configurations are required in production environment');
      process.exit(1);
    } else {
      console.warn('🔧 Continuing with warnings in development environment');
    }
  }
}

// Validate configuration on initialization
validateConfig();

console.log('⚙️  Backend API configuration loaded:', {
  port: config.port,
  nodeEnv: config.nodeEnv,
  hasJwksUri: !!config.jwks.uri,
  hasJwtIssuer: !!config.jwt.issuer,
  corsOrigins: config.cors.allowedOrigins,
});
