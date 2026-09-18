'use server';

import { redirect } from 'next/navigation';

import type { TranslateEnabledMap, TranslateProvider } from './types';
import { TRANSLATE_PROVIDERS } from './types';
import { clearSession, createSession, getSession } from './auth';
import {
  addQuickReply,
  addUpgrade,
  addUsername,
  countAdmins,
  createFirstAdmin,
  getAiSettings,
  getTranslateSettings,
  removeQuickReply,
  removeUpgrade,
  removeUsername,
  saveAiSettings,
  saveFeatureFlags,
  saveTranslateSettings,
  setUpgradeActive,
  verifyAdminPassword,
} from './data';

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

export async function setupAdmin(formData: FormData) {
  const name = formString(formData, 'name');
  const email = formString(formData, 'email');
  const password = formString(formData, 'password');

  if (!name || !email || password.length < 8) {
    redirect('/setup?error=invalid');
  }

  let admin;
  try {
    admin = await createFirstAdmin({ name, email, password });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('already exists')) {
      redirect('/login');
    }
    redirect('/setup?error=mongo');
  }

  await createSession(admin);
  redirect('/dashboard');
}

export async function loginAdmin(formData: FormData) {
  const email = formString(formData, 'email');
  const password = formString(formData, 'password');

  let hasAdmin = 0;
  try {
    hasAdmin = await countAdmins();
  } catch {
    redirect('/login?error=mongo');
  }

  if (!hasAdmin) {
    redirect('/setup');
  }

  let admin;
  try {
    admin = await verifyAdminPassword(email, password);
  } catch {
    redirect('/login?error=mongo');
  }

  if (!admin) {
    redirect('/login?error=invalid');
  }

  await createSession(admin);
  redirect('/dashboard');
}

export async function logoutAdmin() {
  await clearSession();
  redirect('/login');
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function createUsernameAction(formData: FormData) {
  await requireAdmin();
  try {
    await addUsername({
      username: formString(formData, 'username'),
      owner: formString(formData, 'owner'),
      status: (formString(formData, 'status') || 'active') as 'active' | 'reserved' | 'premium',
      note: formString(formData, 'note'),
    });
  } catch {
    redirect('/usernames?error=save');
  }
  redirect('/usernames');
}

export async function deleteUsernameAction(formData: FormData) {
  await requireAdmin();
  await removeUsername(formString(formData, 'id'));
  redirect('/usernames');
}

export async function createUpgradeAction(formData: FormData) {
  await requireAdmin();
  try {
    await addUpgrade({
      title: formString(formData, 'title'),
      price: formString(formData, 'price'),
      description: formString(formData, 'description'),
      isActive: formData.get('isActive') === 'on',
    });
  } catch {
    redirect('/upgrades?error=save');
  }
  redirect('/upgrades');
}

export async function toggleUpgradeAction(formData: FormData) {
  await requireAdmin();
  await setUpgradeActive(formString(formData, 'id'), formString(formData, 'isActive') === 'true');
  redirect('/upgrades');
}

export async function deleteUpgradeAction(formData: FormData) {
  await requireAdmin();
  await removeUpgrade(formString(formData, 'id'));
  redirect('/upgrades');
}

export async function saveAiSettingsAction(formData: FormData) {
  await requireAdmin();
  const current = await getAiSettings();
  await saveAiSettings({
    providerUrl: formString(formData, 'providerUrl') || current.providerUrl,
    model: formString(formData, 'model') || current.model,
    systemPrompt: formString(formData, 'systemPrompt') || current.systemPrompt,
  });
  redirect('/ai?saved=1');
}

function asTranslateProvider(value: string): TranslateProvider {
  if (value === 'google' || value === 'libretranslate' || value === 'deepl' || value === 'mymemory') {
    return value;
  }

  return 'google';
}

function readEnabledFromForm(formData: FormData): TranslateEnabledMap {
  const selected = new Set(formData.getAll('enabled').map(String));
  const enabled = {
    google: selected.has('google'),
    mymemory: selected.has('mymemory'),
    libretranslate: selected.has('libretranslate'),
    deepl: selected.has('deepl'),
  };

  if (!TRANSLATE_PROVIDERS.some((provider) => enabled[provider])) {
    enabled.google = true;
  }

  return enabled;
}

export async function saveTranslateSettingsAction(formData: FormData) {
  await requireAdmin();
  const current = await getTranslateSettings();
  const enabled = readEnabledFromForm(formData);
  const requested = asTranslateProvider(formString(formData, 'provider'));
  const provider = enabled[requested]
    ? requested
    : TRANSLATE_PROVIDERS.find((item) => enabled[item]) || 'google';

  await saveTranslateSettings({
    provider,
    enabled,
    myMemoryEmail: formString(formData, 'myMemoryEmail') || current.myMemoryEmail,
    deeplApiKey: formString(formData, 'deeplApiKey') || current.deeplApiKey,
    libreApiKey: formString(formData, 'libreApiKey') || current.libreApiKey,
    sourceLang: formString(formData, 'sourceLang') || current.sourceLang,
    targetLang: formString(formData, 'targetLang') || current.targetLang,
    libreUrl: formString(formData, 'libreUrl') || current.libreUrl,
  });
  redirect('/translate?saved=1');
}

export async function createQuickReplyAction(formData: FormData) {
  await requireAdmin();
  try {
    await addQuickReply({
      userId: formString(formData, 'userId') || 'global',
      shortcut: formString(formData, 'shortcut'),
      content: formString(formData, 'content'),
      attachments: formString(formData, 'attachments'),
    });
  } catch {
    redirect('/quick-replies?error=save');
  }
  redirect('/quick-replies');
}

export async function deleteQuickReplyAction(formData: FormData) {
  await requireAdmin();
  await removeQuickReply(formString(formData, 'id'));
  redirect('/quick-replies');
}

export async function saveFeatureFlagsAction(formData: FormData) {
  const session = await requireAdmin();
  await saveFeatureFlags(
    { priorityGoldTheme: formString(formData, 'priorityGoldTheme') !== '0' },
    session.id,
  );
  redirect('/features?saved=1');
}
