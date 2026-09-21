import type { FC } from '../../lib/teact/teact';
import { memo, useMemo } from '../../lib/teact/teact';

import type { ChatHubController } from '../../hooks/useChatHub';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';

import MainMenuDropdown from '../../components/common/MainMenuDropdown';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';

import '../../components/left/main/LeftMainHeader.scss';

type OwnProps = {
  hub: ChatHubController;
};

const IS_WITH_WINDOW_BUTTONS = IS_TAURI && IS_MAC_OS;

const ChatHubHeader = ({ hub }: OwnProps) => {
  const lang = useLang();
  const { isMobile } = useAppLayout();

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={buildClassName(isOpen && 'active')}
        onClick={onTrigger}
        ariaLabel={lang('AriaLabelOpenMenu')}
      >
        <div className="animated-menu-icon" />
      </Button>
    );
  }, [isMobile, lang]);

  return (
    <div className="LeftMainHeader">
      <div
        id="ChatHubMainHeader"
        className="left-header"
        data-tauri-drag-region={IS_WITH_WINDOW_BUTTONS ? true : undefined}
      >
        {lang.isRtl && <div className="DropdownMenuFiller" />}
        <MainMenuDropdown trigger={MainButton} />
        <SearchInput
          inputId="chathub-search-input"
          value={hub.searchQuery}
          placeholder={lang('Search')}
          autoComplete="off"
          canClose={Boolean(hub.searchQuery)}
          onChange={hub.setSearchQuery}
          onReset={() => hub.setSearchQuery('')}
        />
      </div>
    </div>
  );
};

export default memo(ChatHubHeader);
