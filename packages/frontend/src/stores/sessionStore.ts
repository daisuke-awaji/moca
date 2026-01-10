/**
 * Session Management Store
 * State management for session list and active session
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { customAlphabet } from 'nanoid';
import toast from 'react-hot-toast';
import { fetchSessions, fetchSessionEvents } from '../api/sessions';
import type { SessionSummary, ConversationMessage } from '../api/sessions';
import { ApiError } from '../api/client/base-client';
import i18n from '../i18n';

// AWS AgentCore sessionId constraints: [a-zA-Z0-9][a-zA-Z0-9-_]*
// Custom nanoid with alphanumeric characters only (excluding hyphens and underscores)
const generateSessionId = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  33
);

/**
 * Session store state type definition
 */
interface SessionState {
  sessions: SessionSummary[];
  isLoadingSessions: boolean;
  sessionsError: string | null;
  hasLoadedOnce: boolean; // Initial load completion flag

  activeSessionId: string | null;
  sessionEvents: ConversationMessage[];
  isLoadingEvents: boolean;
  eventsError: string | null;

  isCreatingSession: boolean; // New session creation in progress flag
}

/**
 * Session store actions type definition
 */
interface SessionActions {
  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  setActiveSessionId: (sessionId: string) => void;
  clearActiveSession: () => void;
  setSessionsError: (error: string | null) => void;
  setEventsError: (error: string | null) => void;
  clearErrors: () => void;
  refreshSessions: () => Promise<void>;
  createNewSession: () => string; // Create new session (generate ID and set flag)
  finalizeNewSession: () => void; // Finalize new session creation (clear flag)
  addOptimisticSession: (sessionId: string, title?: string) => void; // Optimistically add session to sidebar
  updateSessionTitle: (sessionId: string, title: string) => void; // Update session title
}

/**
 * Session management store
 */
type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  devtools(
    (set, get) => ({
      // State
      sessions: [],
      isLoadingSessions: false,
      sessionsError: null,
      hasLoadedOnce: false, // Initial load completion flag

      activeSessionId: null,
      sessionEvents: [],
      isLoadingEvents: false,
      eventsError: null,
      isCreatingSession: false, // New session creation in progress flag

      // Actions
      loadSessions: async () => {
        try {
          set({ isLoadingSessions: true, sessionsError: null });

          console.log('🔄 Loading all sessions...');
          const sessions = await fetchSessions();

          set({
            sessions,
            isLoadingSessions: false,
            sessionsError: null,
            hasLoadedOnce: true, // Set initial load completion flag
          });

          console.log(`✅ Session list loaded: ${sessions.length} items`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to load session list';
          console.error('💥 Session list loading error:', error);

          set({
            sessions: [],
            isLoadingSessions: false,
            sessionsError: errorMessage,
            hasLoadedOnce: true, // Mark as initial load completed even on error
          });
        }
      },

      selectSession: async (sessionId: string) => {
        try {
          set({
            isLoadingEvents: true,
            eventsError: null,
            activeSessionId: sessionId,
          });

          console.log(`🔄 Selecting session: ${sessionId}`);
          const events = await fetchSessionEvents(sessionId);

          set({
            sessionEvents: events,
            isLoadingEvents: false,
            eventsError: null,
          });

          console.log(`✅ Session conversation history loaded: ${events.length} items`);
        } catch (error) {
          // Handle 403 Forbidden - redirect to /chat
          if (error instanceof ApiError && error.status === 403) {
            console.warn(`⚠️ Access denied to session: ${sessionId}`);
            toast.error(i18n.t('error.forbidden'));
            set({
              activeSessionId: null,
              sessionEvents: [],
              isLoadingEvents: false,
              eventsError: null,
            });
            window.location.href = '/chat';
            return;
          }

          const errorMessage =
            error instanceof Error ? error.message : 'Failed to load session conversation history';
          console.error('💥 Session conversation history loading error:', error);

          set({
            sessionEvents: [],
            isLoadingEvents: false,
            eventsError: errorMessage,
          });
        }
      },

      setActiveSessionId: (sessionId: string) => {
        set({
          activeSessionId: sessionId,
          sessionEvents: [], // Empty conversation history for new session
          eventsError: null,
          isLoadingEvents: false,
        });
        console.log(`🆕 Set new session as active: ${sessionId}`);
      },

      clearActiveSession: () => {
        set({
          activeSessionId: null,
          sessionEvents: [],
          eventsError: null,
          isLoadingEvents: false, // Explicitly clear loading state for new chat
        });
        console.log('🗑️ Cleared active session');
      },

      setSessionsError: (error: string | null) => {
        set({ sessionsError: error });
      },

      setEventsError: (error: string | null) => {
        set({ eventsError: error });
      },

      clearErrors: () => {
        set({
          sessionsError: null,
          eventsError: null,
        });
      },

      refreshSessions: async () => {
        // Reload all sessions (without clearing first to prevent UI flash)
        const { loadSessions } = get();
        console.log('🔄 Refreshing session list...');
        await loadSessions();
      },

      createNewSession: () => {
        const newSessionId = generateSessionId();
        set({
          activeSessionId: newSessionId,
          sessionEvents: [],
          eventsError: null,
          isLoadingEvents: false,
          isCreatingSession: true, // Set new session creation flag
        });
        console.log(`🆕 Created new session: ${newSessionId}`);
        return newSessionId;
      },

      finalizeNewSession: () => {
        set({ isCreatingSession: false });
        console.log('✅ New session creation completed');
      },

      addOptimisticSession: (sessionId: string, title?: string) => {
        const { sessions } = get();

        // Check if session already exists
        const exists = sessions.some((s) => s.sessionId === sessionId);
        if (exists) {
          console.log(`⚠️ Session ${sessionId} already exists, skipping optimistic add`);
          return;
        }

        // Create optimistic session with title or placeholder
        const optimisticSession: SessionSummary = {
          sessionId,
          title: title || 'New conversation...',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Add to beginning of list
        set({
          sessions: [optimisticSession, ...sessions],
        });

        console.log(`✨ Optimistically added session: ${sessionId} - "${optimisticSession.title}"`);
      },

      updateSessionTitle: (sessionId: string, title: string) => {
        const { sessions } = get();

        const updatedSessions = sessions.map((session) =>
          session.sessionId === sessionId
            ? { ...session, title, updatedAt: new Date().toISOString() }
            : session
        );

        set({ sessions: updatedSessions });
        console.log(`📝 Updated session title: ${sessionId} - "${title}"`);
      },
    }),
    {
      name: 'session-store',
    }
  )
);

/**
 * Session-related selectors (utility functions)
 */
export const sessionSelectors = {
  /**
   * Get session information for specified session ID
   */
  getSessionById: (sessionId: string) => {
    const { sessions } = useSessionStore.getState();
    return sessions.find((session) => session.sessionId === sessionId);
  },

  /**
   * Check if any session loading is in progress
   */
  isAnyLoading: () => {
    const { isLoadingSessions, isLoadingEvents } = useSessionStore.getState();
    return isLoadingSessions || isLoadingEvents;
  },

  /**
   * Check if there are any errors
   */
  hasAnyError: () => {
    const { sessionsError, eventsError } = useSessionStore.getState();
    return !!sessionsError || !!eventsError;
  },

  /**
   * Get all error messages as an array
   */
  getAllErrors: () => {
    const { sessionsError, eventsError } = useSessionStore.getState();
    return [sessionsError, eventsError].filter(Boolean) as string[];
  },
};
