/**
 * メッセージ読み込み中のスケルトンコンポーネント
 * セッション切り替え時のローディング状態を表示
 */

import React from 'react';
import { LoadingIndicator } from './ui/LoadingIndicator';

export const MessageSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse space-y-6 p-4">
      {/* ユーザーメッセージ風のスケルトン */}
      <div className="flex justify-end">
        <div className="bg-gray-200 rounded-2xl rounded-tr-md h-16 w-80 max-w-[70%]"></div>
      </div>

      {/* アシスタントメッセージ風のスケルトン */}
      <div className="flex justify-start">
        <div className="bg-gray-100 rounded-2xl rounded-tl-md p-4 w-96 max-w-[80%] space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>

      {/* 2番目のユーザーメッセージ風のスケルトン */}
      <div className="flex justify-end">
        <div className="bg-gray-200 rounded-2xl rounded-tr-md h-12 w-64 max-w-[60%]"></div>
      </div>

      {/* 2番目のアシスタントメッセージ風のスケルトン */}
      <div className="flex justify-start">
        <div className="bg-gray-100 rounded-2xl rounded-tl-md p-4 w-80 max-w-[75%] space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>

      {/* ローディングテキスト */}
      <LoadingIndicator message="会話履歴を読み込み中..." />
    </div>
  );
};
