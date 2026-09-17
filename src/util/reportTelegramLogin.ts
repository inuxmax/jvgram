import type { ApiUser } from '../api/types';
import { getMainUsername, getUserFullName } from '../global/helpers';

const ADMIN_API_URL = import.meta.env.TG_ADMIN_API_URL;

export function reportTelegramLogin(user: ApiUser) {
  if (!ADMIN_API_URL) {
    return;
  }

  const name = getUserFullName(user);
  if (!name) {
    return;
  }

  const payload = {
    telegramId: user.id,
    username: getMainUsername(user) || '',
    name,
  };

  void fetch(`${ADMIN_API_URL}/api/telegram/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Admin panel may be offline
  });
}
