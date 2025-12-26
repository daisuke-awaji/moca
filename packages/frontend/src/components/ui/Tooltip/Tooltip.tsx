/**
 * Tooltip Component
 * 汎用的なツールチップコンポーネント
 */

import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface TooltipProps {
  /** ツールチップを表示するトリガー要素 */
  children: ReactNode;
  /** ツールチップに表示するコンテンツ */
  content: ReactNode;
  /** ツールチップの表示位置 */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** 固定幅（設定するとこの幅で固定表示） */
  width?: string;
  /** 最大幅（デフォルト: 240px） */
  maxWidth?: string;
  /** ツールチップを無効化 */
  disabled?: boolean;
  /** 表示遅延時間（ミリ秒、デフォルト: 200） */
  delay?: number;
}

/**
 * ホバー時にツールチップを表示する汎用コンポーネント
 */
export function Tooltip({
  children,
  content,
  position = 'top',
  width,
  maxWidth = '240px',
  disabled = false,
  delay = 0,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // コンポーネントアンマウント時にタイマーをクリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // disabledの場合は子要素のみを返す
  if (disabled) {
    return <>{children}</>;
  }

  // マウスエンター時に遅延してツールチップを表示
  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  // マウスリーブ時にタイマーをクリアしてツールチップを非表示
  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  // 位置に応じたスタイルクラス
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // 矢印の位置に応じたスタイルクラス
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {/* ツールチップ本体 */}
      {isVisible && (
        <div
          className={`
            absolute z-50
            ${positionClasses[position]}
            pointer-events-none
            animate-in fade-in-0 zoom-in-95 duration-150
          `}
          style={{ width: width, maxWidth: maxWidth }}
        >
          {/* 吹き出し背景 */}
          <div
            className={`relative bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg ${
              width ? 'whitespace-normal break-words' : 'whitespace-nowrap'
            }`}
          >
            {content}

            {/* 矢印 */}
            <div
              className={`
                absolute w-0 h-0
                border-4 border-transparent
                ${arrowClasses[position]}
              `}
            />
          </div>
        </div>
      )}
    </div>
  );
}
