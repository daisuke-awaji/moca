import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatContainer } from '../components/ChatContainer';
import { useChatStore, setNavigateFunction } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';

/**
 * チャットページ
 * - /chat: 新規チャット（sessionId なし）
 * - /chat/:sessionId: 既存セッションの継続
 */
export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { setSessionId, clearMessages, loadSessionHistory } = useChatStore();
  const { sessionEvents, activeSessionId, isLoadingEvents } = useSessionStore();

  // navigate 関数を chatStore に設定
  useEffect(() => {
    setNavigateFunction(navigate);
  }, [navigate]);

  // URL の sessionId を store に同期するだけ
  useEffect(() => {
    console.log(`🔄 URL sessionId: ${sessionId || 'null'}`);

    if (sessionId) {
      // sessionId が存在する場合は store に設定
      setSessionId(sessionId);
    } else {
      // /chat（sessionId なし）の場合
      setSessionId(null);
      // 明示的に新規チャットを開始する場合のみメッセージクリア
      clearMessages();
    }
  }, [sessionId, setSessionId, clearMessages]);

  // セッション履歴を chatStore に復元
  useEffect(() => {
    if (
      sessionId &&
      activeSessionId === sessionId &&
      sessionEvents.length > 0 &&
      !isLoadingEvents
    ) {
      console.log(`📖 セッション履歴を ChatStore に復元: ${sessionId}`);
      loadSessionHistory(sessionEvents);
    }
  }, [sessionId, activeSessionId, sessionEvents, isLoadingEvents, loadSessionHistory]);

  return <ChatContainer />;
}
