import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { AIR_TRANSLATE_TOAST, airTranslateStore } from '../../../util/airTranslate';
import buildClassName from '../../../util/buildClassName';

import useAirTranslation from '../../../hooks/useAirTranslation';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Spinner from '../../ui/Spinner';

import styles from './AirMessageTranslation.module.scss';

type OwnProps = {
  chatId: string;
  messageId: number;
  text?: string;
};

const AirMessageTranslation = ({ chatId, messageId, text }: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const { translated, isPending, isShown } = useAirTranslation(chatId, messageId, text);

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!text || isPending) {
      return;
    }

    void airTranslateStore.translateOne(chatId, messageId, text).catch(() => {
      showNotification({
        message: { key: 'AirTranslateError' },
        containerSelector: AIR_TRANSLATE_TOAST.containerSelector,
      });
    });
  });

  if (!text?.trim()) {
    return undefined;
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={buildClassName(styles.chip, isPending && styles.chipBusy)}
        aria-label={lang('AirTranslateMessage')}
        onClick={handleClick}
      >
        {isPending ? (
          <Spinner color="blue" className={styles.chipSpinner} />
        ) : (
          <Icon name="language" className={styles.chipIcon} />
        )}
        <span className={styles.chipLabel}>
          {isPending ? lang('AirTranslatePending') : lang('AirTranslateMessage')}
        </span>
      </button>
      {isShown && translated && (
        <span className={styles.result} dir="auto">{translated}</span>
      )}
    </div>
  );
};

export default memo(AirMessageTranslation);
