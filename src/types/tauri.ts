import type { Window as TauriWindow } from '@tauri-apps/api/window';
import type { Update } from '@tauri-apps/plugin-updater';

export type TauriNotificationClickPayload = {
  chatId?: string;
  messageId?: number;
  isCall?: boolean;
};

export type DesktopUpdateInfo = {
  version: string;
  notes?: string;
  downloadUrl: string;
};

type TauriApi = {
  version: string;
  markTitleBarOverlay: (isOverlay: boolean, isMobile?: boolean) => Promise<void>;
  setNotificationsCount: (amount: number, isMuted?: boolean) => Promise<void>;
  openNewWindow: (url: string) => Promise<boolean>;
  relaunch: () => Promise<void>;
  checkUpdate: () => Promise<Update | null>;
  checkGithubUpdate: () => Promise<DesktopUpdateInfo | null>;
  installGithubUpdate: (downloadUrl: string) => Promise<void>;
  getCurrentWindow: () => Promise<TauriWindow>;
  setWindowTitle: (title: string) => Promise<void>;
  showDesktopNotification: (options: {
    title: string;
    body: string;
    chatId?: string;
    messageId?: number;
    isCall?: boolean;
    theme?: 'light' | 'dark';
    avatarDataUrl?: string;
  }) => Promise<void>;
  isAppWindowActive: () => Promise<boolean>;
};

declare global {
  interface Window {
    tauri: TauriApi;
  }
}

export {};
