import { useRef } from 'react';
import type { MouseEvent, TouchEvent } from 'react';

type UseHorizontalSwipeOptions = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
  preventClickDelta?: number;
};

export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  preventClickDelta = 6,
}: UseHorizontalSwipeOptions) {
  const touchStartXRef = useRef<number | null>(null);
  const mouseStartXRef = useRef<number | null>(null);
  const mouseCurrentXRef = useRef<number | null>(null);
  const mouseDraggingRef = useRef(false);
  const preventClickRef = useRef(false);

  return {
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (!preventClickRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      preventClickRef.current = false;
    },
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
    },
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      const startX = touchStartXRef.current;
      const endX = event.changedTouches[0]?.clientX;
      touchStartXRef.current = null;
      if (startX == null || endX == null) return;
      const deltaX = endX - startX;
      if (deltaX <= -threshold) onSwipeLeft();
      if (deltaX >= threshold) onSwipeRight();
    },
    onMouseDown: (event: MouseEvent<HTMLElement>) => {
      mouseDraggingRef.current = true;
      mouseStartXRef.current = event.clientX;
      mouseCurrentXRef.current = event.clientX;
      preventClickRef.current = false;
    },
    onMouseMove: (event: MouseEvent<HTMLElement>) => {
      if (!mouseDraggingRef.current) return;
      mouseCurrentXRef.current = event.clientX;
      if (mouseStartXRef.current != null && Math.abs(event.clientX - mouseStartXRef.current) > preventClickDelta) {
        preventClickRef.current = true;
      }
    },
    onMouseUp: () => {
      if (!mouseDraggingRef.current) return;
      const startX = mouseStartXRef.current;
      const endX = mouseCurrentXRef.current;
      mouseDraggingRef.current = false;
      mouseStartXRef.current = null;
      mouseCurrentXRef.current = null;
      if (startX == null || endX == null) return;
      const deltaX = endX - startX;
      if (deltaX <= -threshold) onSwipeLeft();
      if (deltaX >= threshold) onSwipeRight();
    },
    onMouseLeave: () => {
      mouseDraggingRef.current = false;
      mouseStartXRef.current = null;
      mouseCurrentXRef.current = null;
    },
  };
}
