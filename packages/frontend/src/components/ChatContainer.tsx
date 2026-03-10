import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSelectedAgent, useAgentStore } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { AgentSelectorModal } from './AgentSelectorModal';
import { useMessageEventsSubscription } from '../hooks/useMessageEventsSubscription';
import type { Agent } from '../types/agent';
import { translateIfKey } from '../utils/agent-translation';

interface ChatContainerProps {
  sessionId: string | null;
  onCreateSession: () => string;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ sessionId, onCreateSession }) => {
  const { t } = useTranslation();
  const selectedAgent = useSelectedAgent();
  const isAgentLoading = useAgentStore((state) => state.isLoading);
  const { isMobileView } = useUIStore();
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [selectedScenarioPrompt, setSelectedScenarioPrompt] = useState<string | null>(null);

  // Subscribe to real-time message updates for cross-tab/cross-device sync
  useMessageEventsSubscription(sessionId);

  // Handle scenario click
  const handleScenarioClick = (prompt: string) => {
    setSelectedScenarioPrompt(prompt);
  };

  // Function to get scenario prompt (pass to MessageInput)
  const getScenarioPrompt = () => {
    const prompt = selectedScenarioPrompt;
    if (prompt) {
      setSelectedScenarioPrompt(null); // Use only once
    }
    return prompt;
  };

  // Handle agent selection
  const handleAgentSelect = (agent: Agent | null) => {
    console.log('Agent selected:', agent?.name || 'None');
  };

  return (
    <div className="chat-container">
      {/* Header - only shown on desktop */}
      {!isMobileView && (
        <header className="flex items-center justify-between p-4 bg-surface-primary">
          <div className="flex items-center">
            {isAgentLoading ? (
              <div className="flex items-center space-x-3 p-2">
                <div className="w-6 h-6 bg-border rounded animate-pulse" />
                <div className="h-6 bg-border rounded animate-pulse w-32" />
              </div>
            ) : (
              <button
                onClick={() => setIsAgentModalOpen(true)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-surface-secondary transition-colors group"
              >
                {(() => {
                  const AgentIcon = selectedAgent?.icon
                    ? (icons[selectedAgent.icon as keyof typeof icons] as LucideIcon) || Bot
                    : Bot;
                  return <AgentIcon className="w-6 h-6 text-fg-secondary" />;
                })()}
                <h1 className="text-lg font-semibold text-fg-default">
                  {selectedAgent ? translateIfKey(selectedAgent.name, t) : '汎用アシスタント'}
                </h1>
              </button>
            )}
          </div>
        </header>
      )}

      {/* Message list - reserve input form area with pb-32 */}
      <MessageList onScenarioClick={handleScenarioClick} />

      {/* Message input */}
      <MessageInput
        sessionId={sessionId}
        onCreateSession={onCreateSession}
        getScenarioPrompt={getScenarioPrompt}
      />

      {/* Select agent modal */}
      <AgentSelectorModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        onAgentSelect={handleAgentSelect}
      />
    </div>
  );
};
