import { memo, useEffect, useState } from '../../../lib/teact/teact';

import {
  airQuickReplyStore,
  MAX_AIR_QUICK_REPLY_CONTENT,
  normalizeQuickReplyShortcut,
} from '../../../util/airQuickReplies';

import useAirQuickReplies from '../../../hooks/useAirQuickReplies';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import TextArea from '../../ui/TextArea';

import styles from './AirQuickReplySettingsModal.module.scss';

const AirQuickReplySettingsModal = () => {
  const lang = useLang();
  const { replies, isSettingsOpen } = useAirQuickReplies();
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (isSettingsOpen) return;
    setShortcut('');
    setContent('');
    setEditingId(undefined);
    setError(undefined);
  }, [isSettingsOpen]);

  const handleClose = useLastCallback(() => {
    airQuickReplyStore.closeSettings();
  });

  const handleShortcutChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setShortcut(e.currentTarget.value);
    setError(undefined);
  });

  const handleContentChange = useLastCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.currentTarget.value);
    setError(undefined);
  });

  const handleEdit = useLastCallback((id: string) => {
    const reply = airQuickReplyStore.getReplies().find((item) => item.id === id);
    if (!reply) return;
    setEditingId(reply.id);
    setShortcut(reply.shortcut);
    setContent(reply.content);
    setError(undefined);
  });

  const handleDelete = useLastCallback((e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (editingId === id) {
      setEditingId(undefined);
      setShortcut('');
      setContent('');
    }
    airQuickReplyStore.removeReply(id);
  });

  const handleSave = useLastCallback(() => {
    const nextShortcut = normalizeQuickReplyShortcut(shortcut);
    const nextContent = content.trim();
    if (!nextShortcut || !nextContent) {
      setError(lang('AirQuickReplyInvalid'));
      return;
    }
    if (replies.some((item) => item.shortcut === nextShortcut && item.id !== editingId)) {
      setError(lang('AirQuickReplyExists'));
      return;
    }
    const isOk = editingId
      ? airQuickReplyStore.updateReply(editingId, { shortcut: nextShortcut, content: nextContent })
      : airQuickReplyStore.addReply({ shortcut: nextShortcut, content: nextContent });
    if (!isOk) {
      setError(lang('AirQuickReplyInvalid'));
      return;
    }
    setShortcut('');
    setContent('');
    setEditingId(undefined);
    setError(undefined);
  });

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={handleClose}
      title={lang('AirQuickReplySettings')}
      className={styles.root}
      hasCloseButton
    >
      <p className={styles.hint}>{lang('AirQuickReplyHint')}</p>
      {replies.length === 0 && (
        <p className={styles.empty}>{lang('AirQuickReplyEmpty')}</p>
      )}
      {replies.length > 0 && (
        <div className={styles.list}>
          {replies.map((reply) => (
            <ListItem
              key={reply.id}
              multiline
              narrow
              secondaryIcon="delete"
              className={styles.item}
              onClick={() => handleEdit(reply.id)}
              onSecondaryIconClick={(e) => handleDelete(e, reply.id)}
            >
              <span className="title">
                /
                {reply.shortcut}
              </span>
              <span className="subtitle">{reply.content}</span>
            </ListItem>
          ))}
        </div>
      )}
      <InputText
        label={lang('AirQuickReplyShortcut')}
        value={shortcut}
        error={error}
        placeholder="hello"
        autoComplete="off"
        onChange={handleShortcutChange}
      />
      <TextArea
        label={lang('AirQuickReplyContent')}
        value={content}
        placeholder={lang('AirQuickReplyContent')}
        maxLength={MAX_AIR_QUICK_REPLY_CONTENT}
        onChange={handleContentChange}
      />
      <div className={styles.actions}>
        <Button onClick={handleSave}>
          {lang(editingId ? 'AirQuickReplySave' : 'AirQuickReplyAdd')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(AirQuickReplySettingsModal);
