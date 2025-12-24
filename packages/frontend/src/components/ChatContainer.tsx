import React, { useState } from 'react';
import { Bot, Menu } from 'lucide-react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSelectedAgent } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { AgentSelectorModal } from './AgentSelectorModal';
import type { Agent } from '../types/agent';

export const ChatContainer: React.FC = () => {
  const selectedAgent = useSelectedAgent();
  const { isMobileView, toggleSidebar } = useUIStore();
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [selectedScenarioPrompt, setSelectedScenarioPrompt] = useState<string | null>(null);

  // シナリオクリック処理
  const handleScenarioClick = (prompt: string) => {
    setSelectedScenarioPrompt(prompt);
  };

  // シナリオプロンプト取得関数（MessageInputに渡す）
  const getScenarioPrompt = () => {
    const prompt = selectedScenarioPrompt;
    if (prompt) {
      setSelectedScenarioPrompt(null); // 一度だけ使用
    }
    return prompt;
  };

  // Agent選択処理
  const handleAgentSelect = (agent: Agent | null) => {
    // Agent選択は AgentStore で管理されているのでここでは何もしない
    console.log('Agent selected:', agent?.name || 'None');
  };

  return (
    <div className="chat-container">
      {/* ヘッダー */}
      <header className="flex items-center justify-between p-4 bg-white">
        <div className="flex items-center">
          {/* モバイル時のハンバーガーメニュー */}
          {isMobileView && (
            <button
              onClick={toggleSidebar}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors mr-2"
              title="サイドバーを開く"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div>
            <button
              onClick={() => setIsAgentModalOpen(true)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              {(() => {
                const AgentIcon = selectedAgent?.icon
                  ? (icons[selectedAgent.icon as keyof typeof icons] as LucideIcon) || Bot
                  : Bot;
                return <AgentIcon className="w-6 h-6 text-gray-700" />;
              })()}
              <h1 className="text-lg font-semibold text-gray-900">
                {selectedAgent ? selectedAgent.name : '汎用アシスタント'}
              </h1>
            </button>
          </div>
        </div>
      </header>

      {/* メッセージリスト */}
      <MessageList onScenarioClick={handleScenarioClick} />

      {/* メッセージ入力 */}
      <MessageInput getScenarioPrompt={getScenarioPrompt} />

      {/* Agent選択モーダル */}
      <AgentSelectorModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        onAgentSelect={handleAgentSelect}
      />
    </div>
  );
};
