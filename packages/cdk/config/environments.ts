/**
 * Environment-specific configuration
 * Supports 3 environments: dev / stg / prd
 */

import * as cdk from 'aws-cdk-lib';

/**
 * Environment name
 */
export type Environment = 'default' | 'dev' | 'stg' | 'prd';

/**
 * Environment-specific configuration interface
 */
export interface EnvironmentConfig {
  /**
   * Environment name
   */
  env: Environment;

  /**
   * AWS Account ID (optional)
   * Uses CDK_DEFAULT_ACCOUNT if not specified
   */
  awsAccount?: string;

  /**
   * AWS Region
   */
  awsRegion: string;

  /**
   * Resource name prefix
   * Used as common prefix for Gateway, Cognito, Backend API, etc.
   */
  resourcePrefix: string;

  /**
   * Runtime name (underscore format)
   * AgentCore Runtime must start with a letter and contain only letters, numbers, and underscores
   */
  runtimeName: string;

  /**
   * Stack deletion protection
   */
  deletionProtection: boolean;

  /**
   * CORS allowed origins
   */
  corsAllowedOrigins: string[];

  /**
   * Memory expiration (days)
   */
  memoryExpirationDays: number;

  /**
   * S3 removal policy
   */
  s3RemovalPolicy: cdk.RemovalPolicy;

  /**
   * S3 auto delete objects (only effective when RemovalPolicy is DESTROY)
   */
  s3AutoDeleteObjects: boolean;

  /**
   * Cognito deletion protection
   */
  cognitoDeletionProtection: boolean;

  /**
   * Lambda function log retention period (days)
   */
  logRetentionDays: number;

  /**
   * Frontend S3 bucket name prefix
   */
  frontendBucketPrefix?: string;

  /**
   * User Storage S3 bucket name prefix
   */
  userStorageBucketPrefix?: string;

  /**
   * Backend API name
   */
  backendApiName?: string;

  /**
   * Tavily API Key Secret Name (Secrets Manager)
   * Set for production/staging environments to retrieve API key from Secrets Manager
   */
  tavilyApiKeySecretName?: string;

  /**
   * Allowed email domains for sign-up (optional)
   * If set, only emails from these domains can sign up
   * Example: ['amazon.com', 'amazon.jp']
   */
  allowedSignUpEmailDomains?: string[];
}

/**
 * Environment-specific configurations
 */
export const environments: Record<Environment, EnvironmentConfig> = {
  default: {
    env: 'default',
    awsRegion: 'ap-northeast-1',
    resourcePrefix: 'agentcore-app',
    runtimeName: 'agentcore_app',
    deletionProtection: false,
    corsAllowedOrigins: ['*'], // Development: Allow all origins
    memoryExpirationDays: 30,
    s3RemovalPolicy: cdk.RemovalPolicy.DESTROY,
    s3AutoDeleteObjects: true,
    cognitoDeletionProtection: false,
    logRetentionDays: 7,
    frontendBucketPrefix: 'agentcore-app',
    userStorageBucketPrefix: 'agentcore-app',
    backendApiName: 'agentcore-app-backend-api',
    tavilyApiKeySecretName: 'agentcore/default/tavily-api-key',
    allowedSignUpEmailDomains: ['amazon.com', 'amazon.jp'],
  },

  dev: {
    env: 'dev',
    awsRegion: 'ap-northeast-1',
    resourcePrefix: 'agentcore-app-dev',
    runtimeName: 'agentcore_app_dev',
    deletionProtection: false,
    corsAllowedOrigins: ['*'], // Development: Allow all origins
    memoryExpirationDays: 30,
    s3RemovalPolicy: cdk.RemovalPolicy.DESTROY,
    s3AutoDeleteObjects: true,
    cognitoDeletionProtection: false,
    logRetentionDays: 7,
    frontendBucketPrefix: 'agentcore-app-dev',
    userStorageBucketPrefix: 'agentcore-app-dev',
    backendApiName: 'agentcore-app-dev-backend-api',
    tavilyApiKeySecretName: 'agentcore/dev/tavily-api-key',
    allowedSignUpEmailDomains: ['amazon.com', 'amazon.jp'],
  },

  stg: {
    env: 'stg',
    awsRegion: 'ap-northeast-1',
    resourcePrefix: 'agentcore-app-stg',
    runtimeName: 'agentcore_app_stg',
    deletionProtection: false,
    corsAllowedOrigins: ['https://stg.example.com'], // Staging environment URL
    memoryExpirationDays: 60,
    s3RemovalPolicy: cdk.RemovalPolicy.RETAIN,
    s3AutoDeleteObjects: false,
    cognitoDeletionProtection: false,
    logRetentionDays: 14,
    frontendBucketPrefix: 'agentcore-app-stg',
    userStorageBucketPrefix: 'agentcore-app-stg',
    backendApiName: 'agentcore-app-stg-backend-api',
    tavilyApiKeySecretName: 'agentcore/stg/tavily-api-key',
  },

  prd: {
    env: 'prd',
    awsRegion: 'ap-northeast-1',
    resourcePrefix: 'agentcore-app-prd',
    runtimeName: 'agentcore_app_prd',
    deletionProtection: true,
    corsAllowedOrigins: ['https://app.example.com'], // Production environment URL
    memoryExpirationDays: 365,
    s3RemovalPolicy: cdk.RemovalPolicy.RETAIN,
    s3AutoDeleteObjects: false,
    cognitoDeletionProtection: true,
    logRetentionDays: 30,
    frontendBucketPrefix: 'agentcore-app-prd',
    userStorageBucketPrefix: 'agentcore-app-prd',
    backendApiName: 'agentcore-app-prd-backend-api',
    tavilyApiKeySecretName: 'agentcore/prd/tavily-api-key',
  },
};

/**
 * Get environment configuration
 */
export function getEnvironmentConfig(env: Environment): EnvironmentConfig {
  const config = environments[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}. Valid values are: dev, stg, prd`);
  }
  return config;
}
