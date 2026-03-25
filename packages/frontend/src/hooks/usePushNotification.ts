/**
 * Push Notification Hook
 *
 * Manages Web Push subscription lifecycle:
 * - Check browser support
 * - Request permission
 * - Subscribe / unsubscribe
 * - Sync with backend API
 */
import { useState, useEffect, useCallback } from 'react';
import { subscribePush, unsubscribePush } from '../api/push';
import { logger } from '../utils/logger';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function usePushNotification() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  // Check support and current state on mount
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      !!VAPID_PUBLIC_KEY;

    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || isLoading) return;

    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        logger.log('[PushNotification] Permission denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      await subscribePush(subscription);
      setIsSubscribed(true);
      logger.log('[PushNotification] Subscribed successfully');
    } catch (error) {
      logger.error('[PushNotification] Subscribe failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isLoading]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || isLoading) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unsubscribePush(endpoint);
      }

      setIsSubscribed(false);
      logger.log('[PushNotification] Unsubscribed successfully');
    } catch (error) {
      logger.error('[PushNotification] Unsubscribe failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isLoading]);

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
