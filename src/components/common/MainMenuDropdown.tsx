import { type FC, memo } from '@teact';
import { APP_REVISION } from 'virtual:git-info';
import { getActions } from '../../global';

import { LeftColumnContent, SettingsScreens } from '../../types';

import {
  APP_NAME,
  DEBUG,
  IS_BETA,
} from '../../config';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLeftHeaderButtonRtlForumTransition from '../left/main/hooks/useLeftHeaderButtonRtlForumTransition';

import LeftSideMenuItems from '../left/main/LeftSideMenuItems';
import DropdownMenu from '../ui/DropdownMenu';

type OwnProps = {
  trigger?: FC<{ onTrigger: () => void; isOpen?: boolean }>;
  shouldHideSearch?: boolean;
  className?: string;
};

const LeftSideMenuDropdown = ({
  trigger,
  shouldHideSearch,
  className,
}: OwnProps) => {
  const {
    openLeftColumnContent, closeForumPanel, closeCommunityPanel, openSettingsScreen,
  } = getActions();
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();
  const lang = useLang();
  const versionFooter = buildAppVersionFooter();

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  const handleSelectSettings = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.Main });
  });

  const handleSelectContacts = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Contacts });
  });

  const handleSelectArchived = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Archived });
    closeForumPanel();
    closeCommunityPanel();
  });

  return (
    <DropdownMenu
      trigger={trigger}
      className={buildClassName(
        'main-menu',
        lang.isRtl && 'rtl',
        shouldHideSearch && lang.isRtl && 'right-aligned',
        shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
        className,
      )}
      forceOpen={isBotMenuOpen}
      positionX={shouldHideSearch && lang.isRtl ? 'right' : 'left'}
      transformOriginX={90}
      transformOriginY={100}
      withPortal
      onTransitionEnd={lang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
    >
      <LeftSideMenuItems
        onSelectArchived={handleSelectArchived}
        onSelectContacts={handleSelectContacts}
        onSelectSettings={handleSelectSettings}
        onBotMenuOpened={markBotMenuOpen}
        onBotMenuClosed={unmarkBotMenuOpen}
        footer={versionFooter}
      />
    </DropdownMenu>
  );
};

function buildAppVersionFooter() {
  const releaseVersion = (IS_TAURI && window.tauri?.version) || APP_VERSION;
  const labeledVersion = IS_BETA ? `${releaseVersion} Beta` : releaseVersion;

  if (DEBUG || IS_BETA) {
    return `${APP_NAME} ${labeledVersion} · ${APP_REVISION}`;
  }

  return `${APP_NAME} ${labeledVersion}`;
}

export default memo(LeftSideMenuDropdown);
