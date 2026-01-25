/**
 * Session Control Service
 * AgentCore Runtime session management (stop/terminate)
 */

import {
  BedrockAgentCoreClient,
  StopRuntimeSessionCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-bedrock-agentcore';
import { config } from '../config/index.js';

// Initialize BedrockAgentCore client
const client = new BedrockAgentCoreClient({ region: config.agentcore.region });

export interface StopSessionResult {
  success: boolean;
  message: string;
  sessionId: string;
}

/**
 * Stop a running AgentCore Runtime session
 * @param sessionId - The runtime session ID to stop
 * @returns Result indicating success/failure
 */
export async function stopRuntimeSession(sessionId: string): Promise<StopSessionResult> {
  const runtimeArn = config.agentcore.runtimeArn;

  if (!runtimeArn) {
    throw new Error('AGENTCORE_RUNTIME_ARN is not configured');
  }

  console.log(`🛑 Stopping runtime session: ${sessionId}`);

  try {
    await client.send(
      new StopRuntimeSessionCommand({
        agentRuntimeArn: runtimeArn,
        runtimeSessionId: sessionId,
        qualifier: 'DEFAULT',
      })
    );

    console.log(`✅ Session stopped successfully: ${sessionId}`);
    return {
      success: true,
      message: 'Session stopped successfully',
      sessionId,
    };
  } catch (error: unknown) {
    // Session already terminated is considered success
    if (error instanceof ResourceNotFoundException) {
      console.log(`ℹ️ Session already terminated: ${sessionId}`);
      return {
        success: true,
        message: 'Session already terminated',
        sessionId,
      };
    }

    console.error(`❌ Failed to stop session: ${sessionId}`, error);
    throw error;
  }
}

/**
 * Check if session control is configured
 */
export function isSessionControlConfigured(): boolean {
  return !!config.agentcore.runtimeArn;
}
