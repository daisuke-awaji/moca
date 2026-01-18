/**
 * Message Events Subscription Hook
 *
 * Subscribe to real-time message updates via AppSync Events WebSocket API.
 * This enables cross-tab/cross-device synchronization and recovery after page reload.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';
import { appsyncEventsConfig } from '../config/appsync-events';
import type { MessageContent, Message } from '../types/index';
import { nanoid } from 'nanoid';

/**
 * Message event from Agent handler
 */
interface MessageEvent {
  type: 'MESSAGE_ADDED' | 'AGENT_COMPLETE' | 'AGENT_ERROR';
  sessionId: string;
  message?: {
    role: 'user' | 'assistant';
    content: unknown[];
    timestamp: string;
  };
  error?: string;
  requestId?: string;
}

/**
 * AppSync Events WebSocket message types
 */
interface AppSyncMessage {
  type: string;
  id?: string;
  event?: string;
}

/**
 * Encode object to Base64URL format
 */
function getBase64URLEncoded(obj: object): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert API content to local MessageContent type
 *
 * Agent SDK ContentBlock types:
 * - textBlock: { type: 'textBlock', text: string }
 * - toolUseBlock: { type: 'toolUseBlock', toolUseId: string, name: string, input: object }
 * - toolResultBlock: { type: 'toolResultBlock', toolUseId: string, content: string }
 *
 * Frontend MessageContent types:
 * - text: { type: 'text', text: string }
 * - toolUse: { type: 'toolUse', toolUse: ToolUse }
 * - toolResult: { type: 'toolResult', toolResult: ToolResult }
 */
function convertContent(apiContent: unknown): MessageContent {
  const content = apiContent as Record<string, unknown>;

  // textBlock → text (Agent SDK format)
  if (content.type === 'textBlock' && typeof content.text === 'string') {
    return { type: 'text', text: content.text };
  }

  // text format (direct)
  if (content.type === 'text' && typeof content.text === 'string') {
    return { type: 'text', text: content.text };
  }

  // toolUseBlock → toolUse
  if (content.type === 'toolUseBlock') {
    return {
      type: 'toolUse',
      toolUse: {
        id: (content.toolUseId as string) || '',
        name: (content.name as string) || 'unknown',
        input: (content.input as Record<string, unknown>) || {},
        status: 'completed',
      },
    };
  }

  // toolResultBlock → toolResult
  if (content.type === 'toolResultBlock') {
    return {
      type: 'toolResult',
      toolResult: {
        toolUseId: (content.toolUseId as string) || '',
        content:
          typeof content.content === 'string'
            ? content.content
            : JSON.stringify(content.content || ''),
        isError: (content.isError as boolean) || false,
      },
    };
  }

  // Pass through for already-converted or unknown types
  return content as unknown as MessageContent;
}

/**
 * Custom hook for subscribing to real-time message updates
 *
 * @param sessionId - The active session ID to subscribe to
 */
