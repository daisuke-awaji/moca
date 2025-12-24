/**
 * Storage Store
 * ユーザーファイルストレージの状態管理
 */

import { create } from 'zustand';
import type { StorageItem, ListStorageResponse, FolderNode } from '../api/storage';
import * as storageApi from '../api/storage';

// localStorageキー
const STORAGE_PATH_KEY = 'storage-current-path';
const EXPANDED_FOLDERS_KEY = 'storage-expanded-folders';

interface StorageState {
  // 状態
  currentPath: string;
  items: StorageItem[];
  isLoading: boolean;
  error: string | null;
  isUploading: boolean;
  uploadProgress: number;

  // フォルダツリー関連
  folderTree: FolderNode[];
  isTreeLoading: boolean;
  expandedFolders: Set<string>;

  // アクション
  setCurrentPath: (path: string) => void;
  loadItems: (path?: string) => Promise<void>;
  uploadFile: (file: File, path?: string) => Promise<void>;
  createDirectory: (directoryName: string, path?: string) => Promise<void>;
  deleteItem: (item: StorageItem) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;

  // フォルダツリーアクション
  loadFolderTree: () => Promise<void>;
  toggleFolderExpand: (path: string) => void;
  setExpandedFolders: (folders: Set<string>) => void;
}

// localStorageから展開フォルダを読み込み
const loadExpandedFolders = (): Set<string> => {
  try {
    const stored = localStorage.getItem(EXPANDED_FOLDERS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (error) {
    console.error('Failed to load expanded folders from localStorage:', error);
  }
  return new Set(['/']); // デフォルトでルートを展開
};

// localStorageに展開フォルダを保存
const saveExpandedFolders = (folders: Set<string>) => {
  try {
    localStorage.setItem(EXPANDED_FOLDERS_KEY, JSON.stringify(Array.from(folders)));
  } catch (error) {
    console.error('Failed to save expanded folders to localStorage:', error);
  }
};

export const useStorageStore = create<StorageState>((set, get) => ({
  // 初期状態（localStorageから読み込み）
  currentPath: localStorage.getItem(STORAGE_PATH_KEY) || '/',
  items: [],
  isLoading: false,
  error: null,
  isUploading: false,
  uploadProgress: 0,

  // フォルダツリー初期状態
  folderTree: [],
  isTreeLoading: false,
  expandedFolders: loadExpandedFolders(),

  // パスを設定
  setCurrentPath: (path: string) => {
    set({ currentPath: path });
    // localStorageに保存
    localStorage.setItem(STORAGE_PATH_KEY, path);
  },

  // アイテム一覧を読み込み
  loadItems: async (path?: string) => {
    const targetPath = path ?? get().currentPath;

    set({ isLoading: true, error: null });

    try {
      const response: ListStorageResponse = await storageApi.listStorageItems(targetPath);

      // localStorageに保存
      localStorage.setItem(STORAGE_PATH_KEY, response.path);

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
  uploadFile: async (file: File, relativePathOrPath?: string) => {
    // relativePathOrPathが相対パス（サブディレクトリ含む）の場合は、現在のパスと結合
    // そうでない場合（絶対パス）は、そのまま使用
    const currentPath = get().currentPath;
    let targetPath: string;
    let fileName: string;

    if (relativePathOrPath && relativePathOrPath.includes('/')) {
      // 相対パスが含まれている場合（例: "folder/file.txt"）
      const pathParts = relativePathOrPath.split('/');
      fileName = pathParts[pathParts.length - 1];
      const dirPath = pathParts.slice(0, -1).join('/');
      targetPath = currentPath === '/' ? `/${dirPath}` : `${currentPath}/${dirPath}`;
    } else if (relativePathOrPath) {
      // ファイル名のみ、または絶対パス
      fileName = relativePathOrPath;
      targetPath = currentPath;
    } else {
      // パスが指定されていない場合
      fileName = file.name;
      targetPath = currentPath;
    }

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
      const uploadUrlResponse = await storageApi.generateUploadUrl(fileName, targetPath, file.type);

      // S3にアップロード
      set({ uploadProgress: 30 });
      await storageApi.uploadFileToS3(uploadUrlResponse.uploadUrl, file);

      set({ uploadProgress: 90 });

      // リストを再読み込み（現在のパスで）
      await get().loadItems(currentPath);

      // 新しいディレクトリが作成された可能性があるのでツリーも更新
      await get().loadFolderTree();

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

      // ツリーを更新
      await get().loadFolderTree();
    } catch (error) {
      console.error('Failed to create directory:', error);
      set({
        error: error instanceof Error ? error.message : 'ディレクトリの作成に失敗しました',
        isLoading: false,
      });
    }
  },

  // アイテムを削除
  deleteItem: async (item: StorageItem, force: boolean = true) => {
    set({ isLoading: true, error: null });

    try {
      if (item.type === 'file') {
        await storageApi.deleteFile(item.path);
      } else {
        // ディレクトリの場合は force=true で削除（中身も含めて削除）
        await storageApi.deleteDirectory(item.path, force);
      }

      // リストを再読み込み
      await get().loadItems();

      // ディレクトリが削除された場合はツリーも更新
      if (item.type === 'directory') {
        await get().loadFolderTree();
      }
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

  // フォルダツリーを読み込み
  loadFolderTree: async () => {
    set({ isTreeLoading: true });

    try {
      const response = await storageApi.fetchFolderTree();
      set({
        folderTree: response.tree,
        isTreeLoading: false,
      });
    } catch (error) {
      console.error('Failed to load folder tree:', error);
      set({
        error: error instanceof Error ? error.message : 'フォルダツリーの読み込みに失敗しました',
        isTreeLoading: false,
      });
    }
  },

  // フォルダの展開/折りたたみをトグル
  toggleFolderExpand: (path: string) => {
    const expandedFolders = new Set(get().expandedFolders);
    if (expandedFolders.has(path)) {
      expandedFolders.delete(path);
    } else {
      expandedFolders.add(path);
    }
    set({ expandedFolders });
    saveExpandedFolders(expandedFolders);
  },

  // 展開フォルダのセットを設定
  setExpandedFolders: (folders: Set<string>) => {
    set({ expandedFolders: folders });
    saveExpandedFolders(folders);
  },
}));
