export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin';
};

export type UsernameRecord = {
  id: string;
  username: string;
  owner: string;
  status: 'active' | 'reserved' | 'premium';
  note: string;
  telegramId?: string;
  source: 'telegram' | 'manual';
  createdAt: string;
};

export type UpgradeRecord = {
  id: string;
  title: string;
  price: string;
  description: string;
  isActive: boolean;
  createdAt: string;
};

export type AiSettings = {
  providerUrl: string;
  model: string;
  systemPrompt: string;
};

export type TranslateProvider = 'mymemory' | 'google' | 'libretranslate' | 'deepl';

export const TRANSLATE_PROVIDERS: TranslateProvider[] = ['google', 'mymemory', 'libretranslate', 'deepl'];

export type TranslateEnabledMap = Record<TranslateProvider, boolean>;

export type TranslateSettings = {
  provider: TranslateProvider;
  enabled: TranslateEnabledMap;
  myMemoryEmail: string;
  deeplApiKey: string;
  libreApiKey: string;
  sourceLang: string;
  targetLang: string;
  libreUrl: string;
};

export type QuickReplyRecord = {
  id: string;
  userId: string;
  shortcut: string;
  content: string;
  attachments: string[];
  createdAt: string;
};
