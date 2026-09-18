import { setThemeColorOverlay } from './switchTheme';

const ADMIN_API_URL = import.meta.env.TG_ADMIN_API_URL;
const STORAGE_KEY = 'taa.priorityGold';
const FLAG_POLL_MS = 60_000;
const MAX_CUSTOM_BYTES = 400 * 1024;
const ALLOWED_CUSTOM_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type AppSkin = 'default' | 'priority-gold';
export type GoldWallpaperId =
  | 'default'
  | 'dragon-gold'
  | 'minimal-gold'
  | 'dark-gold'
  | 'gold-wave'
  | 'gold-pattern'
  | 'custom';

export type PriorityGoldState = {
  skin: AppSkin;
  wallpaper: GoldWallpaperId;
  customWallpaper?: string;
  flagEnabled: boolean;
  flagFetched: boolean;
};

type Listener = NoneToVoidFunction;

export const GOLD_COLOR_OVERLAY: Record<string, string> = {
  '--color-primary': '#D4AF37',
  '--color-primary-opacity': '#D4AF371E',
  '--color-primary-opacity-hover': '#D4AF3740',
  '--color-primary-tint': '#D4AF371A',
  '--color-primary-shade': '#C9A227',
  '--color-primary-shade-rgb': '201,162,39',
  '--color-background': '#080705',
  '--color-background-compact-menu': '#12100CDD',
  '--color-web-app-browser': '#0807058F',
  '--color-background-compact-menu-reactions': '#12100CDD',
  '--color-background-secondary': '#0D0B08',
  '--color-background-secondary-accent': '#12100C',
  '--color-background-sidebar': '#0D0B08',
  '--color-background-own': '#3A2B12',
  '--color-background-own-apple': '#3A2B12',
  '--color-background-selected': '#12100C',
  '--color-background-own-selected': '#4A3818',
  '--color-chat-hover': '#12100C',
  '--color-chat-active': '#D4AF37',
  '--color-chat-active-greyed': '#C9A227',
  '--color-item-hover': '#12100C',
  '--color-item-active': '#1A160F',
  '--color-text': '#F5F1E8',
  '--color-text-rgb': '245,241,232',
  '--color-text-secondary': '#9E9688',
  '--color-text-secondary-rgb': '158,150,136',
  '--color-icon-secondary': '#9E9688',
  '--color-text-secondary-apple': '#9E9688',
  '--color-borders': '#D4AF372E',
  '--color-borders-input': '#8C6424',
  '--color-dividers': '#1A160F',
  '--color-dividers-android': '#0D0B08',
  '--color-links': '#E0B94F',
  '--color-gray': '#9E9688',
  '--color-list-icon': '#9E9688',
  '--color-default-shadow': '#0000009C',
  '--color-light-shadow': '#00000040',
  '--color-active': '#D4AF37',
  '--color-active-darker': '#C9A227',
  '--color-text-meta-colored': '#E0B94F',
  '--color-reply-hover': '#17130D',
  '--color-reply-active': '#1A160F',
  '--color-reply-own-hover': '#4A3818',
  '--color-reply-own-hover-apple': '#4A3818',
  '--color-reply-own-active': '#5A4520',
  '--color-reply-own-active-apple': '#5A4520',
  '--color-accent-own': '#F2D27A',
  '--color-accent-own-rgb': '242,210,122',
  '--color-message-meta-own': '#F2D27A88',
  '--color-own-links': '#F2D27A',
  '--color-code': '#E0B94F',
  '--color-code-own': '#F2D27A',
  '--color-composer-button': '#9E9688CC',
  '--color-message-reaction': '#17130D',
  '--color-message-reaction-hover': '#1A160F',
  '--color-message-reaction-own': '#4A3818',
  '--color-message-reaction-hover-own': '#5A4520',
  '--color-voice-transcribe-button': '#17130D',
  '--color-voice-transcribe-button-own': '#3A2B12',
  '--color-chat-username': '#F2D27A',
  '--color-hover-overlay': '#D4AF370F',
  '--color-toast-background': '#080705CC',
};

const WALLPAPER_IDS: GoldWallpaperId[] = [
  'default', 'dragon-gold', 'minimal-gold', 'dark-gold', 'gold-wave', 'gold-pattern', 'custom',
];

export function resolveActiveSkin(preference: AppSkin, flagEnabled: boolean): AppSkin {
  if (preference === 'priority-gold' && flagEnabled) {
    return 'priority-gold';
  }
  return 'default';
}

export function isGoldWallpaperId(value: string): value is GoldWallpaperId {
  return (WALLPAPER_IDS as string[]).includes(value);
}

