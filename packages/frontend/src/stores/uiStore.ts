/**
 * UI状態管理ストア
 * サイドバーの開閉状態などのUI要素を管理する
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  /**
   * サイドバーが開いているかどうか
   */
  isSidebarOpen: boolean;

  /**
   * モバイル表示かどうか（768px未満）
   */
  isMobileView: boolean;

  /**
   * サイドバーの開閉を切り替える
   */
  toggleSidebar: () => void;

  /**
   * サイドバーの開閉状態を設定する
   * @param isOpen 開閉状態
   */
  setSidebarOpen: (isOpen: boolean) => void;

  /**
   * モバイル表示状態を設定する
   * @param isMobile モバイル表示状態
   */
  setMobileView: (isMobile: boolean) => void;
}

/**
 * UI状態管理ストア
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // デフォルトはサイドバー開いた状態
      isSidebarOpen: true,

      // デフォルトはデスクトップ表示
      isMobileView: false,

      toggleSidebar: () =>
        set((state) => {
          const newState = !state.isSidebarOpen;
          console.log(`🔀 サイドバー切り替え: ${newState ? '開く' : '閉じる'}`);
          return { isSidebarOpen: newState };
        }),

      setSidebarOpen: (isOpen) =>
        set(() => {
          console.log(`📐 サイドバー状態設定: ${isOpen ? '開く' : '閉じる'}`);
          return { isSidebarOpen: isOpen };
        }),

      setMobileView: (isMobile) =>
        set(() => {
          console.log(`📱 モバイル表示状態: ${isMobile ? 'モバイル' : 'デスクトップ'}`);
          return { isMobileView: isMobile };
        }),
    }),
    {
      name: 'ui-storage', // localStorage のキー名
      partialize: (state) => ({ isSidebarOpen: state.isSidebarOpen }), // 永続化する項目を指定
    }
  )
);
