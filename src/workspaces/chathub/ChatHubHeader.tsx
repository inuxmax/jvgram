import { memo } from '../../lib/teact/teact';

import type { ChatHubController } from '../../hooks/useChatHub';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Icon from '../../components/common/icons/Icon';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import WorkspaceSwitcher from '../WorkspaceSwitcher';

import styles from './ChatHub.module.scss';

type OwnProps = {
  hub: ChatHubController;
};

const ChatHubHeader = ({ hub }: OwnProps) => {
  const lang = useLang();

  return (
    <div className={buildClassName(styles.header, IS_TAURI && IS_MAC_OS && styles.tauriHeader)}>
      <Button
        round
        size="smaller"
        color="translucent"
        className={styles.backButton}
        ariaLabel={lang('ChatHubBackToTelegram')}
        onClick={hub.openTelegram}
      >
        <Icon name="arrow-left" />
      </Button>
      <WorkspaceSwitcher workspace={hub.workspace} />
      <SearchInput
        className={styles.search}
        value={hub.searchQuery}
        placeholder={lang('ChatHubSearchPlaceholder')}
        onChange={hub.setSearchQuery}
        onReset={() => hub.setSearchQuery('')}
        canClose={Boolean(hub.searchQuery)}
      />
      <Button
        round
        size="smaller"
        color="translucent"
        className={styles.settingsButton}
        ariaLabel={lang('ChatHubSettings')}
        onClick={hub.openSettings}
      >
        <Icon name="settings" />
      </Button>
    </div>
  );
};

export default memo(ChatHubHeader);
