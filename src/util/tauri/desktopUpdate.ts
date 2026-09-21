import { useEffect, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { DesktopUpdateInfo } from '../../types/tauri';

import { IS_TAURI } from '../browser/globalEnvironment';

import useLastCallback from '../../hooks/useLastCallback';

export type { DesktopUpdateInfo };

type GithubUpdateProgressPayload = {
  percent: number;
  downloaded: number;
  total?: number;
};

const CHECK_INTERVAL = 30 * 1000;

let availableUpdate: DesktopUpdateInfo | undefined;
let isInstalling = false;
let isChecking = false;
let downloadPercent = 0;
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

export function getDesktopUpdatePercent() {
  return downloadPercent;
}

export function subscribeDesktopUpdate(listener: NoneToVoidFunction) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function checkDesktopUpdate() {
  const check = window.tauri?.checkGithubUpdate;
  if (!IS_TAURI || !check || isInstalling || isChecking) return;

  isChecking = true;
  try {
    const next = await check();
    availableUpdate = next ?? undefined;
    notify();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GitHub update check failed:', err);
  } finally {
    isChecking = false;
  }
}

export async function installDesktopUpdate() {
  const install = window.tauri?.installGithubUpdate;
  if (!availableUpdate || !install || isInstalling) return;

  isInstalling = true;
  downloadPercent = 0;
  notify();

  try {
    await install(availableUpdate.downloadUrl);
  } catch (err) {
    isInstalling = false;
    downloadPercent = 0;
    notify();
    getActions().showNotification({
      message: { key: 'DesktopUpdateFailed' },
    });
    // eslint-disable-next-line no-console
    console.error('GitHub update install failed:', err);
  }
}

async function listenForInstallProgress() {
  if (!IS_TAURI) return;

  try {
    const { listen } = await import('@tauri-apps/api/event');
    await listen<GithubUpdateProgressPayload>('github-update-progress', (event) => {
      const nextPercent = Math.max(0, Math.min(100, Math.round(event.payload.percent)));
      downloadPercent = nextPercent;
      isInstalling = true;
      notify();
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GitHub update progress listener failed:', err);
  }
}

function shouldPollDesktopUpdate() {
  return !document.hidden && !availableUpdate && !isInstalling;
}

export function ensureDesktopUpdateWatcher() {
  if (!IS_TAURI || hasStartedWatcher) return;

  hasStartedWatcher = true;
  void listenForInstallProgress();
  void checkDesktopUpdate();
  window.setInterval(() => {
    if (!shouldPollDesktopUpdate()) return;
    void checkDesktopUpdate();
  }, CHECK_INTERVAL);
  document.addEventListener('visibilitychange', () => {
    if (!shouldPollDesktopUpdate()) return;
    void checkDesktopUpdate();
  });
}

export function useDesktopUpdate() {
  const [update, setUpdate] = useState(getDesktopUpdate);
  const [isBusy, setIsBusy] = useState(isDesktopUpdateInstalling);
  const [progressPercent, setProgressPercent] = useState(getDesktopUpdatePercent);

  useEffect(() => {
    ensureDesktopUpdateWatcher();
    return subscribeDesktopUpdate(() => {
      setUpdate(getDesktopUpdate());
      setIsBusy(isDesktopUpdateInstalling());
      setProgressPercent(getDesktopUpdatePercent());
    });
  }, []);

  const install = useLastCallback(() => {
    void installDesktopUpdate();
  });

  return { update, isInstalling: isBusy, progressPercent, install };
}
