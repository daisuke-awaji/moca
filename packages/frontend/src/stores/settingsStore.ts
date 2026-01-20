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
 * Settings Store の状態
 */
interface SettingsState {
  // Enter キーの動作設定
  sendBehavior: SendBehavior;

  // 選択中のモデルID
  selectedModelId: string;

  // アクション
  setSendBehavior: (behavior: SendBehavior) => void;
  setSelectedModelId: (modelId: string) => void;
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
    }),
    {
      name: 'app-settings',
    }
  )
);
