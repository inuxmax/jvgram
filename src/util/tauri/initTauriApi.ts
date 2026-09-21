import type { DesktopUpdateInfo } from '../../types/tauri';

import { IS_MAC_OS } from '../browser/windowEnvironment';

export default function initTauriApi() {
  const corePromise = import('@tauri-apps/api/core');
  async function markTitleBarOverlay(isOverlay: boolean, isMobile?: boolean) {
    if (!IS_MAC_OS) return;
    const core = await corePromise;
    return core.invoke<void>('mark_title_bar_overlay', { isOverlay, isMobile });
  }

  async function setNotificationsCount(amount: number, isMuted = false) {
    const core = await corePromise;
    return core.invoke<void>('set_notifications_count', { amount, isMuted });
  }

  async function openNewWindow(url: string) {
    const core = await corePromise;
    return core.invoke<boolean>('open_new_window_cmd', { url });
  }

  async function setWindowTitle(title: string) {
    const core = await corePromise;
    return core.invoke<void>('set_window_title', { title });
  }

  async function showDesktopNotification(options: {
    title: string;
    body: string;
    chatId?: string;
    messageId?: number;
    isCall?: boolean;
    theme?: 'light' | 'dark';
    avatarDataUrl?: string;
  }) {
    const core = await corePromise;
    return core.invoke<void>('show_desktop_notification', options);
  }

  async function isAppWindowActive() {
    const core = await corePromise;
    return core.invoke<boolean>('is_app_window_active');
  }

  // @ts-expect-error
  window.tauri ??= {};
  Object.assign(window.tauri, {
    markTitleBarOverlay,
    setNotificationsCount,
    openNewWindow,
    relaunch: () => import('@tauri-apps/plugin-process').then(({ relaunch }) => relaunch()),
    checkUpdate: () => import('@tauri-apps/plugin-updater').then(({ check }) => check()),
    checkGithubUpdate: () => corePromise.then((core) => (
      core.invoke<DesktopUpdateInfo | null>('check_github_update')
    )),
    installGithubUpdate: (downloadUrl: string) => corePromise.then((core) => (
      core.invoke<void>('install_github_update', { downloadUrl })
    )),
    getCurrentWindow: () => import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow()),
    setWindowTitle,
    showDesktopNotification,
    isAppWindowActive,
  });
}
