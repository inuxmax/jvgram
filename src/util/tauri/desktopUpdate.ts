import { useEffect, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { DesktopUpdateInfo } from '../../types/tauri';

import { IS_TAURI } from '../browser/globalEnvironment';

import useLastCallback from '../../hooks/useLastCallback';

export type { DesktopUpdateInfo };

const CHECK_INTERVAL = 30 * 60 * 1000;

let availableUpdate: DesktopUpdateInfo | undefined;
let isInstalling = false;
let hasStartedWatcher = false;
const listeners = new Set<NoneToVoidFunction>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getDesktopUpdate() {
  return availableUpdate;
}

export function isDesktopUpdateInstalling() {
  return isInstalling;
}

export function subscribeDesktopUpdate(listener: NoneToVoidFunction) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function checkDesktopUpdate() {
  const check = window.tauri?.checkGithubUpdate;
  if (!IS_TAURI || !check) return;

  try {
    const next = await check();
    availableUpdate = next ?? undefined;
    notify();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GitHub update check failed:', err);
  }
}

export async function installDesktopUpdate() {
  const install = window.tauri?.installGithubUpdate;
  if (!availableUpdate || !install || isInstalling) return;

  isInstalling = true;
  notify();

  try {
    await install(availableUpdate.downloadUrl);
  } catch (err) {
    isInstalling = false;
    notify();
    getActions().showNotification({
      message: { key: 'DesktopUpdateFailed' },
    });
    // eslint-disable-next-line no-console
    console.error('GitHub update install failed:', err);
  }
}

export function ensureDesktopUpdateWatcher() {
  if (!IS_TAURI || hasStartedWatcher) return;

  hasStartedWatcher = true;
  void checkDesktopUpdate();
  window.setInterval(() => {
    void checkDesktopUpdate();
  }, CHECK_INTERVAL);
}

export function useDesktopUpdate() {
  const [update, setUpdate] = useState(getDesktopUpdate);
  const [isBusy, setIsBusy] = useState(isDesktopUpdateInstalling);

  useEffect(() => {
    ensureDesktopUpdateWatcher();
    return subscribeDesktopUpdate(() => {
      setUpdate(getDesktopUpdate());
      setIsBusy(isDesktopUpdateInstalling());
    });
  }, []);

  const install = useLastCallback(() => {
    void installDesktopUpdate();
  });

  return { update, isInstalling: isBusy, install };
}
