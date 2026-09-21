import { memo, useEffect } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { LeftColumnContent } from '../../types';

import { selectIsForumPanelOpen } from '../../global/selectors';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import useSelector from '../../hooks/data/useSelector';
import useChatHub from '../../hooks/useChatHub';
import useForumPanelRender from '../../hooks/useForumPanelRender';
import useLastCallback from '../../hooks/useLastCallback';

import ForumPanel from '../../components/left/main/forum/ForumPanel';
import NewChatButton from '../../components/left/NewChatButton';
import ChatHubHeader from './ChatHubHeader';
import ChatHubSettingsModal from './ChatHubSettingsModal';
import UnifiedChatList from './UnifiedChatList';

import styles from './ChatHub.module.scss';

const ChatHub = () => {
  const { openLeftColumnContent, closeForumPanel } = getActions();
  const hub = useChatHub();
  const isForumPanelOpen = useSelector(selectIsForumPanelOpen);
  const {
    shouldRenderForumPanel,
    handleForumPanelAnimationEnd,
    handleForumPanelAnimationStart,
  } = useForumPanelRender(isForumPanelOpen);

  const handleEsc = useLastCallback(() => {
    if (isForumPanelOpen) {
      closeForumPanel();
      return;
    }
    hub.openTelegram();
  });

  useEffect(() => captureEscKeyListener(handleEsc), [handleEsc]);

  const handleSelectContacts = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Contacts });
  });

  const handleSelectNewChannel = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.NewChannelStep1 });
  });

  const handleSelectNewGroup = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.NewGroupStep1 });
  });

  return (
    <div id="ChatHub" className={styles.root}>
      <ChatHubHeader hub={hub} />
      <UnifiedChatList hub={hub} />
      {shouldRenderForumPanel && (
        <ForumPanel
          isOpen={isForumPanelOpen}
          onOpenAnimationStart={handleForumPanelAnimationStart}
          onCloseAnimationEnd={handleForumPanelAnimationEnd}
        />
      )}
      <NewChatButton
        isShown={!isForumPanelOpen}
        onNewPrivateChat={handleSelectContacts}
        onNewChannel={handleSelectNewChannel}
        onNewGroup={handleSelectNewGroup}
      />
      <ChatHubSettingsModal hub={hub} />
    </div>
  );
};

export default memo(ChatHub);
