import { useEffect } from '../lib/teact/teact';

import { airTranslateStore } from '../util/airTranslate';
import useForceUpdate from './useForceUpdate';

export default function useAirTranslation(chatId: string, messageId: number, text?: string) {
  const forceUpdate = useForceUpdate();

  useEffect(() => airTranslateStore.subscribe(forceUpdate), [forceUpdate]);

  const isChatEnabled = airTranslateStore.isChatEnabled(chatId);
  const isShown = airTranslateStore.isShown(chatId, messageId);
  const settings = airTranslateStore.getSettings();

  useEffect(() => {
    if (!text || !isChatEnabled) {
      return;
    }

    void airTranslateStore.ensureMessage(chatId, messageId, text);
  }, [chatId, messageId, text, isChatEnabled, settings]);

  return {
    translated: airTranslateStore.get(chatId, messageId),
    isPending: airTranslateStore.isPending(chatId, messageId),
    isShown,
  };
}
