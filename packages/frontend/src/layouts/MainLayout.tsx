/**
 * メインレイアウトコンポーネント
 * サイドバーと共通レイアウトを提供
 */

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SessionSidebar } from '../components/SessionSidebar';
import { useUIStore } from '../stores/uiStore';

export function MainLayout() {
  const { isSidebarOpen, isMobileView, setSidebarOpen, setMobileView } = useUIStore();

  // レスポンシブ対応: 768px未満でモバイル表示に切り替え
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const handleMediaChange = (e: MediaQueryListEvent) => {
      const isMobile = e.matches;
      setMobileView(isMobile);

      if (isMobile) {
        // モバイル画面: サイドバーを閉じる
        setSidebarOpen(false);
      } else {
        // デスクトップ画面: サイドバーを開く
        setSidebarOpen(true);
      }
    };

    // 初回チェック
    const isMobile = mediaQuery.matches;
    setMobileView(isMobile);
    if (isMobile) {
      setSidebarOpen(false);
    }

    // リスナー登録
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [setSidebarOpen, setMobileView]);

  // オーバーレイのクリック処理（モバイル時のみ）
  const handleOverlayClick = () => {
    if (isMobileView) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-full w-full relative">
      {/* モバイル時のオーバーレイ背景 */}
      {isMobileView && isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleOverlayClick} />
      )}

      {/* サイドバー */}
      {isMobileView ? (
        // モバイル時: オーバーレイサイドバー
        <div
          className={`
            fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <SessionSidebar />
        </div>
      ) : (
        // デスクトップ時: 通常のサイドバー
        <div
          className={`
            transition-all duration-300 ease-in-out flex-shrink-0
            ${isSidebarOpen ? 'w-80' : 'w-16'}
          `}
        >
          <SessionSidebar />
        </div>
      )}

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <Outlet />
      </div>
    </div>
  );
}
