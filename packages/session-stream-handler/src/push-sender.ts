/**
 * Web Push Notification Sender
 *
 * Sends push notifications to subscribed devices using the Web Push protocol.
 * VAPID keys are loaded from Secrets Manager with caching.
 */
import webpush from 'web-push';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * Push notification payload
 */
export interface PushPayload {
  title: string;
  body: string;
  data?: {
    url?: string;
    sessionId?: string;
    agentId?: string;
    type?: string;
  };
}

/**
 * Push subscription record from DynamoDB
 */
interface PushSubscriptionRecord {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// VAPID keys cache
let vapidKeysCache: { publicKey: string; privateKey: string; subject: string } | null = null;

const secretsClient = new SecretsManagerClient({});
const dynamoClient = new DynamoDBClient({});

/**
 * Load VAPID keys from Secrets Manager (with caching)
 */
async function getVapidKeys(): Promise<typeof vapidKeysCache> {
  if (vapidKeysCache) {
    return vapidKeysCache;
  }

  const secretName = process.env.VAPID_KEYS_SECRET_NAME;
  if (!secretName) {
    return null;
  }

  try {
    const result = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    vapidKeysCache = JSON.parse(result.SecretString || '{}');
    return vapidKeysCache;
  } catch (error) {
    console.error('Failed to load VAPID keys:', error);
    return null;
  }
}

/**
 * Get all push subscriptions for a user
 */
async function getSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
  const tableName = process.env.PUSH_SUBSCRIPTIONS_TABLE_NAME;
  if (!tableName) {
    return [];
  }

  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({ ':userId': userId }),
    })
  );

  return (result.Items || []).map((item) => unmarshall(item) as PushSubscriptionRecord);
}

/**
 * Delete a stale subscription (410 Gone)
 */
async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  const tableName = process.env.PUSH_SUBSCRIPTIONS_TABLE_NAME;
  if (!tableName) return;

  try {
    await dynamoClient.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: marshall({ userId, endpoint }),
      })
    );
    console.log(`Deleted stale subscription: ${endpoint.substring(0, 60)}...`);
  } catch (error) {
    console.error('Failed to delete stale subscription:', error);
  }
}

/**
 * Send push notifications to all subscribed devices of a user
 */
export async function sendPushNotifications(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const vapidKeys = await getVapidKeys();
  if (!vapidKeys) {
    return;
  }

  const subscriptions = await getSubscriptions(userId);
  if (subscriptions.length === 0) {
    return;
  }

  webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

  const payloadStr = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadStr,
          { TTL: 60 * 60 } // 1 hour
        );
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;

        // 410 Gone or 404 Not Found — subscription is no longer valid
        if (statusCode === 410 || statusCode === 404) {
          await deleteSubscription(userId, sub.endpoint);
        } else {
          console.error(
            `Push send failed (${statusCode}):`,
            sub.endpoint.substring(0, 60)
          );
        }
      }
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  if (sent > 0) {
    console.log(`Sent ${sent}/${subscriptions.length} push notifications for user: ${userId}`);
  }
}
