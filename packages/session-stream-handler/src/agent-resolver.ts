/**
 * Agent Name Resolver
 *
 * Resolves agent IDs to display names by querying the Agents DynamoDB table.
 * Uses an in-memory cache to avoid repeated lookups within a Lambda invocation.
 */
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({});

// In-memory cache (per Lambda invocation / warm start)
const agentNameCache = new Map<string, string>();

/** Default fallback name when agent cannot be resolved */
const FALLBACK_AGENT_NAME = 'AI Agent';

/**
 * Resolve an agent ID to its display name
 *
 * @param userId - Owner of the agent
 * @param agentId - Agent ID to resolve
 * @returns Display name of the agent
 */
export async function resolveAgentName(
  userId: string,
  agentId: string
): Promise<string> {
  if (!agentId) {
    return FALLBACK_AGENT_NAME;
  }

  // Check cache first
  const cacheKey = `${userId}:${agentId}`;
  const cached = agentNameCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const tableName = process.env.AGENTS_TABLE_NAME;
  if (!tableName) {
    return agentId;
  }

  try {
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ userId, agentId }),
        ProjectionExpression: '#n',
        ExpressionAttributeNames: { '#n': 'name' },
      })
    );

    if (result.Item) {
      const item = unmarshall(result.Item);
      const name = (item.name as string) || agentId;
      agentNameCache.set(cacheKey, name);
      return name;
    }

    // Try "shared" partition for shared/default agents
    const sharedResult = await dynamoClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ userId: 'shared', agentId }),
        ProjectionExpression: '#n',
        ExpressionAttributeNames: { '#n': 'name' },
      })
    );

    if (sharedResult.Item) {
      const item = unmarshall(sharedResult.Item);
      const name = (item.name as string) || agentId;
      agentNameCache.set(cacheKey, name);
      return name;
    }

    // Cache the fallback too
    agentNameCache.set(cacheKey, agentId);
    return agentId;
  } catch (error) {
    console.error('Failed to resolve agent name:', { userId, agentId, error });
    return agentId;
  }
}
