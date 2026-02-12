/**
 * AgentCore Gateway response builder utility
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { ToolResult } from './types.js';

/**
 * AgentCore response structure
 */
interface AgentCoreResponse {
  result: ToolResult | null;
  error?: string;
  metadata: {
    timestamp: string;
    requestId: string;
    toolName: string;
  };
}

/**
 * Common CORS headers
 */
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Build a success response
 *
 * @param result - Tool execution result
 * @param toolName - Executed tool name
 * @param requestId - Request ID
 * @param timestamp - ISO timestamp
 * @returns APIGatewayProxyResult
 */
export function createSuccessResponse(
  result: ToolResult,
  toolName: string | null,
  requestId: string,
  timestamp: string
): APIGatewayProxyResult {
  const responseBody: AgentCoreResponse = {
    result,
    metadata: {
      timestamp,
      requestId,
      toolName: toolName || 'unknown',
    },
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(responseBody),
  };
}

/**
 * Build an error response
 *
 * @param error - Error object or message
 * @param toolName - Tool name that was attempted
 * @param requestId - Request ID
 * @param timestamp - ISO timestamp
 * @returns APIGatewayProxyResult
 */
export function createErrorResponse(
  error: unknown,
  toolName: string | null,
  requestId: string,
  timestamp: string
): APIGatewayProxyResult {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  const responseBody: AgentCoreResponse = {
    result: null,
    error: errorMessage,
    metadata: {
      timestamp,
      requestId,
      toolName: toolName || 'unknown',
    },
  };

  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify(responseBody),
  };
}

/**
 * Build an OPTIONS response (CORS preflight)
 *
 * @returns APIGatewayProxyResult
 */
export function createOptionsResponse(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: '',
  };
}

/**
 * Extract response metadata for logging
 *
 * @param response - APIGatewayProxyResult
 * @param toolResult - Tool execution result
 * @returns Metadata for logging
 */
export function extractResponseMetadata(response: APIGatewayProxyResult, toolResult?: ToolResult) {
  return {
    statusCode: response.statusCode,
    responseSize: response.body.length,
    resultKeys: toolResult ? Object.keys(toolResult) : [],
    hasError: response.statusCode !== 200,
  };
}
