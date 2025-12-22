/**
 * メインレイアウトコンポーネント
 * サイドバーと共通レイアウトを提供
 */

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SessionSidebar } from '../components/SessionSidebar';
import { useUIStore } from '../stores/uiStore';

export function MainLayout() {
  const { isSidebarOpen, setSidebarOpen } = useUIStore();

  // レスポンシブ対応: 768px未満でサイドバーを自動的に閉じる
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        // モバイル画面: サイドバーを閉じる
        setSidebarOpen(false);
      } else {
        // デスクトップ画面: サイドバーを開く
        setSidebarOpen(true);
      }
    };

    // 初回チェック
    if (mediaQuery.matches) {
      setSidebarOpen(false);
    }

    // リスナー登録
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [setSidebarOpen]);

  return (
    <div className="flex h-full w-full">
      {/* サイドバー - 常に表示、幅のみ切り替え */}
      <div
        className={`
          transition-all duration-300 ease-in-out flex-shrink-0
          ${isSidebarOpen ? 'w-80' : 'w-16'}
        `}
      >
        <SessionSidebar />
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <Outlet />
      </div>
    </div>
  );
}
