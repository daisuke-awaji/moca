import { BedrockModel } from '@strands-agents/sdk';
import { config, logger } from '../config/index.js';

export interface BedrockModelOptions {
  modelId?: string;
  region?: string;
  // Cache options
  cachePrompt?: 'default' | 'ephemeral';
  cacheTools?: 'default' | 'ephemeral';
}

/**
 * Bedrock モデルを作成
 */
export function createBedrockModel(options?: BedrockModelOptions): BedrockModel {
  const modelId = options?.modelId || config.BEDROCK_MODEL_ID;
  const region = options?.region || config.BEDROCK_REGION;

  // Cache configuration (apply only if enabled via environment variable)
  const cachePrompt = config.ENABLE_PROMPT_CACHING
    ? options?.cachePrompt || config.CACHE_TYPE
    : undefined;
  const cacheTools = config.ENABLE_PROMPT_CACHING
    ? options?.cacheTools || config.CACHE_TYPE
    : undefined;

  logger.info('🤖 Creating BedrockModel with caching:', {
    modelId,
    region,
    cachePrompt,
    cacheTools,
    cachingEnabled: config.ENABLE_PROMPT_CACHING,
  });

  return new BedrockModel({
    region,
    modelId,
    cachePrompt,
    cacheTools,
    clientConfig: {
      retryMode: 'adaptive', // Adaptive retry mode for rate limiting
      maxAttempts: 5, // Maximum 5 attempts (1 initial + 4 retries)
    },
  });
}
