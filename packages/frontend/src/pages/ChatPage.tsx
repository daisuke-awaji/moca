import { ChatContainer } from '../components/ChatContainer';
import { useSessionSync } from '../hooks/useSessionSync';

/**
 * Chat Page
 * - /chat: New chat (no sessionId)
 * - /chat/:sessionId: Continue existing session
 */
export function ChatPage() {
  const { currentSessionId, createAndNavigateToNewSession } = useSessionSync();

  return (
    <ChatContainer sessionId={currentSessionId} onCreateSession={createAndNavigateToNewSession} />
  );
}
