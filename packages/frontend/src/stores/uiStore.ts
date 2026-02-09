/**
 * UI状態管理ストア
 * サイドバーの開閉状態などのUI要素を管理する
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type React from 'react';

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
   * ナローデスクトップ表示かどうか（768px以上1024px未満）
   */
  isNarrowDesktop: boolean;

  /**
   * モバイルヘッダーに表示するアクション（ボタンなど）
   */
  mobileHeaderAction: React.ReactNode | null;

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

  /**
   * ナローデスクトップ表示状態を設定する
   * @param isNarrow ナローデスクトップ表示状態
   */
  setNarrowDesktop: (isNarrow: boolean) => void;

  /**
   * モバイルヘッダーアクションを設定する
   * @param action レンダリングするReactノード
   */
  setMobileHeaderAction: (action: React.ReactNode | null) => void;
}

/**
 * UI状態管理ストア
 */
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Default: sidebar open
        isSidebarOpen: true,

        // Default: desktop view
        isMobileView: false,

        // Default: wide desktop
        isNarrowDesktop: false,

        // Default: no mobile header action
        mobileHeaderAction: null,

        toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

        setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

        setMobileView: (isMobile) => set({ isMobileView: isMobile }),

        setNarrowDesktop: (isNarrow) => set({ isNarrowDesktop: isNarrow }),

        setMobileHeaderAction: (action) => set({ mobileHeaderAction: action }),
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({ isSidebarOpen: state.isSidebarOpen }),
      }
    ),
    {
      name: 'ui-store',
      enabled: import.meta.env.DEV,
    }
  )
);
