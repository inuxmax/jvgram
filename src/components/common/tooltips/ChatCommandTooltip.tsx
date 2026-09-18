import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type {
  ApiBotCommand, ApiMessage, ApiQuickReply, ApiUser,
} from '../../../api/types';
import type { AirQuickReply } from '../../../util/airQuickReplies';

import { airQuickReplyStore } from '../../../util/airQuickReplies';
import buildClassName from '../../../util/buildClassName';

import useFrozenProps from '../../../hooks/useFrozenProps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ChatCommand from '../../middle/composer/ChatCommand';
import Button from '../../ui/Button';
import RichEditorTooltipPanel from './RichEditorTooltipPanel';

import sharedStyles from './RichEditorTooltip.module.scss';

export type OwnProps = {
  isOpen: boolean;
  selectedIndex: number;
  botCommands?: ApiBotCommand[];
  airQuickReplies?: AirQuickReply[];
  quickReplies?: ApiQuickReply[];
  quickReplyMessages?: Record<number, ApiMessage>;
  self: ApiUser;
  onCommandSelect: (command: ApiBotCommand) => void;
  onAirQuickReplySelect: (quickReply: AirQuickReply) => void;
  onQuickReplySelect: (quickReply: ApiQuickReply) => void;
};

type QuickReplyWithDescription = {
  quickReply: ApiQuickReply;
  command: string;
  description: string;
};

const ChatCommandTooltip = ({ isOpen, ...props }: OwnProps) => {
  const {
    selectedIndex,
    botCommands,
    airQuickReplies,
    quickReplies,
    quickReplyMessages,
    self,
    onCommandSelect,
    onAirQuickReplySelect,
    onQuickReplySelect,
  } = useFrozenProps(props, !isOpen);

  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();

  const handleSendCommand = useLastCallback((command: ApiBotCommand) => onCommandSelect(command));
  const handleInsertAirQuickReply = useLastCallback((quickReply: AirQuickReply) => onAirQuickReplySelect(quickReply));
  const handleSendQuickReply = useLastCallback((quickReply: ApiQuickReply) => onQuickReplySelect(quickReply));
  const handleOpenSettings = useLastCallback(() => {
    airQuickReplyStore.openSettings();
  });

  const quickRepliesWithDescription = useMemo(() => {
    if (!quickReplies?.length || !quickReplyMessages) return undefined;
    return quickReplies.map((reply) => {
      const message = quickReplyMessages[reply.topMessageId];
      return {
        quickReply: reply,
        command: reply.shortcut,
        description: message?.content.text?.text || '',
      } satisfies QuickReplyWithDescription;
    });
  }, [quickReplies, quickReplyMessages]);

  const isEmpty = !botCommands?.length && !quickReplies?.length && !airQuickReplies?.length;

  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>('.focus')?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (isEmpty) {
    return undefined;
  }

  return (
    <RichEditorTooltipPanel isOpen={isOpen}>
      <div ref={containerRef} className={buildClassName(sharedStyles.root, 'composer-tooltip custom-scroll')}>
        <div className={sharedStyles.quickReplyHeader}>
          <span className={sharedStyles.quickReplyTitle}>{lang('AirQuickReplyTitle')}</span>
          <Button
            round
            size="tiny"
            color="translucent"
            className={sharedStyles.quickReplySettings}
            ariaLabel={lang('AirQuickReplySettings')}
            iconName="settings"
            shouldStopPropagation
            onClick={handleOpenSettings}
          />
        </div>
        {airQuickReplies?.map((reply, index) => (
          <ChatCommand
            key={`airQuickReply_${reply.id}`}
            command={reply.shortcut}
            description={reply.content}
            clickArg={reply}
            onClick={handleInsertAirQuickReply}
            focus={selectedIndex === index}
          />
        ))}
        {quickRepliesWithDescription?.map((reply, index) => (
          <ChatCommand
            key={`quickReply_${reply.quickReply.id}`}
            command={reply.command}
            description={reply.description}
            peer={self}
            withAvatar
            clickArg={reply.quickReply}
            onClick={handleSendQuickReply}
            focus={selectedIndex - (airQuickReplies?.length || 0) === index}
          />
        ))}
        {botCommands?.map((command, index) => (
          <ChatCommand
            key={`${command.botId}_${command.command}`}
            command={command.command}
            description={command.description}
            isEphemeral={command.isEphemeral}
            // No need for expensive global updates on users and chats, so we avoid them
            peer={getGlobal().users.byId[command.botId]}
            withAvatar
            clickArg={command}
            onClick={handleSendCommand}
            focus={
              selectedIndex - (airQuickReplies?.length || 0) - (quickRepliesWithDescription?.length || 0) === index
            }
          />
        ))}
      </div>
    </RichEditorTooltipPanel>
  );
};

export default memo(ChatCommandTooltip);
