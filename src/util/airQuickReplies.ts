const ADMIN_API_URL = import.meta.env.TG_ADMIN_API_URL;
const REFRESH_MS = 60 * 1000;

export type AirQuickReply = {
  source: 'air';
  id: string;
  shortcut: string;
  content: string;
  attachments: string[];
};

type StoreListener = NoneToVoidFunction;

function normalizeShortcut(value: string) {
  return value.replace(/^\//, '').trim().toLowerCase();
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function mapReply(raw: Record<string, unknown>): AirQuickReply | undefined {
  const shortcut = normalizeShortcut(asString(raw.shortcut));
  const content = asString(raw.content).trim();
  if (!shortcut || !content) return undefined;

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map((item) => asString(item).trim()).filter(Boolean)
    : [];

  return {
    source: 'air',
    id: asString(raw.id) || shortcut,
    shortcut,
    content,
    attachments,
  };
}

class AirQuickReplyStore {
  private replies: AirQuickReply[] = [];

  private listeners = new Set<StoreListener>();

  private loadPromise?: Promise<void>;

  private lastLoadAt = 0;

  getReplies() {
    return this.replies;
  }

  subscribe(cb: StoreListener) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  load() {
    const now = Date.now();
    if (this.loadPromise && now - this.lastLoadAt < REFRESH_MS) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchReplies();
    return this.loadPromise;
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  private async fetchReplies() {
    if (!ADMIN_API_URL) {
      this.replies = [];
      this.notify();
      return;
    }

    try {
      const response = await fetch(`${ADMIN_API_URL}/api/quick-replies`);
      if (!response.ok) {
        return;
      }

      const data = await response.json() as { items?: Record<string, unknown>[] };
      const items = Array.isArray(data.items) ? data.items : [];
      this.replies = items.map(mapReply).filter((item): item is AirQuickReply => Boolean(item));
      this.lastLoadAt = Date.now();
      this.notify();
    } catch {
      // Admin API is optional
    }
  }
}

export const airQuickReplyStore = new AirQuickReplyStore();
void airQuickReplyStore.load();

export function isAirQuickReply(item: object): item is AirQuickReply {
  return 'source' in item && (item as { source?: string }).source === 'air';
}
