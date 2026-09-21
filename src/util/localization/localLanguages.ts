import type { ApiLanguage, LangPack, LangPackStringValuePlural } from '../../api/types';

import readStrings from '../data/readStrings';

export const VIETNAMESE_LANGUAGE: ApiLanguage = {
  langCode: 'vi',
  name: 'Vietnamese',
  nativeName: 'Tiếng Việt',
  pluralCode: 'vi',
  stringsCount: 0,
  translatedCount: 0,
  translationsUrl: 'https://translations.telegram.org/vi/weba',
};

export const EXTRA_INTERFACE_LANGUAGES: ApiLanguage[] = [VIETNAMESE_LANGUAGE];

const LOCAL_OVERRIDE_LOADERS: Record<string, () => Promise<string>> = {
  vi: () => import('../../assets/localization/vi.strings?raw').then((mod) => mod.default),
};

export function getExtraInterfaceLanguage(langCode: string) {
  return EXTRA_INTERFACE_LANGUAGES.find((language) => language.langCode === langCode);
}

export function mergeInterfaceLanguages(languages: ApiLanguage[]) {
  const extra = EXTRA_INTERFACE_LANGUAGES.filter(
    (language) => !languages.some((item) => item.langCode === language.langCode),
  );
  return extra.length ? [...extra, ...languages] : languages;
}

export async function loadLocalLangOverrideRaw(langCode: string) {
  const load = LOCAL_OVERRIDE_LOADERS[langCode];
  if (!load) return {};
  return readStrings(await load());
}

export async function loadLocalLangOverrides(langCode: string): Promise<LangPack['strings']> {
  const load = LOCAL_OVERRIDE_LOADERS[langCode];
  if (!load) return {};
  return parseLangPackStrings(await load());
}

function parseLangPackStrings(fileData: string): LangPack['strings'] {
  const rawStrings = readStrings(fileData);
  const strings: LangPack['strings'] = {};

  Object.entries(rawStrings).forEach(([key, value]) => {
    const [clearKey, pluralSuffix] = key.split('_');

    if (!pluralSuffix) {
      strings[clearKey] = value;
      return;
    }

    const knownValue = (strings[clearKey] || {}) as LangPackStringValuePlural;
    knownValue[pluralSuffix as keyof LangPackStringValuePlural] = value;
    strings[clearKey] = knownValue;
  });

  return strings;
}
