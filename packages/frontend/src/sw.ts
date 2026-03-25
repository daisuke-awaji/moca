/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Workbox precache (replaces generateSW's globPatterns)
precacheAndRoute(self.__WB_MANIFEST);

// Runtime caching for Google Fonts (migrated from generateSW config)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ============================================================
// Push Notification Handlers
// ============================================================

interface PushData {
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
 * Push event handler
 * Shows a notification only when no focused window exists (background mode).
 * When the app is in the foreground, AppSync WebSocket handles real-time updates.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let pushData: PushData;
  try {
    pushData = event.data.json() as PushData;
  } catch {
    return;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const hasFocusedClient = clients.some((c) => c.focused);
        if (hasFocusedClient) {
          // Foreground — skip notification (AppSync WebSocket already provides updates)
          return;
        }

        return self.registration.showNotification(pushData.title, {
          body: pushData.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          tag: `moca-${pushData.data?.sessionId || 'general'}`,
          data: pushData.data,
        } as NotificationOptions);
      })
  );
});

/**
 * Notification click handler
 * Opens or focuses the app window and navigates to the relevant session.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data as PushData['data'])?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing window and navigate
        for (const client of clients) {
          if ('focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // No existing window — open a new one
        return self.clients.openWindow(url);
      })
  );
});
