import type { ElementRef } from '../lib/teact/teact';
import { useEffect } from '../lib/teact/teact';

const DRAG_THRESHOLD_PX = 6;

const useHorizontalScroll = (
  containerRef: ElementRef<HTMLDivElement>,
  isDisabled?: boolean,
  shouldPreventDefault = false,
  shouldStopPropagation = false,
  shouldDragScroll = false,
) => {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    function handleScroll(e: WheelEvent) {
      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        container.scrollLeft += e.deltaY / 4;
        if (shouldPreventDefault) e.preventDefault();
        if (shouldStopPropagation && container.scrollWidth > container.clientWidth) e.stopPropagation();
      }
    }

    container.addEventListener('wheel', handleScroll, { passive: !shouldPreventDefault });

    if (!shouldDragScroll) {
      return () => {
        container.removeEventListener('wheel', handleScroll);
      };
    }

    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let pointerId: number | undefined;
    let shouldSuppressClick = false;

    function handlePointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (container.scrollWidth <= container.clientWidth) return;

      isPointerDown = true;
      isDragging = false;
      startX = e.clientX;
      startScrollLeft = container.scrollLeft;
      pointerId = e.pointerId;
    }

    function handlePointerMove(e: PointerEvent) {
      if (!isPointerDown || pointerId !== e.pointerId) return;

      const dx = e.clientX - startX;
      if (!isDragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        isDragging = true;
        shouldSuppressClick = true;
        container.setPointerCapture(e.pointerId);
      }

      container.scrollLeft = startScrollLeft - dx;
    }

    function handlePointerUp(e: PointerEvent) {
      if (pointerId !== e.pointerId) return;

      isPointerDown = false;
      isDragging = false;
      pointerId = undefined;
    }

    function handleClickCapture(e: MouseEvent) {
      if (!shouldSuppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      shouldSuppressClick = false;
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);
    container.addEventListener('click', handleClickCapture, true);

    return () => {
      container.removeEventListener('wheel', handleScroll);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
      container.removeEventListener('click', handleClickCapture, true);
    };
  }, [containerRef, isDisabled, shouldPreventDefault, shouldStopPropagation, shouldDragScroll]);
};

export default useHorizontalScroll;
