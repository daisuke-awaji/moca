import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from './logger.js';
import { extractToolName, getContextSummary } from './context-parser.js';
import { getToolHandler } from './tools/index.js';
import {
  createSuccessResponse,
  createErrorResponse,
  createOptionsResponse,
  extractResponseMetadata,
} from './response-builder.js';
import { ToolInput } from './types.js';

/**
 * AgentCore Gateway Athena Tools Lambda Handler
 *
 * This Lambda function is invoked by the AgentCore Gateway
 * and executes registered Athena tools.
 */

export async function handler(event: ToolInput, context: Context): Promise<APIGatewayProxyResult> {
  const reqId = context.awsRequestId;
  const timestamp = new Date().toISOString();

  logger.setRequestId(reqId);

  const contextSummary = getContextSummary(context);
  logger.info('START', {
    timestamp,
    eventKeys: Object.keys(event),
    eventSize: JSON.stringify(event).length,
    ...contextSummary,
  });

  try {
    // Extract tool name from context
    const toolName = extractToolName(context);

    // Get tool handler
    const toolHandler = getToolHandler(toolName);

    logger.info('TOOL_EXEC', {
      tool: toolName || 'athena-list-tables',
      inputKeys: Object.keys(event),
      inputSize: JSON.stringify(event).length,
    });

    // Execute tool
    const toolResult = await toolHandler(event);

    // Build success response
    const response = createSuccessResponse(toolResult, toolName, reqId, timestamp);

    const responseMetadata = extractResponseMetadata(response, toolResult);
    logger.info('SUCCESS', {
      tool: toolName || 'athena-list-tables',
      executionTime: context.getRemainingTimeInMillis(),
      ...responseMetadata,
    });

    return response;
  } catch (error) {
    logger.error('ERROR', {
      error,
      tool: extractToolName(context) || 'unknown',
      remainingTime: context.getRemainingTimeInMillis(),
    });

    return createErrorResponse(error, extractToolName(context), reqId, timestamp);
  }
}

/**
 * OPTIONS request handler (CORS support)
 */
export async function optionsHandler(): Promise<APIGatewayProxyResult> {
  return createOptionsResponse();
}
