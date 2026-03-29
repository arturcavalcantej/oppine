import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  threshold?: number; // milliseconds (default: 500ms)
  moveThreshold?: number; // pixels (default: 10px)
  onLongPress: () => void;
  onPress?: () => void; // Regular tap/click
}

interface TouchPosition {
  x: number;
  y: number;
}

export function useLongPress({
  threshold = 500,
  moveThreshold = 10,
  onLongPress,
  onPress,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<TouchPosition | null>(null);
  const isLongPressRef = useRef(false);
  const isCancelledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isCancelledRef.current = false;
      isLongPressRef.current = false;

      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };

      timerRef.current = setTimeout(() => {
        if (!isCancelledRef.current) {
          isLongPressRef.current = true;
          // Haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          onLongPress();
        }
      }, threshold);
    },
    [onLongPress, threshold]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current || isCancelledRef.current) return;

      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

      // Cancel if moved too far
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        isCancelledRef.current = true;
        clearTimer();
      }
    },
    [moveThreshold, clearTimer]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clearTimer();

      // If it wasn't a long press and wasn't cancelled, treat as regular tap
      if (!isLongPressRef.current && !isCancelledRef.current && onPress) {
        onPress();
      }

      // Prevent click event if long press was triggered
      if (isLongPressRef.current) {
        e.preventDefault();
      }

      startPosRef.current = null;
      isLongPressRef.current = false;
    },
    [clearTimer, onPress]
  );

  const onTouchCancel = useCallback(() => {
    isCancelledRef.current = true;
    clearTimer();
    startPosRef.current = null;
    isLongPressRef.current = false;
  }, [clearTimer]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  };
}
