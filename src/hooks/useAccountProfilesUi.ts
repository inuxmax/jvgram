import { useEffect } from '../lib/teact/teact';

import {
  isAccountProfilesOpen,
  subscribeAccountProfilesUi,
} from '../util/accountProfilesUi';
import useForceUpdate from './useForceUpdate';

export default function useAccountProfilesUi() {
  const forceUpdate = useForceUpdate();

  useEffect(() => subscribeAccountProfilesUi(forceUpdate), [forceUpdate]);

  return {
    isOpen: isAccountProfilesOpen(),
  };
}
