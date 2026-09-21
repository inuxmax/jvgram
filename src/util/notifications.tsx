import { getActions, getGlobal, setGlobal } from '../global';

import type {
  ApiChat, ApiMessage, ApiPeer, ApiPeerReaction,
  ApiPhoneCall, ApiUser,
} from '../api/types';
import type { GlobalState } from '../global/types';
import { ApiMediaFormat } from '../api/types';

import { APP_NAME, DEBUG, IS_TEST } from '../config';
import {
  getChatAvatarHash,
  getChatTitle,
  getMessageRecentReaction,
  getUserFullName,
} from '../global/helpers';
import {
  getIsChatMuted,
  getIsChatSilent,
  getShouldIgnoreNotificationMute,
  getShouldShowMessagePreview,
  mergeNotifySettings,
} from '../global/helpers/notifications';
import { getMessageSenderName } from '../global/helpers/peers';
import {
  selectCurrentMessageList,
  selectCustomEmoji,
  selectIsChatWithSelf,
  selectNotifyDefaults,
  selectNotifyException,
  selectPeer,
  selectSender,
  selectSettingsKeys,
  selectTopicFromMessage,
} from '../global/selectors';
import { callApi } from '../api/gramjs';
import { IS_TAURI } from './browser/globalEnvironment';
import { IS_SERVICE_WORKER_SUPPORTED, IS_TOUCH_ENV } from './browser/windowEnvironment';
import jsxToHtml from './element/jsxToHtml';
import { buildCollectionByKey } from './iteratees';
import { getTranslationFn } from './localization';
import * as mediaLoader from './mediaLoader';
import { oldTranslate } from './oldLangProvider';
import { debounce } from './schedulers';
import { getServerTime } from './serverTime';

import MessageSummary from '../components/common/MessageSummary';

function getDeviceToken(subscription: PushSubscription) {
  const data = subscription.toJSON();
  return JSON.stringify({
    endpoint: data.endpoint,
    keys: data.keys,
  });
}

function checkIfPushSupported() {
  if (!IS_SERVICE_WORKER_SUPPORTED || IS_TAURI) return false;

  if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Push notifications aren\'t supported.');
    }
    return false;
  }

  // If permission is denied, it is blocked until the user manually changes their settings
  if (Notification.permission === 'denied') {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] The user has blocked push notifications.');
    }
    return false;
  }

  // Check if push messaging is supported
  if (!('PushManager' in window)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Push messaging isn\'t supported.');
    }
    return false;
  }

  return true;
}

export function checkIfNotificationsSupported() {
  // Desktop shells show native OS toasts instead of the Web Notification API
  if (IS_TAURI) return true;

  // Let's check if the browser supports notifications
  if (!('Notification' in window)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] This browser does not support desktop notification');
    }
    return false;
  }

  if (Notification.permission === 'denied') {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] The user has blocked push notifications.');
    }
    return false;
  }
  return true;
}

const expirationTime = 12 * 60 * 60 * 1000; // 12 hours
// Notification id is removed from soundPlayed cache after 3 seconds
const soundPlayedDelay = 3 * 1000;
const soundPlayedIds = new Set<string>();
const notificationSound = new Audio('./notification.mp3');
notificationSound.setAttribute('mozaudiochannel', 'notification');

export async function playNotifySound(id?: string, volume?: number) {
  if (id !== undefined && soundPlayedIds.has(id)) return;
  const { notificationSoundVolume } = selectSettingsKeys(getGlobal());
  const currentVolume = volume ? volume / 10 : notificationSoundVolume / 10;
  if (currentVolume === 0) return;
  notificationSound.volume = currentVolume;
  if (id !== undefined) {
    notificationSound.addEventListener('ended', () => {
      soundPlayedIds.add(id);
    }, { once: true });

    setTimeout(() => {
      soundPlayedIds.delete(id);
    }, soundPlayedDelay);
  }

  try {
    await notificationSound.play();
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Unable to play notification sound');
    }
  }
}

export const playNotifySoundDebounced = debounce(playNotifySound, 1000, true, false);

function checkIfShouldResubscribe(subscription: PushSubscription | null) {
  const global = getGlobal();
  if (!global.push || !subscription) return true;
  if (getDeviceToken(subscription) !== global.push.deviceToken) return true;
  return Date.now() - global.push.subscribedAt > expirationTime;
}

