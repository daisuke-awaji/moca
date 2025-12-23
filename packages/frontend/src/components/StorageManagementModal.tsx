/**
 * Storage Management Modal
 * ユーザーファイルストレージの管理モーダル
 */

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Folder,
  File,
  Upload,
  FolderPlus,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Home,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { useStorageStore } from '../stores/storageStore';
import type { StorageItem } from '../api/storage';
import { Modal } from './ui/Modal/Modal';
import { generateDownloadUrl } from '../api/storage';

interface StorageManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ファイル/ディレクトリアイテム表示コンポーネント
 */
interface StorageItemComponentProps {
  item: StorageItem;
  onDelete: (item: StorageItem) => void;
  onNavigate: (path: string) => void;
  onDownload: (item: StorageItem) => void;
  onContextMenu: (e: React.MouseEvent, item: StorageItem) => void;
  isDeleting: boolean;
}

function StorageItemComponent({
  item,
  onDelete,
  onNavigate,
  onDownload,
  onContextMenu,
  isDeleting,
}: StorageItemComponentProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // カードのクリックイベントを止める
    if (
      window.confirm(
        `${item.type === 'directory' ? 'ディレクトリ' : 'ファイル'} "${item.name}" を削除しますか？`
      )
    ) {
      onDelete(item);
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // カードのクリックイベントを止める
    onDownload(item);
  };

  const handleCardClick = () => {
    if (item.type === 'directory') {
      onNavigate(item.path);
    } else {
      // ファイルの場合はダウンロード
      onDownload(item);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, item);
  };

  return (
    <div
      onClick={handleCardClick}
      onContextMenu={handleContextMenuClick}
      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="flex items-center gap-3">
        {/* アイコン */}
        <div className="flex-shrink-0">
          {item.type === 'directory' ? (
            <Folder className="w-5 h-5 text-amber-500" />
          ) : (
            <File className="w-5 h-5 text-blue-500" />
          )}
        </div>

        {/* 情報 */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
            {item.type === 'file' && <span>{formatSize(item.size)}</span>}
            <span>{formatDate(item.lastModified)}</span>
          </div>
        </div>

        {/* アクション */}
        <div className="flex items-center gap-2">
          {item.type === 'file' && (
            <button
              onClick={handleDownloadClick}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="ダウンロード"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="削除"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Storage Management Modal
 */
export function StorageManagementModal({ isOpen, onClose }: StorageManagementModalProps) {
  const {
    currentPath,
    items,
    isLoading,
    error,
    isUploading,
    uploadProgress,
    loadItems,
    uploadFile,
    createDirectory,
    deleteItem,
    clearError,
  } = useStorageStore();

  const [newDirectoryName, setNewDirectoryName] = useState('');
  const [showNewDirectoryInput, setShowNewDirectoryInput] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingItemPath, setDeletingItemPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // モーダル表示時にデータを読み込み
  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  // コンテキストメニューの外部クリックを検知
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [contextMenu]);

  // パスナビゲーション
  const handleNavigate = (path: string) => {
    loadItems(path);
  };

  const handleNavigateToRoot = () => {
    loadItems('/');
  };

  // パンくずリスト作成
  const pathSegments = currentPath.split('/').filter(Boolean);

  // ファイルアップロード
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // リセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ドラッグ&ドロップ
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    await handleFileSelect(files);
  };

  // ディレクトリ作成
  const handleCreateDirectory = async () => {
    if (!newDirectoryName.trim()) return;

    await createDirectory(newDirectoryName);
    setNewDirectoryName('');
    setShowNewDirectoryInput(false);
  };

  // 削除
  const handleDelete = async (item: StorageItem) => {
    setDeletingItemPath(item.path);
    await deleteItem(item);
    setDeletingItemPath(null);
  };

  // ダウンロード
  const handleDownload = async (item: StorageItem) => {
    try {
      const downloadUrl = await generateDownloadUrl(item.path);
      // 新しいタブでダウンロードURLを開く
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  // コンテキストメニュー表示
  const handleContextMenu = (e: React.MouseEvent, item: StorageItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      path: item.path,
    });
  };

  // パスをコピー
  const handleCopyPath = async () => {
    if (!contextMenu) return;

    try {
      await navigator.clipboard.writeText(contextMenu.path);
      setCopiedPath(contextMenu.path);
      setTimeout(() => {
        setCopiedPath(null);
        setContextMenu(null);
      }, 1500);
    } catch (error) {
      console.error('Copy error:', error);
      setContextMenu(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" className="max-w-4xl">
      {/* ヘッダー */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">ファイルストレージ</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* パンくずナビゲーション */}
        <div className="flex items-center gap-1 mt-3 text-sm">
          <button
            onClick={handleNavigateToRoot}
            className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>ルート</span>
          </button>

          {pathSegments.map((segment, index) => {
            const segmentPath = '/' + pathSegments.slice(0, index + 1).join('/');
            return (
              <div key={segmentPath} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => handleNavigate(segmentPath)}
                  className="px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  {segment}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ツールバー */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="w-4 h-4" />
            ファイルアップロード
          </button>

          <button
            onClick={() => setShowNewDirectoryInput(!showNewDirectoryInput)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            新規フォルダ
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        {/* 新規ディレクトリ入力 */}
        {showNewDirectoryInput && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={newDirectoryName}
              onChange={(e) => setNewDirectoryName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateDirectory()}
              placeholder="フォルダ名を入力"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleCreateDirectory}
              disabled={!newDirectoryName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              作成
            </button>
            <button
              onClick={() => {
                setShowNewDirectoryInput(false);
                setNewDirectoryName('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
            >
              キャンセル
            </button>
          </div>
        )}

        {/* アップロード進捗 */}
        {isUploading && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>アップロード中...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* コンテンツエリア */}
      <div
        className={`px-6 py-4 overflow-y-auto flex-1 min-h-0 ${
          isDragOver ? 'bg-blue-50 border-2 border-dashed border-blue-400' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={clearError}
                className="text-sm text-red-600 hover:text-red-800 font-medium mt-1"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* ローディング */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-600">読み込み中...</span>
          </div>
        )}

        {/* アイテム一覧 */}
        {!isLoading && (
          <>
            {items.length === 0 ? (
              <div className="text-center py-12">
                <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">フォルダが空です</p>
                <p className="text-xs text-gray-500">
                  ファイルをドラッグ&ドロップするか、アップロードボタンをクリックしてください
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <StorageItemComponent
                    key={item.path}
                    item={item}
                    onDelete={handleDelete}
                    onNavigate={handleNavigate}
                    onDownload={handleDownload}
                    onContextMenu={handleContextMenu}
                    isDeleting={deletingItemPath === item.path}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ドラッグオーバー時のオーバーレイ */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 pointer-events-none">
            <div className="text-center">
              <Upload className="w-12 h-12 text-blue-500 mx-auto mb-2" />
              <p className="text-lg font-medium text-blue-900">ファイルをドロップ</p>
            </div>
          </div>
        )}

        {/* コンテキストメニュー */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            <button
              onClick={handleCopyPath}
              className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2 transition-colors"
            >
              {copiedPath === contextMenu.path ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">コピーしました</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-900">パスをコピー</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {items.length} 件のアイテム • 最大ファイルサイズ: 5MB
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
}
