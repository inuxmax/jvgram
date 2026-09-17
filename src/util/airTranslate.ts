const ADMIN_API_URL = import.meta.env.TG_ADMIN_API_URL;

export const AIR_CHAT_TRANSLATE_BATCH = 30;

export const AIR_TRANSLATE_TOAST = {
  containerSelector: '#middle-column-portals',
} as const;

export type AirTranslateProvider = 'google' | 'mymemory' | 'libretranslate' | 'deepl';

export const AIR_TRANSLATE_PROVIDERS: AirTranslateProvider[] = [
  'google', 'mymemory', 'libretranslate', 'deepl',
];

export type AirTranslateClientSettings = {
  sourceLang: string;
  targetLang: string;
  provider: AirTranslateProvider;
};

const MAX_TEXT_LENGTH = 4500;
const SETTINGS_STORAGE_KEY = 'taa.airTranslate.settings';
const DEFAULT_SETTINGS: AirTranslateClientSettings = {
  sourceLang: 'auto',
  targetLang: 'vi',
  provider: 'google',
};

type StoreListener = NoneToVoidFunction;

type MessageItem = {
  id: number;
  text: string;
};

function buildKey(chatId: string, messageId: number) {
  return `${chatId}:${messageId}`;
}

function isProvider(value: unknown): value is AirTranslateProvider {
  return value === 'google' || value === 'mymemory' || value === 'libretranslate' || value === 'deepl';
}

function loadSettings(): AirTranslateClientSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AirTranslateClientSettings>;
    return {
      sourceLang: DEFAULT_SETTINGS.sourceLang,
      targetLang: parsed.targetLang || DEFAULT_SETTINGS.targetLang,
      provider: isProvider(parsed.provider) ? parsed.provider : DEFAULT_SETTINGS.provider,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

class AirTranslateStore {
  private cache = new Map<string, string>();

  private pending = new Set<string>();

  private enabledChats = new Set<string>();

  private manualKeys = new Set<string>();

  private listeners = new Set<StoreListener>();

  private settings = loadSettings();

  private settingsOpen = false;

  private requestGeneration = 0;

  private enabledProviders: AirTranslateProvider[] = AIR_TRANSLATE_PROVIDERS;

  subscribe(listener: StoreListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSettings() {
    return this.settings;
  }

  setSettings(next: AirTranslateClientSettings) {
    this.settings = {
      sourceLang: DEFAULT_SETTINGS.sourceLang,
      targetLang: next.targetLang,
      provider: next.provider,
    };
    this.requestGeneration += 1;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    this.cache.clear();
    this.pending.clear();
    this.notify();
  }

  getEnabledProviders() {
    return this.enabledProviders;
  }

  isSettingsOpen() {
    return this.settingsOpen;
  }

  async loadEnabledProviders() {
    if (!ADMIN_API_URL) {
      return;
    }

    try {
      const response = await fetch(`${ADMIN_API_URL}/api/translate`);
      if (!response.ok) {
        return;
      }

      const data = await response.json() as { providers?: unknown };
      if (!Array.isArray(data.providers)) {
        return;
      }

      const next = data.providers.filter(isProvider);
      this.enabledProviders = next;

      if (this.enabledProviders.length && !this.enabledProviders.includes(this.settings.provider)) {
        this.settings = {
          sourceLang: DEFAULT_SETTINGS.sourceLang,
          targetLang: this.settings.targetLang,
          provider: this.enabledProviders[0],
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      }

      this.notify();
    } catch {
      // Keep the last known provider list
    }
  }

  openSettings() {
    this.settingsOpen = true;
    this.notify();
    void this.loadEnabledProviders();
  }

  closeSettings() {
    this.settingsOpen = false;
    this.notify();
  }

  isChatEnabled(chatId: string) {
    return this.enabledChats.has(chatId);
  }

  enableChat(chatId: string) {
    this.enabledChats.add(chatId);
    this.notify();
  }

  disableChat(chatId: string) {
    this.enabledChats.delete(chatId);
    this.notify();
  }

  isShown(chatId: string, messageId: number) {
    return this.isChatEnabled(chatId) || this.manualKeys.has(buildKey(chatId, messageId));
  }

  get(chatId: string, messageId: number) {
    return this.cache.get(buildKey(chatId, messageId));
  }

  isPending(chatId: string, messageId: number) {
    return this.pending.has(buildKey(chatId, messageId));
  }

  async translateOne(chatId: string, messageId: number, text: string) {
    this.manualKeys.add(buildKey(chatId, messageId));
    this.notify();
    await this.ensureMessage(chatId, messageId, text);
  }

  async ensureMessage(chatId: string, messageId: number, text: string) {
    const key = buildKey(chatId, messageId);
    const normalized = normalizeText(text);
    if (!normalized || this.cache.has(key) || this.pending.has(key)) {
      return;
    }

    const generation = this.requestGeneration;
    this.pending.add(key);
    this.notify();

    try {
      const [translated] = await requestTranslate([normalized]);
      if (generation !== this.requestGeneration) {
        return;
      }
      this.cache.set(key, translated);
    } finally {
      if (generation === this.requestGeneration) {
        this.pending.delete(key);
      }
      this.notify();
    }
  }

  async translateMany(chatId: string, items: MessageItem[]) {
    for (const item of items) {
      try {
        await this.ensureMessage(chatId, item.id, item.text);
      } catch {
        // Keep translating remaining visible messages
      }
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const airTranslateStore = new AirTranslateStore();

export async function translatePlainText(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '';
  }

  const [translated] = await requestTranslate([normalized]);
  return translated;
}

function normalizeText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) : trimmed;
}

async function requestTranslate(texts: string[]) {
  if (!ADMIN_API_URL) {
    throw new Error('admin_offline');
  }

  const settings = airTranslateStore.getSettings();
  const response = await fetch(`${ADMIN_API_URL}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts,
      provider: settings.provider,
      sourceLang: DEFAULT_SETTINGS.sourceLang,
      targetLang: settings.targetLang,
    }),
  });

  if (!response.ok) {
    throw new Error('translate_failed');
  }

  const data = await response.json() as { translations?: string[] };
  if (!data.translations || data.translations.length !== texts.length) {
    throw new Error('translate_empty');
  }

  return data.translations;
}