export async function requestPermission() {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const isGranted = await invoke<boolean>('plugin:notification|is_permission_granted');
      if (isGranted) return true;
      const permission = await invoke<string>('plugin:notification|request_permission');
      return String(permission).toLowerCase() === 'granted';
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn('[PUSH] Unable to request desktop notification permission', err);
      }
      // Packaged desktop toasts do not require a browser permission prompt
      return true;
    }
  }

  if (!('Notification' in window)) {
    return false;
  }
  let permission = Notification.permission;
  if (!['granted', 'denied'].includes(permission)) {
    permission = await Notification.requestPermission();
  }
  return permission === 'granted';
}

async function unsubscribeFromPush(subscription: PushSubscription | null) {
  const { deleteDeviceToken } = getActions();
  if (subscription) {
    try {
      const deviceToken = getDeviceToken(subscription);
      await callApi('unregisterDevice', deviceToken);
      await subscription.unsubscribe();
      deleteDeviceToken();
      return;
    } catch (error) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[PUSH] Unable to unsubscribe from push.', error);
      }
    }
  }
  const global = getGlobal();
  if (global.push) {
    await callApi('unregisterDevice', global.push.deviceToken);
    deleteDeviceToken();
  }
}

export async function unsubscribe() {
  if (!checkIfPushSupported()) return;
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  await unsubscribeFromPush(subscription);
}

// Load custom emoji from the api if it's not cached already
async function loadCustomEmoji(id: string) {
  let global = getGlobal();
  if (selectCustomEmoji(global, id)) return;
  const customEmoji = await callApi('fetchCustomEmoji', {
    documentId: [id],
  });
  if (!customEmoji) return;
  global = getGlobal();
  global = {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      byId: {
        ...global.customEmojis.byId,
        ...buildCollectionByKey(customEmoji, 'id'),
      },
    },
  };
  setGlobal(global);
}

let isSubscriptionFailed = false;
export function checkIfOfflinePushFailed() {
  return isSubscriptionFailed;
}

export async function subscribe() {
  const { setDeviceToken, updateWebNotificationSettings } = getActions();
  let hasWebNotifications = false;
  let hasPushNotifications = false;
  if (!checkIfPushSupported()) {
    // Ask for notification permissions only if service worker notifications are not supported
    // As pushManager.subscribe automatically triggers permission popup
    hasWebNotifications = await requestPermission();
    updateWebNotificationSettings({
      hasWebNotifications,
      hasPushNotifications,
    });
    return;
  }
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  if (!checkIfShouldResubscribe(subscription)) return;
  await unsubscribeFromPush(subscription);
  try {
    subscription = await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
    });
    const deviceToken = getDeviceToken(subscription);
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PUSH] Received push subscription: ', deviceToken);
    }
    await callApi('registerDevice', deviceToken);
    setDeviceToken({ token: deviceToken });
    hasPushNotifications = true;
    hasWebNotifications = true;
  } catch (error: any) {
    if (Notification.permission === 'denied') {
      // The user denied the notification permission which
      // means we failed to subscribe and the user will need
      // to manually change the notification permission to
      // subscribe to push messages
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn('[PUSH] The user has blocked push notifications.');
      }
    } else {
      // A problem occurred with the subscription, this can
      // often be down to an issue or lack of the gcm_sender_id
      // and / or gcm_user_visible_only
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[PUSH] Unable to subscribe to push.', error);
      }
      // Request permissions and fall back to local notifications
      // if pushManager.subscribe was aborted due to invalid VAPID key.
      if ([DOMException.ABORT_ERR, DOMException.NOT_SUPPORTED_ERR].includes(error.code)) {
        isSubscriptionFailed = true;
        hasWebNotifications = await requestPermission();
      }
    }
  }
  updateWebNotificationSettings({
    hasWebNotifications,
    hasPushNotifications,
  });
}

