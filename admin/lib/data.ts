import bcrypt from 'bcryptjs';
import { ObjectId, type WithId, type Document } from 'mongodb';

import { getDb } from './mongodb';
import type {
  AdminUser,
  AiSettings,
  QuickReplyRecord,
  TranslateEnabledMap,
  TranslateProvider,
  TranslateSettings,
  UpgradeRecord,
  UsernameRecord,
} from './types';
import { TRANSLATE_PROVIDERS } from './types';

const SALT_ROUNDS = 12;

function asId(value: ObjectId) {
  return value.toHexString();
}

export async function countAdmins() {
  const db = await getDb();
  return db.collection('users').countDocuments({ role: 'admin' });
}

export async function createFirstAdmin(input: { name: string; email: string; password: string }) {
  const existing = await countAdmins();
  if (existing > 0) {
    throw new Error('Admin already exists. Registration is closed.');
  }

  const db = await getDb();
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const result = await db.collection('users').insertOne({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash,
    role: 'admin',
    createdAt: new Date(),
  });

  return {
    id: asId(result.insertedId),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: 'admin' as const,
  } satisfies AdminUser;
}

export async function findAdminByEmail(email: string) {
  const db = await getDb();
  return db.collection('users').findOne({
    email: email.trim().toLowerCase(),
    role: 'admin',
  });
}

export async function verifyAdminPassword(email: string, password: string): Promise<AdminUser | undefined> {
  const user = await findAdminByEmail(email);
  if (!user?.passwordHash) {
    return undefined;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return undefined;
  }

  return {
    id: asId(user._id),
    email: user.email,
    name: user.name,
    role: 'admin',
  };
}