function readStored(): PriorityGoldState {
  const fallback: PriorityGoldState = {
    skin: 'default',
    wallpaper: 'dragon-gold',
    flagEnabled: true,
    flagFetched: false,
  };

  if (typeof localStorage !== 'object') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PriorityGoldState>;
    return {
      skin: parsed.skin === 'priority-gold' ? 'priority-gold' : 'default',
      wallpaper: parsed.wallpaper && isGoldWallpaperId(parsed.wallpaper) ? parsed.wallpaper : 'dragon-gold',
      customWallpaper: typeof parsed.customWallpaper === 'string' && parsed.customWallpaper.startsWith('data:image/')
        ? parsed.customWallpaper
        : undefined,
      flagEnabled: parsed.flagEnabled !== false,
      flagFetched: Boolean(parsed.flagFetched),
    };
  } catch {
    return fallback;
  }
}

function persist(state: PriorityGoldState) {
  if (typeof localStorage !== 'object') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyDom(state: PriorityGoldState) {
  if (typeof document !== 'object') return;

  const active = resolveActiveSkin(state.skin, state.flagEnabled);
  const html = document.documentElement;

  if (active === 'priority-gold') {
    html.classList.add('priority-gold');
    html.setAttribute('data-theme', 'priority-gold');
    html.setAttribute('data-gold-wallpaper', state.wallpaper);
    setThemeColorOverlay(GOLD_COLOR_OVERLAY);
    if (state.wallpaper === 'custom' && state.customWallpaper) {
      html.style.setProperty('--priority-gold-wallpaper', `url("${state.customWallpaper}")`);
      html.style.setProperty('--priority-gold-wallpaper-opacity', '0.28');
      html.style.setProperty('--priority-gold-wallpaper-size', 'cover');
    } else {
      html.style.removeProperty('--priority-gold-wallpaper');
      html.style.removeProperty('--priority-gold-wallpaper-opacity');
      html.style.removeProperty('--priority-gold-wallpaper-size');
    }
    return;
  }

  html.classList.remove('priority-gold');
  html.removeAttribute('data-theme');
  html.removeAttribute('data-gold-wallpaper');
  html.style.removeProperty('--priority-gold-wallpaper');
  html.style.removeProperty('--priority-gold-wallpaper-opacity');
  html.style.removeProperty('--priority-gold-wallpaper-size');
  setThemeColorOverlay(undefined);
}

type StoreOptions = {
  adminApiUrl?: string;
};

export function createPriorityGoldStore(options: StoreOptions = {}) {
  const adminApiUrl = options.adminApiUrl ?? ADMIN_API_URL;
  const listeners = new Set<Listener>();
  let state = readStored();
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let isInited = false;

  function notify() {
    listeners.forEach((cb) => cb());
  }

  function commit(next: PriorityGoldState) {
    state = next;
    persist(state);
    applyDom(state);
    notify();
  }

  async function refreshFlag() {
    if (!adminApiUrl) {
      if (!state.flagFetched) {
        commit({ ...state, flagFetched: true });
      }
      return;
    }

    try {
      const response = await fetch(`${adminApiUrl}/api/features`);
      if (!response.ok) return;
      const data = await response.json() as { priorityGoldTheme?: unknown };
      const flagEnabled = data.priorityGoldTheme !== false;
      if (flagEnabled === state.flagEnabled && state.flagFetched) {
        return;
      }
      commit({
        ...state,
        flagEnabled,
        flagFetched: true,
      });
    } catch {
      if (!state.flagFetched) {
        commit({ ...state, flagFetched: true });
      }
    }
  }

  return {
    subscribe: (cb: Listener) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getState: () => state,
    getActiveSkin: () => resolveActiveSkin(state.skin, state.flagEnabled),
    isFlagEnabled: () => state.flagEnabled,
    setSkin: (skin: AppSkin) => {
      if (skin === 'priority-gold' && !state.flagEnabled) {
        return false;
      }
      commit({ ...state, skin });
      return true;
    },
    setWallpaper: (wallpaper: GoldWallpaperId) => {
      commit({ ...state, wallpaper });
    },
    setCustomWallpaper: (dataUrl?: string) => {
      commit({
        ...state,
        wallpaper: dataUrl ? 'custom' : 'dragon-gold',
        customWallpaper: dataUrl,
      });
    },
    applyFromFile: async (file: File) => {
      if (!ALLOWED_CUSTOM_TYPES.has(file.type) || file.size > MAX_CUSTOM_BYTES) {
        return false;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      if (!dataUrl.startsWith('data:image/')) {
        return false;
      }
      commit({
        ...state,
        wallpaper: 'custom',
        customWallpaper: dataUrl,
      });
      return true;
    },
    refreshFlag,
    init: () => {
      if (isInited) return;
      isInited = true;
      applyDom(state);
      void refreshFlag();
      if (typeof window === 'object') {
        pollTimer = setInterval(() => {
          void refreshFlag();
        }, FLAG_POLL_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            void refreshFlag();
          }
        });
      }
      return () => {
        if (pollTimer !== undefined) clearInterval(pollTimer);
      };
    },
  };
}

export const MAX_GOLD_CUSTOM_BYTES = MAX_CUSTOM_BYTES;
export const GOLD_CUSTOM_TYPES = ALLOWED_CUSTOM_TYPES;
export const priorityGoldStore = createPriorityGoldStore();
