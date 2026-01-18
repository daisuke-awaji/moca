/**
 * Session Events Subscription Hook
 *
 * Subscribe to real-time session updates via AppSync Events WebSocket API
 */
import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { appsyncEventsConfig } from '../config/appsync-events';

/**
 * Session event from DynamoDB Streams
 */
interface SessionEvent {
  type: 'INSERT' | 'MODIFY' | 'REMOVE';
  sessionId: string;
  title?: string;
  agentId?: string;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * AppSync Events WebSocket message types
 */
interface AppSyncMessage {
  type: string;
  payload?: {
    data?: string;
  };
  id?: string;
  connectionTimeoutMs?: number;
}

/**
 * Encode object to Base64URL format (required for AppSync Events subprotocol)
 * Base64URL: replaces + with -, / with _, and removes = padding
 */
function getBase64URLEncoded(obj: object): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Custom hook for subscribing to real-time session updates
 *
 * This hook establishes a WebSocket connection to AppSync Events API
 * and listens for session changes (INSERT, MODIFY, REMOVE).
 */
export function useSessionEventsSubscription() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const [isConnected, setIsConnected] = useState(false);
  const isConnectingRef = useRef(false);

  // Get auth state
  const user = useAuthStore((state) => state.user);
  const idToken = user?.idToken;
  const userId = user?.userId;

  // Store auth values in refs to avoid dependency issues
  const idTokenRef = useRef(idToken);
  const userIdRef = useRef(userId);

  // Update refs when values change
  useEffect(() => {
    idTokenRef.current = idToken;
    userIdRef.current = userId;
  }, [idToken, userId]);

  /**
   * Handle incoming session events
   * Uses store's getState() directly to avoid any dependencies
   */
  const handleSessionEvent = (event: SessionEvent) => {
    console.log('📡 Received session event:', event);

    const store = useSessionStore.getState();

    switch (event.type) {
      case 'INSERT': {
        // Check if session already exists (might be added optimistically)
        const exists = store.sessions.some((s) => s.sessionId === event.sessionId);
        if (!exists) {
          store.addOptimisticSession(event.sessionId, event.title);
        }
        break;
      }

      case 'MODIFY': {
        // Update session title if changed
        if (event.title) {
          store.updateSessionTitle(event.sessionId, event.title);
        }
        break;
      }

      case 'REMOVE': {
        // Session was deleted (possibly by another device/tab)
        // Refresh to sync
        store.refreshSessions();
        break;
      }
    }
  };

  /**
   * Disconnect WebSocket
   */
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (keepAliveTimeoutRef.current) {
      clearTimeout(keepAliveTimeoutRef.current);
      keepAliveTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Send unsubscribe before closing
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'unsubscribe',
            id: 'session-subscription',
          })
        );
      }
      wsRef.current.close(1000, 'Component unmount');
      wsRef.current = null;
    }
    setIsConnected(false);
    isConnectingRef.current = false;
  };

  /**
   * Establish WebSocket connection to AppSync Events
   */
  const connect = () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('📡 Already connecting, skipping...');
      return;
    }

    // Skip if already connected or connecting
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log('📡 Already connected or connecting, skipping...');
      return;
    }

    if (!appsyncEventsConfig.isConfigured) {
      console.log('⚠️ AppSync Events not configured, skipping subscription');
      return;
    }

    const currentIdToken = idTokenRef.current;
    const currentUserId = userIdRef.current;

    if (!currentIdToken || !currentUserId) {
      console.log('⚠️ No auth token available, skipping subscription');
      return;
    }

    // Close existing connection if any (with proper close code)
    if (wsRef.current) {
      wsRef.current.close(1000, 'Reconnecting');
      wsRef.current = null;
    }

    isConnectingRef.current = true;

    try {
      const endpoint = appsyncEventsConfig.realtimeEndpoint;

      // Extract host from endpoint for authorization header
      // Endpoint format: wss://xxx.appsync-realtime-api.region.amazonaws.com/event/realtime
      // HTTP host format: xxx.appsync-api.region.amazonaws.com
      const realtimeHost = new URL(endpoint.replace('wss://', 'https://')).hostname;
      const httpHost = realtimeHost.replace('.appsync-realtime-api.', '.appsync-api.');

      // Build authorization header for Cognito User Pools
      // Reference: https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
      const authorization = {
        Authorization: currentIdToken,
        host: httpHost,
      };

      // Create subprotocol with Base64URL encoded header
      const authProtocol = `header-${getBase64URLEncoded(authorization)}`;

      console.log(`📡 Connecting to AppSync Events: ${endpoint}`);
      console.log(`📡 Auth host: ${httpHost}`);

      // Connect using subprotocol authentication
      // Reference: AppSync Events requires 'aws-appsync-event-ws' subprotocol
      const ws = new WebSocket(endpoint, [authProtocol, 'aws-appsync-event-ws']);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('📡 WebSocket connected');
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        setIsConnected(true);

        // Send connection init (optional but recommended)
        ws.send(
          JSON.stringify({
            type: 'connection_init',
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message: AppSyncMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connection_ack': {
              console.log('📡 Connection acknowledged');

              // Set up keep-alive timeout
              const timeoutMs = message.connectionTimeoutMs || 300000;
              console.log(`📡 Keep-alive timeout: ${timeoutMs}ms`);

              // Subscribe to session channel for this user
              // Note: authorization is required for each subscribe message
              // Reference: https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
              ws.send(
                JSON.stringify({
                  type: 'subscribe',
                  id: 'session-subscription',
                  channel: `/sessions/${currentUserId}`,
                  authorization: {
                    Authorization: currentIdToken,
                    host: httpHost,
                  },
                })
              );
              break;
            }

            case 'subscribe_success':
              console.log('📡 Subscription successful');
              break;

            case 'subscribe_error':
              console.error('📡 Subscription error:', message);
              break;

            case 'data': {
              // Parse and handle event data
              // AppSync Events API returns event data in 'event' field as string
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const eventData = (message as any).event;
              if (eventData) {
                const sessionEvent = JSON.parse(eventData) as SessionEvent;
                handleSessionEvent(sessionEvent);
              }
              break;
            }

            case 'ka':
              // Keep-alive received, reset timeout
              if (keepAliveTimeoutRef.current) {
                clearTimeout(keepAliveTimeoutRef.current);
              }
              break;

            case 'error':
              console.error('📡 WebSocket error message:', message);
              break;

            default:
              console.log('📡 Unknown message type:', message.type, message);
          }
        } catch (error) {
          console.error('📡 Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('📡 WebSocket error:', error);
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log(`📡 WebSocket closed: code=${event.code} reason=${event.reason}`);
        setIsConnected(false);
        isConnectingRef.current = false;

        // Clear keep-alive timeout
        if (keepAliveTimeoutRef.current) {
          clearTimeout(keepAliveTimeoutRef.current);
          keepAliveTimeoutRef.current = null;
        }

        // Attempt reconnection if not intentionally closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(
            `📡 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('📡 Failed to connect to AppSync Events:', error);
      isConnectingRef.current = false;
    }
  };

  // Connect on mount, disconnect on unmount
  // Only re-connect when auth changes (idToken or userId)
  useEffect(() => {
    // Only connect if we have auth
    if (idToken && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, userId]);

  return {
    isConnected,
    reconnect: connect,
  };
}
