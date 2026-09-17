import { memo, useEffect, useMemo, useState } from '../../../lib/teact/teact';

import type { AirTranslateClientSettings, AirTranslateProvider } from '../../../util/airTranslate';

import { SUPPORTED_TRANSLATION_LANGUAGES } from '../../../config';
import { AIR_TRANSLATE_PROVIDERS, airTranslateStore } from '../../../util/airTranslate';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useAirTranslateSettings from '../../../hooks/useAirTranslateSettings';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import Select from '../../ui/Select';

import styles from './AirTranslateSettingsModal.module.scss';

type LanguageOption = {
  code: string;
  name: string;
  originalName: string;
};

const POPULAR_LANGS = ['vi', 'en', 'zh', 'zh-CN', 'ja', 'ko', 'th', 'id', 'fr', 'de', 'es', 'ru', 'pt', 'it', 'ar'];

const PROVIDER_KEYS: Record<AirTranslateProvider, 'AirTranslateGoogle' | 'AirTranslateMyMemory'
  | 'AirTranslateLibre' | 'AirTranslateDeepL'> = {
  google: 'AirTranslateGoogle',
  mymemory: 'AirTranslateMyMemory',
  libretranslate: 'AirTranslateLibre',
  deepl: 'AirTranslateDeepL',
};

const AirTranslateSettingsModal = () => {
  const lang = useLang();
  const { isOpen, settings, enabledProviders } = useAirTranslateSettings();
  const [draft, setDraft] = useState<AirTranslateClientSettings>(settings);
  const [isTargetPickerOpen, openTargetPicker, closeTargetPicker] = useFlag();
  const [searchQuery, setSearchQuery] = useState('');
  const availableProviders = enabledProviders.length ? enabledProviders : AIR_TRANSLATE_PROVIDERS;

  useEffect(() => {
    if (!isOpen) {
      closeTargetPicker();
      setSearchQuery('');
      return;
    }

    const current = airTranslateStore.getSettings();
    const enabled = airTranslateStore.getEnabledProviders();
    const providers = enabled.length ? enabled : AIR_TRANSLATE_PROVIDERS;
    setDraft({
      sourceLang: 'auto',
      targetLang: current.targetLang,
      provider: providers.includes(current.provider) ? current.provider : providers[0],
    });
  }, [closeTargetPicker, enabledProviders, isOpen]);

  const languageOptions = useMemo(() => {
    const names = new Intl.DisplayNames([lang.code], { type: 'language' });
    const rest = SUPPORTED_TRANSLATION_LANGUAGES.filter((code) => !POPULAR_LANGS.includes(code));
    return [...POPULAR_LANGS, ...rest].map((code) => {
      const originalNames = new Intl.DisplayNames([code], { type: 'language' });
      return {
        code,
        name: names.of(code) || code,
        originalName: originalNames.of(code) || code,
      } satisfies LanguageOption;
    });
  }, [lang.code]);

  const filteredLanguages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return languageOptions;
    }

    return languageOptions.filter((item) => (
      item.name.toLowerCase().includes(query)
      || item.originalName.toLowerCase().includes(query)
      || item.code.toLowerCase().includes(query)
    ));
  }, [languageOptions, searchQuery]);

  const targetLabel = languageOptions.find((item) => item.code === draft.targetLang)?.name || draft.targetLang;

  const handleSearchChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.currentTarget.value);
  });

  const handleOpenTargetPicker = useLastCallback(() => {
    setSearchQuery('');
    openTargetPicker();
  });

  const handleClosePicker = useLastCallback(() => {
    closeTargetPicker();
    setSearchQuery('');
  });

  const handleSelectLanguage = useLastCallback((code: string) => {
    setDraft({
      sourceLang: 'auto',
      targetLang: code,
      provider: draft.provider,
    });
    handleClosePicker();
  });

  const handleProviderChange = useLastCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value;
    const provider: AirTranslateProvider = value === 'mymemory' || value === 'libretranslate' || value === 'deepl'
      ? value
      : 'google';
    setDraft({
      sourceLang: 'auto',
      targetLang: draft.targetLang,
      provider,
    });
  });

  const handleSave = useLastCallback(() => {
    airTranslateStore.setSettings({
      sourceLang: 'auto',
      targetLang: draft.targetLang,
      provider: draft.provider,
    });
    airTranslateStore.closeSettings();
  });

  const handleClose = useLastCallback(() => {
    if (isTargetPickerOpen) {
      handleClosePicker();
      return;
    }

    airTranslateStore.closeSettings();
  });

  return (
    <Modal
      className={buildClassName(styles.root, isTargetPickerOpen && styles.isPicker)}
      isSlim
      isOpen={isOpen}
      hasCloseButton
      isBackButton={isTargetPickerOpen}
      title={isTargetPickerOpen ? lang('AirTranslateTarget') : lang('MenuTranslate')}
      onClose={handleClose}
      onEnter={isTargetPickerOpen ? undefined : handleSave}
    >
      {isTargetPickerOpen ? (
        <>
          <InputText
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={lang('Search')}
            teactExperimentControlled
          />
          <div className={buildClassName(styles.languages, 'custom-scroll')}>
            {filteredLanguages.map((item) => (
              <ListItem
                key={item.code}
                className={buildClassName(styles.listItem, 'no-icon')}
                secondaryIcon={draft.targetLang === item.code ? 'check' : undefined}
                multiline
                narrow
                onClick={() => handleSelectLanguage(item.code)}
              >
                <span className="title">
                  {renderText(item.originalName === item.name ? item.name : item.originalName, ['highlight'], {
                    highlight: searchQuery,
                  })}
                </span>
                {item.originalName !== item.name && (
                  <span className="subtitle">
                    {renderText(item.name, ['highlight'], { highlight: searchQuery })}
                  </span>
                )}
              </ListItem>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="input-group touched with-label">
            <div id="air-translate-source" className={buildClassName('form-control', styles.autoField)}>
              {lang('AirTranslateAuto')}
            </div>
            <label htmlFor="air-translate-source">{lang('AirTranslateSource')}</label>
          </div>
          <div className="input-group touched with-label with-arrow">
            <button
              type="button"
              id="air-translate-target"
              className={buildClassName('form-control', styles.pickerButton)}
              onClick={handleOpenTargetPicker}
            >
              {targetLabel}
            </button>
            <label htmlFor="air-translate-target">{lang('AirTranslateTarget')}</label>
          </div>
          {availableProviders.length ? (
            <Select
              id="air-translate-provider"
              label={lang('AirTranslateProvider')}
              value={draft.provider}
              hasArrow
              onChange={handleProviderChange}
            >
              {availableProviders.map((provider) => (
                <option key={provider} value={provider}>{lang(PROVIDER_KEYS[provider])}</option>
              ))}
            </Select>
          ) : (
            <p className={styles.hint}>{lang('AirTranslateNoProvider')}</p>
          )}
          <div className={styles.actions}>
            <Button color="primary" size="smaller" onClick={handleSave}>
              {lang('AirTranslateSave')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default memo(AirTranslateSettingsModal);
