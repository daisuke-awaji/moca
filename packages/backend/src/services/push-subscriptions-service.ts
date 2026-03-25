/**
 * Push Subscriptions DynamoDB Service
 * Service for managing Web Push notification subscriptions in DynamoDB
 */

import {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * Push subscription data
 */
export interface PushSubscriptionData {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: number; // TTL epoch seconds
}

/**
 * Input for saving a push subscription
 */
export interface SaveSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

/** TTL: 90 days in seconds */
const SUBSCRIPTION_TTL_SECONDS = 90 * 24 * 60 * 60;

export class PushSubscriptionsService {
  private client: DynamoDBClient;
  private tableName: string;

  constructor(tableName: string) {
    this.client = new DynamoDBClient({});
    this.tableName = tableName;
  }

  /**
   * Save a push subscription for a user
   */
  async saveSubscription(userId: string, input: SaveSubscriptionInput): Promise<void> {
    const now = new Date();
    const expiresAt = Math.floor(now.getTime() / 1000) + SUBSCRIPTION_TTL_SECONDS;

    const item: PushSubscriptionData = {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent,
      createdAt: now.toISOString(),
      expiresAt,
    };

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      })
    );
  }

  /**
   * Delete a push subscription for a user
   */
  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId, endpoint }),
      })
    );
  }

  /**
   * Get subscription count for a user
   */
  async getSubscriptionCount(userId: string): Promise<number> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: marshall({ ':userId': userId }),
        Select: 'COUNT',
      })
    );

    return result.Count || 0;
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.tableName;
  }
}

/**
 * Create PushSubscriptionsService from environment
 */
export function createPushSubscriptionsService(): PushSubscriptionsService | null {
  const tableName = process.env.PUSH_SUBSCRIPTIONS_TABLE_NAME;
  if (!tableName) {
    return null;
  }
  return new PushSubscriptionsService(tableName);
}
