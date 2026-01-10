/**
 * スワイプジェスチャーを検知するカスタムフック
 * モバイルでのサイドバー開閉などに使用
 */

import { useEffect, useCallback, useRef } from 'react';

interface SwipeGestureOptions {
  /**
   * 右方向へのスワイプ時のコールバック
   */
  onSwipeRight?: () => void;

  /**
   * 左方向へのスワイプ時のコールバック
   */
  onSwipeLeft?: () => void;

  /**
   * スワイプと判定する最小距離（px）
   * @default 50
   */
  threshold?: number;

  /**
   * 画面端からの有効範囲（px）
   * 画面左端からこの範囲内でタッチ開始した場合のみ右スワイプを検知
   * @default 30
   */
  edgeThreshold?: number;

  /**
   * 速度判定の閾値（px/ms）
   * この速度以上の場合はフリックとして扱う
   * @default 0.3
   */
  velocityThreshold?: number;

  /**
   * ジェスチャーの有効/無効
   * @default true
   */
  enabled?: boolean;

  /**
   * 画面端からのスワイプのみを有効にするか
   * @default true
   */
  requireEdgeStart?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  isTracking: boolean;
  direction: 'horizontal' | 'vertical' | null;
}

export function useSwipeGesture(options: SwipeGestureOptions) {
  const {
    onSwipeRight,
    onSwipeLeft,
    threshold = 50,
    edgeThreshold = 30,
    velocityThreshold = 0.3,
    enabled = true,
    requireEdgeStart = true,
  } = options;

  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    isTracking: false,
    direction: null,
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      const startX = touch.clientX;
      const startY = touch.clientY;

      // 画面端からのスワイプを要求する場合、左端チェック
      if (requireEdgeStart && onSwipeRight && startX > edgeThreshold) {
        return;
      }

      touchState.current = {
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        startTime: Date.now(),
        isTracking: true,
        direction: null,
      };
    },
    [enabled, edgeThreshold, onSwipeRight, requireEdgeStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchState.current.isTracking) return;

      const touch = e.touches[0];
      if (!touch) return;

      const currentX = touch.clientX;
      const currentY = touch.clientY;

      touchState.current.currentX = currentX;
      touchState.current.currentY = currentY;

      // 方向をまだ判定していない場合
      if (!touchState.current.direction) {
        const deltaX = Math.abs(currentX - touchState.current.startX);
        const deltaY = Math.abs(currentY - touchState.current.startY);

        // 最初の移動で方向を判定（5px以上移動したら判定）
        if (deltaX > 5 || deltaY > 5) {
          if (deltaX > deltaY) {
            // 水平方向
            touchState.current.direction = 'horizontal';
          } else {
            // 垂直方向（スクロール）
            touchState.current.direction = 'vertical';
            touchState.current.isTracking = false;
            return;
          }
        }
      }

      // 水平スワイプの場合、デフォルトのスクロールを防ぐ
      if (touchState.current.direction === 'horizontal') {
        e.preventDefault();
      }
    },
    [enabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !touchState.current.isTracking) return;

    const { startX, startY, currentX, currentY, startTime, direction } = touchState.current;

    // 垂直方向の場合は何もしない
    if (direction !== 'horizontal') {
      touchState.current.isTracking = false;
      return;
    }

    const deltaX = currentX - startX;
    const deltaY = Math.abs(currentY - startY);
    const deltaTime = Date.now() - startTime;
    const velocity = Math.abs(deltaX) / deltaTime;

    // 垂直方向の移動が大きすぎる場合は無視
    if (deltaY > 50) {
      touchState.current.isTracking = false;
      return;
    }

    // 右スワイプ判定
    if (deltaX > threshold || (deltaX > 0 && velocity > velocityThreshold)) {
      onSwipeRight?.();
    }
    // 左スワイプ判定
    else if (deltaX < -threshold || (deltaX < 0 && velocity > velocityThreshold)) {
      onSwipeLeft?.();
    }

    touchState.current.isTracking = false;
  }, [enabled, threshold, velocityThreshold, onSwipeRight, onSwipeLeft]);

  useEffect(() => {
    if (!enabled) return;

    // passive: false を指定して preventDefault を有効にする
    const options: AddEventListenerOptions = { passive: false };

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
