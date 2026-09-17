import type { TranslateProvider, TranslateSettings } from './types';
import { listEnabledTranslateProviders } from './data';

const DEFAULT_TARGET = 'vi';

export async function translateTexts(texts: string[], settings: TranslateSettings): Promise<string[]> {
  const targetLang = (settings.targetLang || DEFAULT_TARGET).trim() || DEFAULT_TARGET;
  const results: string[] = [];

  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed) {
      results.push(text);
      continue;
    }

    results.push(await translateWithFallback(trimmed, targetLang, settings));
  }

  return results;
}

async function translateWithFallback(text: string, targetLang: string, settings: TranslateSettings) {
  const enabled = listEnabledTranslateProviders(settings);
  const providers: TranslateProvider[] = [
    ...(enabled.includes(settings.provider) ? [settings.provider] : []),
    ...enabled.filter((provider) => provider !== settings.provider),
  ];

  if (!providers.length) {
    throw new Error('no_provider');
  }

  let lastError: Error | undefined;
  for (const provider of providers) {
    try {
      return await translateOne(text, targetLang, { ...settings, provider });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('translate_failed');
    }
  }

  throw lastError || new Error('translate_failed');
}

async function translateOne(text: string, targetLang: string, settings: TranslateSettings) {
  const sourceLang = (settings.sourceLang || 'auto').trim() || 'auto';

  switch (settings.provider) {
    case 'google':
      return translateGoogle(text, targetLang, sourceLang);
    case 'libretranslate':
      return translateLibre(text, targetLang, sourceLang, settings);
    case 'deepl':
      return translateDeepL(text, targetLang, sourceLang, settings.deeplApiKey);
    default:
      return translateMyMemory(text, targetLang, sourceLang, settings.myMemoryEmail);
  }
}

async function translateMyMemory(text: string, targetLang: string, sourceLang: string, email: string) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${sourceLang === 'auto' ? 'autodetect' : sourceLang}|${targetLang}`);
  if (email) {
    url.searchParams.set('de', email);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('mymemory_failed');
  }

  const data = await response.json() as { responseData?: { translatedText?: string }; responseStatus?: number };
  const translated = data.responseData?.translatedText;
  if (!translated || data.responseStatus !== 200) {
    throw new Error('mymemory_empty');
  }

  if (translated.startsWith('MYMEMORY WARNING')) {
    throw new Error('mymemory_quota');
  }

  return translated;
}

async function translateGoogle(text: string, targetLang: string, sourceLang: string) {
  const url = new URL('https://clients5.google.com/translate_a/t');
  url.searchParams.set('client', 'dict-chrome-ex');
  url.searchParams.set('sl', sourceLang === 'auto' ? 'auto' : sourceLang);
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('q', text);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) {
    throw new Error('google_failed');
  }

  const data = await response.json() as unknown;
  const translated = parseGoogleTranslation(data);
  if (!translated) {
    throw new Error('google_empty');
  }

  return translated;
}

function parseGoogleTranslation(data: unknown) {
  if (!Array.isArray(data) || data.length === 0) {
    return undefined;
  }

  const first = data[0];
  if (typeof first === 'string') {
    return first;
  }

  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }

  if (Array.isArray(first) && Array.isArray(first[0]) && typeof first[0][0] === 'string') {
    return first.map((part) => (Array.isArray(part) ? String(part[0] || '') : '')).join('');
  }

  return undefined;
}

async function translateLibre(text: string, targetLang: string, sourceLang: string, settings: TranslateSettings) {
  const endpoint = settings.libreUrl.trim() || 'https://libretranslate.com/translate';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: sourceLang === 'auto' ? 'auto' : sourceLang,
      target: targetLang,
      format: 'text',
      api_key: settings.libreApiKey || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error('libre_failed');
  }

  const data = await response.json() as { translatedText?: string };
  if (!data.translatedText) {
    throw new Error('libre_empty');
  }

  return data.translatedText;
}

async function translateDeepL(text: string, targetLang: string, sourceLang: string, apiKey: string) {
  if (!apiKey) {
    throw new Error('deepl_key_required');
  }

  const endpoint = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const payload: { text: string[]; target_lang: string; source_lang?: string } = {
    text: [text],
    target_lang: targetLang.toUpperCase(),
  };
  if (sourceLang !== 'auto') {
    payload.source_lang = sourceLang.toUpperCase();
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('deepl_failed');
  }

  const data = await response.json() as { translations?: Array<{ text?: string }> };
  const translated = data.translations?.[0]?.text;
  if (!translated) {
    throw new Error('deepl_empty');
  }

  return translated;
}
