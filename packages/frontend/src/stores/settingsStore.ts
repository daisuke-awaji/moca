/**
 * Settings Store
 * アプリケーション設定管理用のZustand store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODEL_ID } from '../config/models';

/**
 * 送信動作の設定値
 * - 'enter': Enter で送信、Shift+Enter で改行
 * - 'cmdEnter': Cmd/Ctrl+Enter で送信、Enter で改行
 */
export type SendBehavior = 'enter' | 'cmdEnter';

/**
 * テーマ設定値
 * - 'light': ライトモード
 * - 'dark': ダークモード
 * - 'system': システム設定に連動
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Settings Store の状態
 */
interface SettingsState {
  // Enter キーの動作設定
  sendBehavior: SendBehavior;

  // 選択中のモデルID
  selectedModelId: string;

  // テーマ設定
  theme: Theme;

  // アクション
  setSendBehavior: (behavior: SendBehavior) => void;
  setSelectedModelId: (modelId: string) => void;
  setTheme: (theme: Theme) => void;
}

/**
 * Settings Store
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // 初期状態: デフォルトは Enter で送信
      sendBehavior: 'enter',

      // 初期状態: デフォルトモデル
      selectedModelId: DEFAULT_MODEL_ID,

      // 初期状態: システム設定に連動
      theme: 'system',

      /**
       * Enter キーの動作設定を変更
       */
      setSendBehavior: (behavior: SendBehavior) => {
        set({ sendBehavior: behavior });
        console.log(`[SettingsStore] Send behavior changed to: ${behavior}`);
      },

      /**
       * 選択中のモデルIDを変更
       */
      setSelectedModelId: (modelId: string) => {
        set({ selectedModelId: modelId });
        console.log(`[SettingsStore] Model changed to: ${modelId}`);
      },

      /**
       * テーマ設定を変更
       */
      setTheme: (theme: Theme) => {
        set({ theme });
        console.log(`[SettingsStore] Theme changed to: ${theme}`);
      },
    }),
    {
      name: 'app-settings',
    }
  )
);
