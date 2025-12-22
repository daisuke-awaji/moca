import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';

interface MessageInputProps {
  getScenarioPrompt?: () => string | null;
}

export const MessageInput: React.FC<MessageInputProps> = ({ getScenarioPrompt }) => {
  const { sendPrompt, isLoading, clearError } = useChatStore();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // テキストエリアの自動リサイズ
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // シナリオプロンプトの自動入力
  useEffect(() => {
    if (getScenarioPrompt) {
      const scenarioPrompt = getScenarioPrompt();
      if (scenarioPrompt) {
        // 次のフレームで実行してカスケードレンダリングを防ぐ
        requestAnimationFrame(() => {
          setInput(scenarioPrompt);
          // フォーカスを当ててカーソルを末尾に移動
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(scenarioPrompt.length, scenarioPrompt.length);
            }
          }, 0);
        });
      }
    }
  }, [getScenarioPrompt]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // チャットストアのエラーをクリア
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) {
      return;
    }

    try {
      // 送信するメッセージを保存
      const messageToSend = input.trim();

      // 入力フィールドを即座にクリア
      setInput('');

      // メッセージ送信（非同期で継続）
      await sendPrompt(messageToSend);
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift + Enter で改行、Enter で送信（IME変換中は除く）
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="relative">
          {/* テキスト入力エリア */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力してください..."
            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent resize-none min-h-[52px] max-h-[200px] bg-white"
            disabled={isLoading}
            rows={1}
            style={{ height: 'auto' }}
          />

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              !input.trim() || isLoading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* ヘルプテキスト */}
        <p className="mt-2 text-xs text-gray-500">Shift + Enter で改行、Enter で送信</p>
      </form>
    </div>
  );
};
