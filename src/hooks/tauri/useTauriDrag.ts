import { useCallback, useEffect } from '../../lib/teact/teact';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS, IS_WINDOWS } from '../../util/browser/windowEnvironment';

const NO_DRAG_ELEMENTS = 'input, a, button';
const CAN_DRAG_WINDOW = IS_TAURI && (IS_MAC_OS || IS_WINDOWS);

const useTauriDrag = () => {
  const handleMouseDown = useCallback(async (event: MouseEvent) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    if (event.target?.closest(NO_DRAG_ELEMENTS)) {
      return;
    }

    if (event.target?.closest('[data-tauri-drag-region]')) {
      const tauriWindow = await window.tauri?.getCurrentWindow();
      tauriWindow?.startDragging();
    }
  }, []);

  useEffect(() => {
    if (!CAN_DRAG_WINDOW) return undefined;

    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseDown]);
};

export default useTauriDrag;