function mapUsername(doc: WithId<Document>): UsernameRecord {
  return {
    id: asId(doc._id),
    username: doc.username || '',
    owner: doc.owner || '',
    status: doc.status || 'active',
    note: doc.note || '',
    telegramId: doc.telegramId || undefined,
    source: doc.source === 'telegram' ? 'telegram' : 'manual',
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function listUsernames(): Promise<UsernameRecord[]> {
  const db = await getDb();
  const rows = await db.collection('usernames').find({}).sort({ createdAt: -1 }).toArray();
  return rows.map(mapUsername);
}

export async function addUsername(input: { username: string; owner: string; status: UsernameRecord['status']; note: string }) {
  const db = await getDb();
  const username = input.username.replace(/^@/, '').trim().toLowerCase();
  if (!username) {
    throw new Error('Username is required.');
  }

  await db.collection('usernames').insertOne({
    username,
    owner: input.owner.trim(),
    status: input.status,
    note: input.note.trim(),
    source: 'manual',
    createdAt: new Date(),
  });
}

export async function upsertTelegramLogin(input: {
  telegramId: string;
  username: string;
  name: string;
}) {
  const telegramId = input.telegramId.trim();
  if (!telegramId) {
    throw new Error('telegramId is required.');
  }

  const username = input.username.replace(/^@/, '').trim().toLowerCase();
  const owner = input.name.trim();
  const db = await getDb();

  await db.collection('usernames').updateOne(
    { telegramId },
    {
      $set: {
        telegramId,
        username,
        owner,
        status: 'active',
        source: 'telegram',
        note: 'Đăng nhập từ JVgram',
        lastSeenAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function removeUsername(id: string) {
  const db = await getDb();
  await db.collection('usernames').deleteOne({ _id: new ObjectId(id) });
}

function mapUpgrade(doc: WithId<Document>): UpgradeRecord {
  return {
    id: asId(doc._id),
    title: doc.title,
    price: doc.price || '',
    description: doc.description || '',
    isActive: Boolean(doc.isActive),
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function listUpgrades(): Promise<UpgradeRecord[]> {
  const db = await getDb();
  const rows = await db.collection('upgrades').find({}).sort({ createdAt: -1 }).toArray();
  return rows.map(mapUpgrade);
}

export async function addUpgrade(input: { title: string; price: string; description: string; isActive: boolean }) {
  const db = await getDb();
  if (!input.title.trim()) {
    throw new Error('Title is required.');
  }

  await db.collection('upgrades').insertOne({
    title: input.title.trim(),
    price: input.price.trim(),
    description: input.description.trim(),
    isActive: input.isActive,
    createdAt: new Date(),
  });
}

export async function setUpgradeActive(id: string, isActive: boolean) {
  const db = await getDb();
  await db.collection('upgrades').updateOne({ _id: new ObjectId(id) }, { $set: { isActive } });
}

export async function removeUpgrade(id: string) {
  const db = await getDb();
  await db.collection('upgrades').deleteOne({ _id: new ObjectId(id) });
}

const DEFAULT_AI: AiSettings = {
  providerUrl: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  systemPrompt: 'You are the JVgram admin assistant.',
};

export async function getAiSettings(): Promise<AiSettings> {
  const db = await getDb();
  const doc = await db.collection('settings').findOne({ key: 'ai' });
  if (!doc) {
    return DEFAULT_AI;
  }

  return {
    providerUrl: doc.providerUrl || DEFAULT_AI.providerUrl,
    model: doc.model || DEFAULT_AI.model,
    systemPrompt: doc.systemPrompt || DEFAULT_AI.systemPrompt,
  };
}

export async function saveAiSettings(input: AiSettings) {
  const db = await getDb();
  await db.collection('settings').updateOne(
    { key: 'ai' },
    {
      $set: {
        key: 'ai',
        providerUrl: input.providerUrl.trim(),
        model: input.model.trim(),
        systemPrompt: input.systemPrompt.trim(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

const DEFAULT_TRANSLATE: TranslateSettings = {
  provider: 'google',
  enabled: {
    google: true,
    mymemory: true,
    libretranslate: true,
    deepl: true,
  },
  myMemoryEmail: '',
  deeplApiKey: '',
  libreApiKey: '',
  sourceLang: 'auto',
  targetLang: 'vi',
  libreUrl: 'https://libretranslate.com/translate',
};

function readTranslateCredentials(doc: {
  apiKey?: string;
  myMemoryEmail?: string;
  deeplApiKey?: string;
  libreApiKey?: string;
}) {
  const legacy = doc.apiKey || '';
  const isEmail = legacy.includes('@');

  return {
    myMemoryEmail: doc.myMemoryEmail || (isEmail ? legacy : '') || DEFAULT_TRANSLATE.myMemoryEmail,
    deeplApiKey: doc.deeplApiKey || (!isEmail ? legacy : '') || DEFAULT_TRANSLATE.deeplApiKey,
    libreApiKey: doc.libreApiKey || (!isEmail ? legacy : '') || DEFAULT_TRANSLATE.libreApiKey,
  };
}

function readEnabled(value: unknown): TranslateEnabledMap {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};

  return {
    google: raw.google !== false,
    mymemory: raw.mymemory !== false,
    libretranslate: raw.libretranslate !== false,
    deepl: raw.deepl !== false,
  };
}

export function listEnabledTranslateProviders(settings: TranslateSettings): TranslateProvider[] {
  return TRANSLATE_PROVIDERS.filter((provider) => settings.enabled[provider]);
}

export function resolveTranslateProvider(
  requested: unknown,
  settings: TranslateSettings,
): TranslateProvider {
  const enabled = listEnabledTranslateProviders(settings);
  if (!enabled.length) {
    return settings.provider;
  }

  const provider = asTranslateProvider(requested);
  return enabled.includes(provider) ? provider : enabled[0]!;
}

export function asTranslateProvider(value: unknown): TranslateSettings['provider'] {
  if (value === 'google' || value === 'libretranslate' || value === 'deepl' || value === 'mymemory') {
    return value;
  }

  return DEFAULT_TRANSLATE.provider;
}

export async function getTranslateSettings(): Promise<TranslateSettings> {
  const db = await getDb();
  const doc = await db.collection('settings').findOne({ key: 'translate' });
  if (!doc) {
    return DEFAULT_TRANSLATE;
  }

  return {
    provider: asTranslateProvider(doc.provider),
    enabled: readEnabled(doc.enabled),
    ...readTranslateCredentials({
      apiKey: typeof doc.apiKey === 'string' ? doc.apiKey : undefined,
      myMemoryEmail: typeof doc.myMemoryEmail === 'string' ? doc.myMemoryEmail : undefined,
      deeplApiKey: typeof doc.deeplApiKey === 'string' ? doc.deeplApiKey : undefined,
      libreApiKey: typeof doc.libreApiKey === 'string' ? doc.libreApiKey : undefined,
    }),
    sourceLang: typeof doc.sourceLang === 'string' ? doc.sourceLang : DEFAULT_TRANSLATE.sourceLang,
    targetLang: typeof doc.targetLang === 'string' ? doc.targetLang : DEFAULT_TRANSLATE.targetLang,
    libreUrl: typeof doc.libreUrl === 'string' ? doc.libreUrl : DEFAULT_TRANSLATE.libreUrl,
  };
}

export async function saveTranslateSettings(input: TranslateSettings) {
  const db = await getDb();
  await db.collection('settings').updateOne(
    { key: 'translate' },
    {
      $set: {
        key: 'translate',
        provider: asTranslateProvider(input.provider),
        enabled: input.enabled,
        myMemoryEmail: input.myMemoryEmail.trim(),
        deeplApiKey: input.deeplApiKey.trim(),
        libreApiKey: input.libreApiKey.trim(),
        sourceLang: input.sourceLang.trim() || DEFAULT_TRANSLATE.sourceLang,
        targetLang: input.targetLang.trim() || DEFAULT_TRANSLATE.targetLang,
        libreUrl: input.libreUrl.trim() || DEFAULT_TRANSLATE.libreUrl,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

const QUICK_REPLY_COLLECTION = 'quick_replies';
const GLOBAL_QUICK_REPLY_USER = 'global';

const DEFAULT_QUICK_REPLIES: { shortcut: string; content: string }[] = [
  { shortcut: 'payment', content: 'Vui lòng gửi mã giao dịch...' },
  { shortcut: 'hello', content: 'Xin chào, tôi có thể hỗ trợ gì cho bạn?' },
  { shortcut: 'price', content: 'Bảng giá hiện tại của chúng tôi...' },
];

export function normalizeQuickReplyShortcut(value: string) {
  return value.replace(/^\//, '').trim().toLowerCase().replace(/[^\w]/g, '');
}

function mapQuickReply(doc: WithId<Document>): QuickReplyRecord {
  const attachments = Array.isArray(doc.attachments)
    ? doc.attachments.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    id: asId(doc._id),
    userId: String(doc.userId || GLOBAL_QUICK_REPLY_USER),
    shortcut: String(doc.shortcut || ''),
    content: String(doc.content || ''),
    attachments,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

function parseAttachments(value: string | string[]) {
  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export async function listQuickReplies(): Promise<QuickReplyRecord[]> {
  const db = await getDb();
  const collection = db.collection(QUICK_REPLY_COLLECTION);
  const count = await collection.countDocuments();
  if (count === 0) {
    await collection.insertMany(
      DEFAULT_QUICK_REPLIES.map((item) => ({
        userId: GLOBAL_QUICK_REPLY_USER,
        shortcut: item.shortcut,
        content: item.content,
        attachments: [],
        createdAt: new Date(),
      })),
    );
  }

  const rows = await collection.find({}).sort({ shortcut: 1 }).toArray();
  return rows.map(mapQuickReply);
}

export async function addQuickReply(input: {
  userId?: string;
  shortcut: string;
  content: string;
  attachments?: string | string[];
}) {
  const shortcut = normalizeQuickReplyShortcut(input.shortcut);
  const content = input.content.trim();
  if (!shortcut) {
    throw new Error('Shortcut is required.');
  }
  if (!content) {
    throw new Error('Content is required.');
  }

  const db = await getDb();
  const existing = await db.collection(QUICK_REPLY_COLLECTION).findOne({ shortcut });
  if (existing) {
    throw new Error('Shortcut already exists.');
  }

  await db.collection(QUICK_REPLY_COLLECTION).insertOne({
    userId: (input.userId || GLOBAL_QUICK_REPLY_USER).trim() || GLOBAL_QUICK_REPLY_USER,
    shortcut,
    content,
    attachments: parseAttachments(input.attachments || []),
    createdAt: new Date(),
  });
}

export async function removeQuickReply(id: string) {
  const db = await getDb();
  await db.collection(QUICK_REPLY_COLLECTION).deleteOne({ _id: new ObjectId(id) });
}