function checkIfShouldNotify(chat: ApiChat, message: Partial<ApiMessage>) {
  const global = getGlobal();
  const notifyDefaults = selectNotifyDefaults(global);
  const notifyException = getChatNotifyException(global, chat);
  const isChatMuted = getIsChatMuted(chat, notifyDefaults, notifyException);
  const topic = selectTopicFromMessage(global, message as ApiMessage);
  const topicMutedUntil = topic?.notifySettings.mutedUntil;
  const isMuted = topicMutedUntil === undefined ? isChatMuted : topicMutedUntil > getServerTime();
  const shouldNotifyAboutPinnedMessages = global.settings.byKey.shouldNotifyAboutPinnedMessages;
  const shouldIgnoreMute = getShouldIgnoreNotificationMute(message, shouldNotifyAboutPinnedMessages);

  const isPinMessage = message.content?.action?.type === 'pinMessage';
  const shouldSkipPinnedMessageNotification = isPinMessage && !shouldNotifyAboutPinnedMessages;
  const shouldNotifyAboutMessage = message.content?.action?.type !== 'phoneCall';
  if (shouldSkipPinnedMessageNotification || (isMuted && !shouldIgnoreMute) || !shouldNotifyAboutMessage
    || chat.isNotJoined || !chat.isListed || selectIsChatWithSelf(global, chat.id)) {
    return false;
  }
  // Hidden or unfocused desktop windows are checked asynchronously before showing a toast
  if (IS_TAURI) return true;
  // On touch devices show notifications when chat is not active
  if (IS_TOUCH_ENV) {
    const {
      chatId,
      type,
    } = selectCurrentMessageList(global) || {};
    return !(chatId === chat.id && type === 'thread');
  }
  // On desktop show notifications when window is not focused
  return !document.hasFocus();
}

function getNotificationContent(chat: ApiChat, message: ApiMessage, reaction?: ApiPeerReaction) {
  const global = getGlobal();
  let sender = selectSender(global, message);
  const hasReaction = Boolean(reaction);
  if (hasReaction) {
    sender = selectPeer(global, reaction.peerId);
  }

  const { isScreenLocked } = global.passcode;
  const isSelf = chat.id === global.currentUserId;

  let body: string;
  if (
    !isScreenLocked
    && getShouldShowMessagePreview(chat, selectNotifyDefaults(global), getChatNotifyException(global, chat))
  ) {
    const senderName = sender ? getMessageSenderName(getTranslationFn(), chat.id, sender) : undefined;
    let summary = jsxToHtml(<span><MessageSummary message={message} /></span>)[0].textContent || '';

    if (hasReaction) {
      const emoji = getReactionEmoji(reaction);
      summary = oldTranslate('PushReactText', [emoji, summary]);
    }

    body = senderName ? `${senderName}: ${summary}` : summary;
  } else {
    body = getTranslationFn()('NotificationMessageTextHidden');
  }

  let title = isScreenLocked ? APP_NAME : getChatTitle(oldTranslate, chat, isSelf);

  if (message.isSilent) {
    title += ' 🔕';
  }

  return { title, body };
}

async function getAvatar(chat: ApiPeer) {
  const imageHash = getChatAvatarHash(chat);
  if (!imageHash) return undefined;
  let mediaData = mediaLoader.getFromMemory(imageHash);
  if (!mediaData) {
    await mediaLoader.fetch(imageHash, ApiMediaFormat.BlobUrl);
    mediaData = mediaLoader.getFromMemory(imageHash);
  }
  return mediaData;
}

function getReactionEmoji(reaction: ApiPeerReaction) {
  let emoji;
  if (reaction.reaction.type === 'emoji') {
    emoji = reaction.reaction.emoticon;
  }

  if (reaction.reaction.type === 'custom') {
    emoji = selectCustomEmoji(getGlobal(), reaction.reaction.documentId)?.emoji;
  }
  return emoji || '❤️';
}

async function isDesktopAppActive() {
  if (!IS_TAURI) return document.hasFocus();
  try {
    return await window.tauri.isAppWindowActive();
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Unable to read desktop window state', err);
    }
    return document.hasFocus();
  }
}

async function mediaUrlToDataUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : undefined);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Unable to encode notification avatar', err);
    }
    return undefined;
  }
}

function getDesktopToastTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
}

async function showNativeDesktopNotification({
  title,
  body,
  chatId,
  messageId,
  isCall,
  shouldPlaySound,
  soundId,
  avatarUrl,
}: {
  title: string;
  body: string;
  chatId?: string;
  messageId?: number;
  isCall?: boolean;
  shouldPlaySound?: boolean;
  soundId?: string;
  avatarUrl?: string;
}) {
  const theme = getDesktopToastTheme();
  const avatarDataUrl = await mediaUrlToDataUrl(avatarUrl);

  try {
    await window.tauri.showDesktopNotification({
      title,
      body,
      chatId,
      messageId,
      isCall,
      theme,
      avatarDataUrl,
    });
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Unable to show desktop notification', err);
    }
  }

  if (shouldPlaySound) {
    playNotifySoundDebounced(soundId);
  }
}

