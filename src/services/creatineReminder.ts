import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';

const CHANNEL_ID = 'creatine_reminder';
const STORAGE_KEY_PREFIX = 'nokka_creatine_';
const NOTIF_PREFIX = 'creatine-h-';
const SETTINGS_KEY = 'nokka_creatine_settings';

export type CreatineMode = 'fixed' | 'interval';

export interface CreatineSettings {
  enabled: boolean;
  mode: CreatineMode;
  fixedHour: number;       // 0-23, used when mode === 'fixed'
  intervalHours: number;   // 1,2,3,4… used when mode === 'interval'
}

const DEFAULT_SETTINGS: CreatineSettings = {
  enabled: true,
  mode: 'interval',
  fixedHour: 9,
  intervalHours: 1,
};

const isExpoGo = Constants.appOwnership === 'expo';

function todayKey(): string {
  return STORAGE_KEY_PREFIX + new Date().toLocaleDateString('en-CA');
}

export async function getCreatineSettings(): Promise<CreatineSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveCreatineSettings(settings: CreatineSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (settings.enabled) {
    await scheduleCreatineReminders();
  } else {
    await cancelCreatineReminders();
  }
}

export async function setupCreatineChannel() {
  if (isExpoGo) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappel Créatine',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 100, 250],
      lightColor: '#60d4f0',
    });
  }
}

export async function hasCreatineToday(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(todayKey());
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markCreatineTaken(): Promise<void> {
  await AsyncStorage.setItem(todayKey(), 'true');
  // Cancel all scheduled notifications for today.
  // initCreatineReminder (called on next app foreground / new day) will reschedule them.
  // Fire-and-forget: cancellation can be slow on Android (multiple native calls);
  // we don't want to block the UI on it. AsyncStorage flag above is the source of truth.
  cancelCreatineReminders().catch(() => {});
}

export async function scheduleCreatineReminders(): Promise<void> {
  if (isExpoGo) return;

  const settings = await getCreatineSettings();
  if (!settings.enabled) return;

  await cancelCreatineReminders();

  // Build list of hours to notify
  const hours: number[] = [];
  if (settings.mode === 'fixed') {
    hours.push(settings.fixedHour);
  } else {
    const interval = settings.intervalHours;
    for (let h = 7; h <= 22; h += interval) {
      hours.push(h);
    }
  }

  // Use DAILY repeating triggers — fire every day at each hour regardless of app launch
  for (const hour of hours) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIF_PREFIX}${hour}`,
      content: {
        title: '💊 Créatine !',
        body: "Tu n'as pas encore pris ta créatine aujourd'hui !",
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
  }
}

export async function cancelCreatineReminders(): Promise<void> {
  if (isExpoGo) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const ids = all
      .map((n) => n.identifier)
      .filter((id): id is string => !!id && id.startsWith(NOTIF_PREFIX));
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
  } catch {}
}

/** Call on app start + settings change to ensure DAILY triggers are active */
export async function initCreatineReminder(): Promise<void> {
  await setupCreatineChannel();
  const settings = await getCreatineSettings();
  if (!settings.enabled) {
    await cancelCreatineReminders();
    return;
  }
  // Don't reschedule if already taken today — notifications were cancelled on markCreatineTaken.
  // They'll be rescheduled tomorrow when todayKey() changes.
  const taken = await hasCreatineToday();
  if (!taken) {
    await scheduleCreatineReminders();
  }
}

/** Listen for app becoming active to reschedule (handles new day) */
export function startCreatineAppStateListener(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      initCreatineReminder();
    }
  });
  return () => sub.remove();
}
