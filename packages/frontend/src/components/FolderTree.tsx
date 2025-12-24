/**
 * Folder Tree Component
 * 再帰的なフォルダツリー表示コンポーネント
 */

import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import type { FolderNode } from '../api/storage';

interface TreeNodeProps {
  node: FolderNode;
  level: number;
  selectedPath: string;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
}

function TreeNode({
  node,
  level,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggleExpand,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    onSelect(node.path);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(node.path);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* 展開/折りたたみアイコン */}
        <button
          onClick={handleToggle}
          className={`p-0.5 hover:bg-gray-200 rounded transition-colors ${
            !hasChildren ? 'invisible' : ''
          }`}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* フォルダアイコン */}
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-amber-500" />
        ) : (
          <Folder className="w-4 h-4 text-amber-500" />
        )}

        {/* フォルダ名 */}
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {/* 子ノード（展開時のみ表示） */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderTreeProps {
  tree: FolderNode[];
  selectedPath: string;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
  isLoading?: boolean;
}

export function FolderTree({
  tree,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggleExpand,
  isLoading,
}: FolderTreeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">フォルダがありません</div>
      </div>
    );
  }

  return (
    <div className="py-2">
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          level={0}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
}
