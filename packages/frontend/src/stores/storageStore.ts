/**
 * Storage Store
 * ユーザーファイルストレージの状態管理
 */

import { create } from 'zustand';
import type { StorageItem, ListStorageResponse } from '../api/storage';
import * as storageApi from '../api/storage';

interface StorageState {
  // 状態
  currentPath: string;
  items: StorageItem[];
  isLoading: boolean;
  error: string | null;
  isUploading: boolean;
  uploadProgress: number;

  // アクション
  setCurrentPath: (path: string) => void;
  loadItems: (path?: string) => Promise<void>;
  uploadFile: (file: File, path?: string) => Promise<void>;
  createDirectory: (directoryName: string, path?: string) => Promise<void>;
  deleteItem: (item: StorageItem) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export const useStorageStore = create<StorageState>((set, get) => ({
  // 初期状態
  currentPath: '/',
  items: [],
  isLoading: false,
  error: null,
  isUploading: false,
  uploadProgress: 0,

  // パスを設定
  setCurrentPath: (path: string) => {
    set({ currentPath: path });
  },

  // アイテム一覧を読み込み
  loadItems: async (path?: string) => {
    const targetPath = path ?? get().currentPath;

    set({ isLoading: true, error: null });

    try {
      const response: ListStorageResponse = await storageApi.listStorageItems(targetPath);

      set({
        items: response.items,
        currentPath: response.path,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load storage items:', error);
      set({
        error: error instanceof Error ? error.message : 'ストレージの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  // ファイルをアップロード
  uploadFile: async (file: File, path?: string) => {
    const targetPath = path ?? get().currentPath;

    // ファイルサイズチェック（5MB制限）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      set({
        error:
          'ファイルサイズが5MBを超えています。Bedrock Converse APIの制限により、5MB以下のファイルをアップロードしてください。',
      });
      return;
    }

    set({ isUploading: true, uploadProgress: 0, error: null });

    try {
      // 署名付きURL取得
      set({ uploadProgress: 10 });
      const uploadUrlResponse = await storageApi.generateUploadUrl(
        file.name,
        targetPath,
        file.type
      );

      // S3にアップロード
      set({ uploadProgress: 30 });
      await storageApi.uploadFileToS3(uploadUrlResponse.uploadUrl, file);

      set({ uploadProgress: 90 });

      // リストを再読み込み
      await get().loadItems(targetPath);

      set({
        isUploading: false,
        uploadProgress: 100,
      });

      // プログレスをリセット
      setTimeout(() => {
        set({ uploadProgress: 0 });
      }, 1000);
    } catch (error) {
      console.error('Failed to upload file:', error);
      set({
        error: error instanceof Error ? error.message : 'ファイルのアップロードに失敗しました',
        isUploading: false,
        uploadProgress: 0,
      });
    }
  },

  // ディレクトリを作成
  createDirectory: async (directoryName: string, path?: string) => {
    const targetPath = path ?? get().currentPath;

    set({ isLoading: true, error: null });

    try {
      await storageApi.createDirectory(directoryName, targetPath);

      // リストを再読み込み
      await get().loadItems(targetPath);
    } catch (error) {
      console.error('Failed to create directory:', error);
      set({
        error: error instanceof Error ? error.message : 'ディレクトリの作成に失敗しました',
        isLoading: false,
      });
    }
  },

  // アイテムを削除
  deleteItem: async (item: StorageItem) => {
    set({ isLoading: true, error: null });

    try {
      if (item.type === 'file') {
        await storageApi.deleteFile(item.path);
      } else {
        await storageApi.deleteDirectory(item.path);
      }

      // リストを再読み込み
      await get().loadItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
      set({
        error: error instanceof Error ? error.message : 'アイテムの削除に失敗しました',
        isLoading: false,
      });
    }
  },

  // 現在のパスを再読み込み
  refresh: async () => {
    await get().loadItems();
  },

  // エラーをクリア
  clearError: () => {
    set({ error: null });
  },
}));
