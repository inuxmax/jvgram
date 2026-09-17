import type { SharedSessionData } from '../types';

import { MULTIACCOUNT_MAX_SLOTS } from '../config';
import download from './download';
import {
  getAccountsInfo,
  getNextFreeAccountSlot,
  loadSlotSession,
  notifyAccountsChanged,
  writeSlotSession,
} from './multiaccount';

export const ACCOUNT_BACKUP_KIND = 'telegram-air-accounts';
export const ACCOUNT_BACKUP_VERSION = 1;

export type AccountBackupFile = {
  kind: typeof ACCOUNT_BACKUP_KIND;
  version: number;
  createdAt: number;
  accounts: SharedSessionData[];
};

type ImportResult = {
  imported: number;
  skipped: number;
};

export function buildAccountsBackup(slots?: number[]): AccountBackupFile {
  const accounts = (slots?.length ? slots : Object.keys(getAccountsInfo()).map(Number))
    .map((slot) => loadSlotSession(slot))
    .filter((session): session is SharedSessionData => Boolean(session?.dcId && session.userId));

  return {
    kind: ACCOUNT_BACKUP_KIND,
    version: ACCOUNT_BACKUP_VERSION,
    createdAt: Date.now(),
    accounts,
  };
}

export function parseAccountsBackup(raw: string): AccountBackupFile | undefined {
  try {
    const data = JSON.parse(raw) as AccountBackupFile;
    if (data.kind !== ACCOUNT_BACKUP_KIND || data.version !== ACCOUNT_BACKUP_VERSION) {
      return undefined;
    }
    if (!Array.isArray(data.accounts) || !data.accounts.length) {
      return undefined;
    }
    const accounts = data.accounts.filter((account) => (
      Boolean(account?.dcId && account.userId)
    ));
    if (!accounts.length) return undefined;

    return {
      ...data,
      accounts,
    };
  } catch (err) {
    return undefined;
  }
}

export function importAccountsBackup(backup: AccountBackupFile): ImportResult {
  const existingByUserId = new Set(
    Object.values(getAccountsInfo()).map((account) => account.userId).filter(Boolean),
  );
  let imported = 0;
  let skipped = 0;
  let nextSlot = getNextFreeAccountSlot();

  backup.accounts.forEach((account) => {
    if (!account.userId || existingByUserId.has(account.userId) || nextSlot > MULTIACCOUNT_MAX_SLOTS) {
      skipped += 1;
      return;
    }

    writeSlotSession(nextSlot, account, true);
    existingByUserId.add(account.userId);
    imported += 1;
    nextSlot += 1;
    while (loadSlotSession(nextSlot)) {
      nextSlot += 1;
    }
  });

  if (imported) notifyAccountsChanged();

  return { imported, skipped };
}

export function downloadAccountsBackup(slots?: number[]) {
  const backup = buildAccountsBackup(slots);
  if (!backup.accounts.length) return 0;

  const date = new Date().toISOString().slice(0, 10);
  const filename = slots?.length === 1
    ? `telegram-air-profile-${date}.json`
    : `telegram-air-profiles-${date}.json`;
  const blob = new Blob([JSON.stringify(backup, undefined, 2)], { type: 'application/json' });
  download(URL.createObjectURL(blob), filename);
  return backup.accounts.length;
}
