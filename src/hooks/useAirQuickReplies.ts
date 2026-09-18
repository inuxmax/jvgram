import { useEffect } from '../lib/teact/teact';

import { airQuickReplyStore } from '../util/airQuickReplies';
import useForceUpdate from './useForceUpdate';

export default function useAirQuickReplies() {
  const forceUpdate = useForceUpdate();

  useEffect(() => airQuickReplyStore.subscribe(forceUpdate), [forceUpdate]);

  return {
    replies: airQuickReplyStore.getReplies(),
    isSettingsOpen: airQuickReplyStore.isSettingsOpen(),
  };
}
