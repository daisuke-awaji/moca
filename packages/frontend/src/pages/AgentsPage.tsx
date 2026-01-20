/**
 * エージェント検索ページ
 * 今後実装予定のプレースホルダー
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Construction } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * エージェント検索ページメインコンポーネント
 */
export function AgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBackToChat = () => {
    navigate('/chat');
  };

  return (
    <>
      <PageHeader icon={Bot} title={t('navigation.searchAgents')} />

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
          <div className="text-center max-w-md">
            {/* Coming Soon アイコン */}
            <div className="mb-6">
              <Construction className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto" />
            </div>

            {/* Coming Soon タイトル */}
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('agent.comingSoon')}</h2>

            {/* Description文 */}
            <div className="space-y-3 mb-8">
              <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500 text-base">{t('agent.searchAgentsDescription')}</p>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">{t('agent.searchAgentsFeature')}</p>
            </div>

            {/* チャットに戻るボタン */}
            <button
              onClick={handleBackToChat}
              className="px-6 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 dark:text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
            >
              {t('agent.backToChat')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
