import { memo, useEffect, useLayoutEffect, useState } from '../../lib/teact/teact';

import { PAGE_TITLE_TAURI } from '../../config';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_WINDOWS } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { useDesktopUpdate } from '../../util/tauri/desktopUpdate';

import { useChatHubWorkspace } from '../../hooks/useChatHub';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import { useFullscreenStatus } from '../../hooks/window/useFullscreen';

import Icon from '../common/icons/Icon';

import styles from './TauriCaptionBar.module.scss';

import telegramLogoPath from '../../assets/telegram-logo.svg';

type OwnProps = {
  withWorkspaceSwitcher?: boolean;
};

const IS_WINDOWS_TAURI = IS_TAURI && IS_WINDOWS;

const TauriCaptionBar = ({ withWorkspaceSwitcher }: OwnProps) => {
  const lang = useLang();
  const { workspace, openChatHub, openTelegram } = useChatHubWorkspace();
  const isFullscreen = useFullscreenStatus();
  const [isMaximized, setIsMaximized] = useState(false);
  const isChatHub = workspace === 'chathub';
  const { update, isInstalling, install } = useDesktopUpdate();

  useLayoutEffect(() => {
    document.body.classList.toggle('is-tauri-fullscreen', isFullscreen);
    return () => {
      document.body.classList.remove('is-tauri-fullscreen');
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!IS_WINDOWS_TAURI) return undefined;

    let remove: VoidFunction | undefined;
    let isCancelled = false;

    const setupWindow = async () => {
      const tauriWindow = await window.tauri.getCurrentWindow();
      if (isCancelled) return;

      setIsMaximized(await tauriWindow.isMaximized());
      remove = await tauriWindow.onResized(async () => {
        setIsMaximized(await tauriWindow.isMaximized());
      });
    };

    void setupWindow();

    return () => {
      isCancelled = true;
      remove?.();
    };
  }, []);

  const handleMinimize = useLastCallback(async () => {
    const tauriWindow = await window.tauri.getCurrentWindow();
    await tauriWindow.minimize();
  });

  const handleToggleMaximize = useLastCallback(async () => {
    const tauriWindow = await window.tauri.getCurrentWindow();
    await tauriWindow.toggleMaximize();
  });

  const handleClose = useLastCallback(async () => {
    const tauriWindow = await window.tauri.getCurrentWindow();
    await tauriWindow.close();
  });

  const handleCaptionDoubleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    void handleToggleMaximize();
  });

  if (!IS_WINDOWS_TAURI || isFullscreen) {
    return undefined;
  }

  return (
    <div
      className={styles.caption}
      data-tauri-drag-region={true}
      onDoubleClick={handleCaptionDoubleClick}
    >
      <img
        className={styles.logo}
        src={telegramLogoPath}
        alt=""
        draggable={false}
      />
      <span className={styles.title}>{PAGE_TITLE_TAURI}</span>
      {Boolean(withWorkspaceSwitcher) && (
        <div className={styles.switcher}>
          <button
            type="button"
            className={buildClassName(styles.switcherButton, !isChatHub && styles.switcherActive)}
            aria-pressed={!isChatHub}
            onClick={openTelegram}
          >
            <Icon name="chats-badge" className={styles.switcherIcon} />
            {lang('ChatHubWorkspaceTelegram')}
          </button>
          <button
            type="button"
            className={buildClassName(styles.switcherButton, isChatHub && styles.switcherActive)}
            aria-pressed={isChatHub}
            onClick={openChatHub}
          >
            <Icon name="forums" className={styles.switcherIcon} />
            {lang('ChatHubWorkspaceChatHub')}
          </button>
        </div>
      )}
      <div className={styles.dragSpacer} data-tauri-drag-region={true} />
      {update && (
        <button
          type="button"
          className={buildClassName(styles.update, isInstalling && styles.updateBusy)}
          aria-label={lang('AccDesktopUpdate', { version: update.version })}
          disabled={isInstalling}
          onClick={install}
        >
          <Icon name="download" className={styles.switcherIcon} />
          {lang(isInstalling ? 'DesktopUpdateBusy' : 'DesktopUpdate')}
        </button>
      )}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.control}
          aria-label={lang('AccWindowMinimize')}
          onClick={handleMinimize}
        >
          {renderMinimizeIcon()}
        </button>
        <button
          type="button"
          className={styles.control}
          aria-label={lang(isMaximized ? 'AccWindowRestore' : 'AccWindowMaximize')}
          onClick={handleToggleMaximize}
        >
          {isMaximized ? renderRestoreIcon() : renderMaximizeIcon()}
        </button>
        <button
          type="button"
          className={buildClassName(styles.control, styles.close)}
          aria-label={lang('Close')}
          onClick={handleClose}
        >
          {renderCloseIcon()}
        </button>
      </div>
    </div>
  );
};

function renderMinimizeIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1 5h8" />
    </svg>
  );
}

function renderMaximizeIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 10 10" aria-hidden="true">
      <rect x="1.5" y="1.5" width="7" height="7" />
    </svg>
  );
}

function renderRestoreIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M3 1.5h5.5V7" />
      <rect x="1.5" y="3" width="5.5" height="5.5" />
    </svg>
  );
}

function renderCloseIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 2l6 6M8 2l-6 6" />
    </svg>
  );
}

export default memo(TauriCaptionBar);
