import { useEffect } from '../lib/teact/teact';

import { airTranslateStore } from '../util/airTranslate';
import useForceUpdate from './useForceUpdate';

export default function useAirTranslateSettings() {
  const forceUpdate = useForceUpdate();

  useEffect(() => airTranslateStore.subscribe(forceUpdate), [forceUpdate]);

  return {
    isOpen: airTranslateStore.isSettingsOpen(),
    settings: airTranslateStore.getSettings(),
    enabledProviders: airTranslateStore.getEnabledProviders(),
  };
}
