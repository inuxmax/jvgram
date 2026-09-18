import { useEffect } from '../lib/teact/teact';

import { priorityGoldStore } from '../util/priorityGold';
import useForceUpdate from './useForceUpdate';

export default function usePriorityGold() {
  const forceUpdate = useForceUpdate();

  useEffect(() => priorityGoldStore.subscribe(forceUpdate), [forceUpdate]);

  const state = priorityGoldStore.getState();

  return {
    skin: state.skin,
    wallpaper: state.wallpaper,
    flagEnabled: state.flagEnabled,
    activeSkin: priorityGoldStore.getActiveSkin(),
    hasCustomWallpaper: Boolean(state.customWallpaper),
  };
}