export function useMessageEventsSubscription(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const [isConnected, setIsConnected] = useState(false);
  const isConnectingRef = useRef(false);
  const currentSessionIdRef = useRef(sessionId);
  const httpHostRef = useRef<string>('');
  const connectRef = useRef<() => void>(() => {});
  const subscribedSessionsRef = useRef<Set<string>>(new Set());

  // Get auth state
  const user = useAuthStore((state) => state.user);
  const idToken = user?.idToken;
  const userId = user?.userId;

  // Store auth values in refs
  const idTokenRef = useRef(idToken);
  const userIdRef = useRef(userId);

  useEffect(() => {
    idTokenRef.current = idToken;
    userIdRef.current = userId;
  }, [idToken, userId]);

  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  /**
   * Handle incoming message events
   */
  const handleMessageEvent = useCallback((event: MessageEvent) => {
    console.log('📨 Received message event:', event);

    const chatStore = useChatStore.getState();
    const sessionStore = useSessionStore.getState();

    // Only process events for the active session
    if (event.sessionId !== currentSessionIdRef.current) {
      console.log(
        `⚠️ Message event for different session, ignoring (current: ${currentSessionIdRef.current}, event: ${event.sessionId})`
      );
      return;
    }

    switch (event.type) {
      case 'MESSAGE_ADDED': {
        if (!event.message) break;

        const sessionState = chatStore.getSessionState(event.sessionId);
        if (!sessionState) break;

        // Skip if this tab is currently sending (to avoid duplicates)
        // The sender tab adds messages via streaming response, so we should ignore
        // AppSync Events for this tab to prevent double-adding
        if (sessionState.isLoading) {
          console.log('⚠️ Skipping message event while loading (sender tab)');
          break;
        }

        // Check for duplicate (by timestamp + role)
        const eventTimestamp = new Date(event.message.timestamp).getTime();
        const isDuplicate = sessionState.messages.some((msg) => {
          const msgTimestamp =
            msg.timestamp instanceof Date
              ? msg.timestamp.getTime()
              : new Date(msg.timestamp).getTime();
          // Consider messages within 2 seconds as potential duplicates
          return msg.type === event.message!.role && Math.abs(msgTimestamp - eventTimestamp) < 2000;
        });

        if (isDuplicate) {
          console.log('⚠️ Duplicate message detected, skipping');
          break;
        }

        // Convert content
        const contents: MessageContent[] = event.message.content.map(convertContent);

        // Add message to store
        const newMessage: Message = {
          id: nanoid(),
          type: event.message.role,
          contents,
          timestamp: new Date(event.message.timestamp),
          isStreaming: false,
        };

        // Use chatStore's internal method to add message
        const { sessions } = chatStore;
        const currentState = sessions[event.sessionId] || {
          messages: [],
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        };

        useChatStore.setState({
          sessions: {
            ...sessions,
            [event.sessionId]: {
              ...currentState,
              messages: [...currentState.messages, newMessage],
              lastUpdated: new Date(),
            },
          },
        });

        console.log(`📨 Added message from event: ${event.message.role}`);
        break;
      }

      case 'AGENT_COMPLETE': {
        // Mark any streaming messages as complete
        const sessionState = chatStore.getSessionState(event.sessionId);
        if (!sessionState) break;

        const { sessions } = chatStore;
        const currentState = sessions[event.sessionId];
        if (!currentState) break;

        const updatedMessages = currentState.messages.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        );

        useChatStore.setState({
          sessions: {
            ...sessions,
            [event.sessionId]: {
              ...currentState,
              messages: updatedMessages,
              isLoading: false,
            },
          },
        });

        // Refresh session list to update title
        sessionStore.refreshSessions();
        console.log('📨 Agent complete event processed');
        break;
      }

      case 'AGENT_ERROR': {
        console.error('📨 Agent error event:', event.error);
        const { sessions } = chatStore;
        const currentState = sessions[event.sessionId];
        if (!currentState) break;

        useChatStore.setState({
          sessions: {
            ...sessions,
            [event.sessionId]: {
              ...currentState,
              isLoading: false,
              error: event.error || 'Unknown error',
            },
          },
        });
        break;
      }
    }
  }, []);

  /**
   * Subscribe to message channel for current session
   */
  const subscribeToSession = useCallback((ws: WebSocket, sessionIdToSubscribe: string) => {
    // Skip if already subscribed to this session
    if (subscribedSessionsRef.current.has(sessionIdToSubscribe)) {
      console.log(`⚠️ Already subscribed to session: ${sessionIdToSubscribe}, skipping`);
      return;
    }

    const currentIdToken = idTokenRef.current;
    if (!currentIdToken || !httpHostRef.current) return;

    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    console.log(`📨 Subscribing to messages for session: ${sessionIdToSubscribe}`);

    ws.send(
      JSON.stringify({
        type: 'subscribe',
        id: `message-subscription-${sessionIdToSubscribe}`,
        channel: `/messages/${currentUserId}/${sessionIdToSubscribe}`,
        authorization: {
          Authorization: currentIdToken,
          host: httpHostRef.current,
        },
      })
    );

    // Track subscribed session
    subscribedSessionsRef.current.add(sessionIdToSubscribe);
  }, []);

  /**
   * Unsubscribe from message channel
   */
  const unsubscribeFromSession = useCallback((ws: WebSocket, sessionIdToUnsubscribe: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'unsubscribe',
          id: `message-subscription-${sessionIdToUnsubscribe}`,
        })
      );
      console.log(`📨 Unsubscribed from messages for session: ${sessionIdToUnsubscribe}`);
    }
    // Remove from tracked sessions
    subscribedSessionsRef.current.delete(sessionIdToUnsubscribe);
  }, []);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (keepAliveTimeoutRef.current) {
      clearTimeout(keepAliveTimeoutRef.current);
      keepAliveTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmount');
      wsRef.current = null;
    }
    setIsConnected(false);
    isConnectingRef.current = false;
    // Clear subscribed sessions on disconnect
    subscribedSessionsRef.current.clear();
  }, []);

  /**
   * Connect to AppSync Events
   */
  const connect = useCallback(() => {
    if (isConnectingRef.current) return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (!appsyncEventsConfig.isConfigured) {
      return;
    }

    const currentIdToken = idTokenRef.current;
    const currentUserId = userIdRef.current;
    const currentSessionId = currentSessionIdRef.current;

    if (!currentIdToken || !currentUserId || !currentSessionId) {
      return;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Reconnecting');
      wsRef.current = null;
    }

    isConnectingRef.current = true;

    try {
      const endpoint = appsyncEventsConfig.realtimeEndpoint;
      const realtimeHost = new URL(endpoint.replace('wss://', 'https://')).hostname;
      const httpHost = realtimeHost.replace('.appsync-realtime-api.', '.appsync-api.');
      httpHostRef.current = httpHost;

      const authorization = {
        Authorization: currentIdToken,
        host: httpHost,
      };

      const authProtocol = `header-${getBase64URLEncoded(authorization)}`;

      console.log('📨 Connecting to AppSync Events for messages');

      const ws = new WebSocket(endpoint, [authProtocol, 'aws-appsync-event-ws']);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('📨 WebSocket connected for messages');
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        setIsConnected(true);

        ws.send(JSON.stringify({ type: 'connection_init' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: AppSyncMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connection_ack': {
              // Subscribe to current session
              if (currentSessionIdRef.current) {
                subscribeToSession(ws, currentSessionIdRef.current);
              }
              break;
            }

            case 'subscribe_success':
              console.log('📨 Message subscription successful');
              break;

            case 'subscribe_error':
              console.error('📨 Message subscription error:', message);
              break;

            case 'data': {
              if (message.event) {
                const messageEvent = JSON.parse(message.event) as MessageEvent;
                handleMessageEvent(messageEvent);
              }
              break;
            }

            case 'ka':
              if (keepAliveTimeoutRef.current) {
                clearTimeout(keepAliveTimeoutRef.current);
              }
              break;

            case 'error':
              console.error('📨 WebSocket error message:', message);
              break;
          }
        } catch (error) {
          console.error('📨 Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('📨 WebSocket error:', error);
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log(`📨 WebSocket closed: code=${event.code}`);
        setIsConnected(false);
        isConnectingRef.current = false;

        if (keepAliveTimeoutRef.current) {
          clearTimeout(keepAliveTimeoutRef.current);
          keepAliveTimeoutRef.current = null;
        }

        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectRef.current();
          }, delay);
        }
      };
    } catch (error) {
      console.error('📨 Failed to connect:', error);
      isConnectingRef.current = false;
    }
  }, [subscribeToSession, handleMessageEvent]);

  // Update connect ref
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Handle session changes - resubscribe when session changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionId) return;

    // Subscribe to new session
    subscribeToSession(ws, sessionId);

    return () => {
      // Unsubscribe when session changes or component unmounts
      if (sessionId) {
        unsubscribeFromSession(ws, sessionId);
      }
    };
  }, [sessionId, isConnected, subscribeToSession, unsubscribeFromSession]);

  // Connect when we have auth and session
  useEffect(() => {
    if (idToken && userId && sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [idToken, userId, sessionId, connect, disconnect]);

  return {
    isConnected,
    reconnect: connect,
  };
}