export async function notifyAboutCall({
  call, user,
}: {
  call: ApiPhoneCall; user: ApiUser;
}) {
  const { hasWebNotifications } = selectSettingsKeys(getGlobal());
  if (!hasWebNotifications) return;
  if (await isDesktopAppActive()) return;
  const areNotificationsSupported = checkIfNotificationsSupported();
  if (!areNotificationsSupported) return;

  const title = oldTranslate('VoipIncoming');
  const body = getUserFullName(user) || '';

  if (IS_TAURI) {
    await showNativeDesktopNotification({
      title,
      body,
      isCall: true,
      shouldPlaySound: true,
      soundId: `call_${call.id}`,
      avatarUrl: await getAvatar(user),
    });
    return;
  }

  const icon = await getAvatar(user);

  const options: NotificationOptions = {
    body,
    icon,
    badge: icon,
    tag: `call_${call.id}`,
  };

  if ('vibrate' in navigator) {
    // @ts-ignore
    options.vibrate = [200, 100, 200];
  }

  const notification = new Notification(title, options);

  notification.onclick = () => {
    notification.close();
    if (window.focus) {
      window.focus();
    }
  };
}

export async function notifyAboutMessage({
  chat,
  message,
  isReaction = false,
}: { chat: ApiChat; message: Partial<ApiMessage>; isReaction?: boolean }) {
  const global = getGlobal();
  const { hasWebNotifications } = selectSettingsKeys(global);
  if (!checkIfShouldNotify(chat, message)) return;
  const isChatSilent = getIsChatSilent(
    chat, selectNotifyDefaults(global), getChatNotifyException(global, chat),
  );
  const topic = selectTopicFromMessage(global, message as ApiMessage);
  const isSilent = topic?.notifySettings.hasSound === undefined ? isChatSilent : !topic.notifySettings.hasSound;

  const areNotificationsSupported = checkIfNotificationsSupported();
  const shouldPlaySound = !isSilent && !message.isSilent && !isReaction;
  if (!hasWebNotifications || !areNotificationsSupported) {
    if (shouldPlaySound) {
      playNotifySoundDebounced(String(message.id) || chat.id);
    }

    return;
  }

  if (!message.id) return;
  if (IS_TAURI && await isDesktopAppActive()) return;

  const activeReaction = getMessageRecentReaction(message);
  // Do not notify about reactions on messages that are not outgoing
  if (isReaction && !activeReaction) return;

  // If this is a custom emoji reaction we need to make sure it is loaded
  if (isReaction && activeReaction && activeReaction.reaction.type === 'custom') {
    await loadCustomEmoji(activeReaction.reaction.documentId);
  }

  const {
    title,
    body,
  } = getNotificationContent(chat, message as ApiMessage, activeReaction);

  if (checkIfPushSupported()) {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'showMessageNotification',
        payload: {
          title,
          body,
          icon: await getAvatar(chat),
          chatId: chat.id,
          messageId: message.id,
          shouldReplaceHistory: true,
          isSilent: isSilent || message.isSilent,
          reaction: activeReaction?.reaction,
        },
      });
    }
  } else if (IS_TAURI) {
    await showNativeDesktopNotification({
      title,
      body,
      chatId: chat.id,
      messageId: message.id,
      shouldPlaySound,
      soundId: String(message.id) || chat.id,
      avatarUrl: await getAvatar(chat),
    });
  } else {
    const dispatch = getActions();
    const icon = await getAvatar(chat);
    const options: NotificationOptions = {
      body,
      icon,
      badge: icon,
      tag: String(message.id),
    };

    if ('vibrate' in navigator) {
      // @ts-ignore
      options.vibrate = [200, 100, 200];
    }

    const notification = new Notification(title, options);

    notification.onclick = () => {
      notification.close();
      dispatch.focusMessage({
        chatId: chat.id,
        messageId: message.id!,
        shouldReplaceHistory: true,
      });
      if (window.focus) {
        window.focus();
      }
    };

    notification.onshow = () => {
      if (!shouldPlaySound) return;
      playNotifySoundDebounced(String(message.id) || chat.id);
    };
  }
}

export function closeMessageNotifications(payload: { chatId: string; lastReadInboxMessageId?: number }) {
  if (IS_TEST || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'closeMessageNotifications',
    payload,
  });
}

function getChatNotifyException(global: GlobalState, chat: ApiChat) {
  const chatNotifyException = selectNotifyException(global, chat.id);
  const communityNotifyException = chat.linkedCommunityId
    ? selectNotifyException(global, chat.linkedCommunityId)
    : undefined;

  return mergeNotifySettings(communityNotifyException, chatNotifyException);
}

// Notify service worker that client is fully loaded
export function notifyClientReady() {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'clientReady',
  });
}
