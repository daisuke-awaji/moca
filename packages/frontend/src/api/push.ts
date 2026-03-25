/**
 * Push Notification API Client
 */

import { backendClient } from './client/backend-client';

/**
 * Save a push subscription to the backend
 */
export async function subscribePush(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await backendClient.request('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
    }),
  });
}

/**
 * Remove a push subscription from the backend
 */
export async function unsubscribePush(endpoint: string): Promise<void> {
  await backendClient.request('/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
}

/**
 * Get push notification status for current user
 */
export async function getPushStatus(): Promise<{
  configured: boolean;
  subscriptionCount: number;
}> {
  return backendClient.request('/push/status');
}
