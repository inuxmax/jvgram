const ADMIN_API_URL = import.meta.env.TG_ADMIN_API_URL;
const STORAGE_KEY = 'taa.airQuickReplies';
const MAX_REPLIES = 50;
const MAX_SHORTCUT_LENGTH = 32;
const MAX_CONTENT_LENGTH = 2000;

export type AirQuickReply = {
  source: 'air';
  id: string;
  shortcut: string;
  content: string;
  attachments: string[];
};

type StoreListener = NoneToVoidFunction;

type StoreOptions = {
  adminApiUrl?: string;
};

export const DEFAULT_AIR_QUICK_REPLIES: Array<Pick<AirQuickReply, 'shortcut' | 'content'>> = [
  { shortcut: 'hello', content: 'Xin chào, tôi có thể hỗ trợ gì cho bạn?' },
  { shortcut: 'payment', content: 'Vui lòng gửi mã giao dịch...' },
  { shortcut: 'price', content: 'Bảng giá hiện tại của chúng tôi...' },
];

export function normalizeQuickReplyShortcut(value: string) {
  return value.replace(/^\//, '').trim().toLowerCase().replace(/[^\w]/g, '').slice(0, MAX_SHORTCUT_LENGTH);
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function createReplyId() {
  return `qr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapReply(raw: Record<string, unknown>, fallbackId?: string): AirQuickReply | undefined {
  const shortcut = normalizeQuickReplyShortcut(asString(raw.shortcut));
  const content = asString(raw.content).trim().slice(0, MAX_CONTENT_LENGTH);
  if (!shortcut || !content) return undefined;

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map((item) => asString(item).trim()).filter(Boolean)
    : [];

  return {
    source: 'air',
    id: asString(raw.id) || fallbackId || shortcut,
    shortcut,
    content,
    attachments,
  };
}

function buildDefaultReplies(): AirQuickReply[] {
  return DEFAULT_AIR_QUICK_REPLIES.map((item) => ({
    source: 'air' as const,
    id: item.shortcut,
    shortcut: item.shortcut,
    content: item.content,
    attachments: [],
  }));
}

function readStored(): AirQuickReply[] | undefined {
  if (typeof localStorage !== 'object') return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const replies = parsed
      .map((item) => (item && typeof item === 'object' ? mapReply(item as Record<string, unknown>) : undefined))
      .filter((item): item is AirQuickReply => Boolean(item));
    return replies;
  } catch {
    return undefined;
  }
}

function persist(replies: AirQuickReply[]) {
  if (typeof localStorage !== 'object') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(replies));
}

export function createAirQuickReplyStore(options: StoreOptions = {}) {
  const adminApiUrl = options.adminApiUrl ?? ADMIN_API_URL;
  const listeners = new Set<StoreListener>();
  const stored = readStored();
  let replies: AirQuickReply[] = stored || buildDefaultReplies();
  let isSeeded = Boolean(stored);
  let isSettingsOpen = false;
  let loadPromise: Promise<void> | undefined;

  function notify() {
    listeners.forEach((cb) => cb());
  }

  function commit(next: AirQuickReply[]) {
    replies = next;
    isSeeded = true;
    persist(replies);
    notify();
  }

  async function seedFromAdmin() {
    if (!adminApiUrl) return undefined;
    try {
      const response = await fetch(`${adminApiUrl}/api/quick-replies`);
      if (!response.ok) return undefined;
      const data = await response.json() as { items?: Record<string, unknown>[] };
      const items = Array.isArray(data.items) ? data.items : [];
      const mapped = items.map((item) => mapReply(item)).filter((item): item is AirQuickReply => Boolean(item));
      return mapped.length ? mapped : undefined;
    } catch {
      return undefined;
    }
  }

  return {
    subscribe: (cb: StoreListener) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getReplies: () => replies,
    isSettingsOpen: () => isSettingsOpen,
    openSettings: () => {
      isSettingsOpen = true;
      notify();
    },
    closeSettings: () => {
      isSettingsOpen = false;
      notify();
    },
    addReply: (input: { shortcut: string; content: string }) => {
      const shortcut = normalizeQuickReplyShortcut(input.shortcut);
      const content = input.content.trim().slice(0, MAX_CONTENT_LENGTH);
      if (!shortcut || !content) return false;
      if (replies.length >= MAX_REPLIES) return false;
      if (replies.some((item) => item.shortcut === shortcut)) return false;
      commit([
        ...replies,
        {
          source: 'air',
          id: createReplyId(),
          shortcut,
          content,
          attachments: [],
        },
      ]);
      return true;
    },
    updateReply: (id: string, input: { shortcut: string; content: string }) => {
      const shortcut = normalizeQuickReplyShortcut(input.shortcut);
      const content = input.content.trim().slice(0, MAX_CONTENT_LENGTH);
      if (!shortcut || !content) return false;
      if (replies.some((item) => item.shortcut === shortcut && item.id !== id)) return false;
      const index = replies.findIndex((item) => item.id === id);
      if (index < 0) return false;
      const current = replies[index];
      if (!current) return false;
      const next = replies.slice();
      next[index] = {
        ...current,
        shortcut,
        content,
      };
      commit(next);
      return true;
    },
    removeReply: (id: string) => {
      commit(replies.filter((item) => item.id !== id));
      return true;
    },
    load: () => {
      if (isSeeded) {
        notify();
        return Promise.resolve();
      }
      if (loadPromise) return loadPromise;
      loadPromise = (async () => {
        const fromAdmin = await seedFromAdmin();
        if (!isSeeded) {
          commit(fromAdmin || replies);
        }
      })();
      return loadPromise;
    },
  };
}

export const MAX_AIR_QUICK_REPLIES = MAX_REPLIES;
export const MAX_AIR_QUICK_REPLY_CONTENT = MAX_CONTENT_LENGTH;
export const airQuickReplyStore = createAirQuickReplyStore();

export function isAirQuickReply(item: object): item is AirQuickReply {
  return 'source' in item && (item as { source?: string }).source === 'air';
}
