/**
 * Storage Path Display
 * ユーザーストレージパスを表示し、クリックでモーダルを開く
 */

import { Folder } from 'lucide-react';
import { useStorageStore } from '../stores/storageStore';

interface StoragePathDisplayProps {
  onClick: () => void;
}

export function StoragePathDisplay({ onClick }: StoragePathDisplayProps) {
  const { currentPath } = useStorageStore();

  // パスを短縮表示（最大40文字）
  const displayPath = currentPath.length > 40 ? '...' + currentPath.slice(-37) : currentPath;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 group"
      title={`ストレージ: ${currentPath}`}
    >
      <Folder className="w-4 h-4 text-amber-500 group-hover:text-amber-600 transition-colors" />
      <span className="font-mono text-xs">{displayPath}</span>
    </button>
  );
}
