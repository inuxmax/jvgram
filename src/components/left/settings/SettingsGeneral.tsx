import {
  memo, useCallback, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { SharedSettings } from '../../../global/types';
import type { ThemeKey, TimeFormat } from '../../../types';
import type { AppSkin, GoldWallpaperId } from '../../../util/priorityGold';
import type { IRadioOption } from '../../ui/RadioGroup';
import { SettingsScreens } from '../../../types';

import { selectSharedSettings } from '../../../global/selectors/sharedState';
import {
  IS_ANDROID, IS_IOS, IS_MAC_OS,
} from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { priorityGoldStore } from '../../../util/priorityGold';
import { getSystemTheme } from '../../../util/systemTheme';

import useAppLayout from '../../../hooks/useAppLayout';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePriorityGold from '../../../hooks/usePriorityGold';

import Island, { IslandTitle } from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import RangeSlider from '../../ui/RangeSlider';

import styles from './SettingsGeneral.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps =
  Pick<SharedSettings, (
    'messageTextSize' |
    'messageSendKeyCombo' |
    'shouldReplaceTextShortcuts' |
    'timeFormat' |
    'theme' |
    'shouldUseSystemTheme'
  )>;

const SettingsGeneral = ({
  isActive,
  messageTextSize,
  messageSendKeyCombo,
  shouldReplaceTextShortcuts,
  timeFormat,
  theme,
  shouldUseSystemTheme,
  onReset,
}: OwnProps & StateProps) => {
  const {
    setSharedSettingOption, openSettingsScreen, showNotification,
  } = getActions();

  const lang = useLang();
  const gold = usePriorityGold();
  const customFileRef = useRef<HTMLInputElement>();

  const { isMobile } = useAppLayout();
  const isMobileDevice = isMobile && (IS_IOS || IS_ANDROID);

  const timeFormatOptions: IRadioOption[] = [{
    label: lang('SettingsTimeFormat12'),
    value: '12h',
  }, {
    label: lang('SettingsTimeFormat24'),
    value: '24h',
  }];

  const appearanceThemeOptions: IRadioOption[] = [{
    label: lang('EmptyChatAppearanceLight'),
    value: 'light',
  }, {
    label: lang('EmptyChatAppearanceDark'),
    value: 'dark',
  }, {
    label: lang('EmptyChatAppearanceSystem'),
    value: 'auto',
  }];

  const skinOptions: IRadioOption[] = [{
    label: lang('AirGoldThemeDefault'),
    subLabel: lang('AirGoldThemeDefaultHint'),
    value: 'default',
  }, {
    label: lang('AirGoldThemeName'),
    subLabel: gold.flagEnabled ? lang('AirGoldThemeHint') : lang('AirGoldThemeOff'),
    value: 'priority-gold',
  }];

  const keyboardSendOptions = !isMobileDevice ? [
    { value: 'enter', label: lang('SettingsSendEnter'), subLabel: lang('SettingsSendEnterDescription') },
    {
      value: 'ctrl-enter',
      label: lang(IS_MAC_OS || IS_IOS ? 'SettingsSendCmdenter' : 'SettingsSendCtrlenter'),
      subLabel: lang('SettingsSendPlusEnterDescription'),
    },
  ] : undefined;

  const handleMessageTextSizeChange = useCallback((newSize: number) => {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(newSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height', `${Math.floor(newSize * 1.25)}px`);
    document.documentElement.style.setProperty('--message-text-size', `${newSize}px`);
    document.documentElement.setAttribute('data-message-text-size', newSize.toString());

    setSharedSettingOption({ messageTextSize: newSize });
  }, []);

  const handleAppearanceThemeChange = useCallback((value: string) => {
    const newTheme = value === 'auto' ? getSystemTheme() : value as ThemeKey;

    setSharedSettingOption({ theme: newTheme });
    setSharedSettingOption({ shouldUseSystemTheme: value === 'auto' });
  }, []);

  const handleSkinChange = useLastCallback((value: string) => {
    void priorityGoldStore.refreshFlag().then(() => {
      if (value === 'priority-gold' && !priorityGoldStore.isFlagEnabled()) {
        return;
      }
      priorityGoldStore.setSkin(value as AppSkin);
    });
  });

  const handleWallpaperChange = useLastCallback((wallpaper: GoldWallpaperId) => {
    if (wallpaper === 'custom') {
      customFileRef.current?.click();
      return;
    }
    priorityGoldStore.setWallpaper(wallpaper);
  });

  const handleCustomFile = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    void priorityGoldStore.applyFromFile(file).then((ok) => {
      if (!ok) {
        showNotification({ message: { key: 'AirGoldBgInvalid' } });
      }
    });
  });

  const handleTimeFormatChange = useCallback((newTimeFormat: string) => {
    setSharedSettingOption({ timeFormat: newTimeFormat as TimeFormat });
    setSharedSettingOption({ wasTimeFormatSetManually: true });
  }, []);

  const handleMessageSendComboChange = useCallback((newCombo: string) => {
    setSharedSettingOption({ messageSendKeyCombo: newCombo as SharedSettings['messageSendKeyCombo'] });
  }, []);

  const handleTextShortcutReplacementChange = useLastCallback((shouldReplace: boolean) => {
    setSharedSettingOption({ shouldReplaceTextShortcuts: shouldReplace });
  });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content custom-scroll">
      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('Settings')}</IslandTitle>
      <Island>
        <RangeSlider
          label={lang('TextSize')}
          min={12}
          max={20}
          value={messageTextSize}
          onChange={handleMessageTextSizeChange}
        />
        <ListItem
          icon="photo"
          narrow
          onClick={() => openSettingsScreen({ screen: SettingsScreens.GeneralChatBackground })}
        >
          {lang('ChatBackground')}
        </ListItem>
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('Theme')}</IslandTitle>
      <Island>
        <RadioGroup
          name="theme"
          options={appearanceThemeOptions}
          selected={shouldUseSystemTheme ? 'auto' : theme}
          onChange={handleAppearanceThemeChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AirGoldAppearance')}</IslandTitle>
      <Island>
        <RadioGroup
          name="air-gold-skin"
          options={skinOptions}
          selected={gold.activeSkin === 'priority-gold' ? 'priority-gold' : 'default'}
          onChange={handleSkinChange}
        />
        {!gold.flagEnabled && (
          <p className={styles.unavailable}>{lang('AirGoldThemeOff')}</p>
        )}
        {gold.activeSkin === 'priority-gold' && (
          <div className={styles.wallpaperGrid}>
            {([
              ['default', lang('AirGoldBgDefault'), styles.wallpaperPreviewDefault],
              ['dragon-gold', lang('AirGoldBgDragon'), styles.wallpaperPreviewDragon],
              ['minimal-gold', lang('AirGoldBgMinimal'), styles.wallpaperPreviewMinimal],
              ['dark-gold', lang('AirGoldBgDark'), styles.wallpaperPreviewDark],
              ['gold-wave', lang('AirGoldBgWave'), styles.wallpaperPreviewWave],
              ['gold-pattern', lang('AirGoldBgPattern'), styles.wallpaperPreviewPattern],
            ] as const).map(([id, label, previewClass]) => (
              <button
                type="button"
                key={id}
                className={buildClassName(
                  styles.wallpaperTile,
                  gold.wallpaper === id && styles.wallpaperTileActive,
                )}
                aria-pressed={gold.wallpaper === id}
                onClick={() => handleWallpaperChange(id)}
              >
                <div className={buildClassName(styles.wallpaperPreview, previewClass)} />
                <span className={styles.wallpaperLabel}>{label}</span>
              </button>
            ))}
            <button
              type="button"
              className={buildClassName(
                styles.wallpaperTile,
                gold.wallpaper === 'custom' && styles.wallpaperTileActive,
              )}
              aria-pressed={gold.wallpaper === 'custom'}
              onClick={() => handleWallpaperChange('custom')}
            >
              <div className={buildClassName(styles.wallpaperPreview, styles.wallpaperPreviewCustom)}>
                +
              </div>
              <span className={styles.wallpaperLabel}>{lang('AirGoldBgCustom')}</span>
            </button>
            <input
              ref={customFileRef}
              className={styles.fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={lang('AirGoldBgCustom')}
              onChange={handleCustomFile}
            />
          </div>
        )}
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('SettingsTimeFormat')}</IslandTitle>
      <Island>
        <RadioGroup
          name="timeformat"
          options={timeFormatOptions}
          selected={timeFormat}
          onChange={handleTimeFormatChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('SettingsKeyboard')}</IslandTitle>
      <Island>
        {keyboardSendOptions && (
          <RadioGroup
            name="keyboard-send-settings"
            options={keyboardSendOptions}
            onChange={handleMessageSendComboChange}
            selected={messageSendKeyCombo}
          />
        )}
        <Checkbox
          label={lang('SettingsAutomaticTextReplacements')}
          subLabel={lang('SettingsAutomaticTextReplacementsInfo')}
          checked={shouldReplaceTextShortcuts}
          onCheck={handleTextShortcutReplacementChange}
        />
      </Island>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      theme,
      shouldUseSystemTheme,
      messageSendKeyCombo,
      shouldReplaceTextShortcuts,
      messageTextSize,
      timeFormat,
    } = selectSharedSettings(global);

    return {
      messageSendKeyCombo,
      shouldReplaceTextShortcuts,
      messageTextSize,
      timeFormat,
      theme,
      shouldUseSystemTheme,
    };
  },
)(SettingsGeneral));
