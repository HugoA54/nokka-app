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

// All possible notification IDs we might schedule
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

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
  // Cancel current DAILY triggers then immediately reschedule them so they
  // come back tomorrow — without this they'd be gone permanently.
  await scheduleCreatineReminders();
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
  // Cancel all possible IDs
  try { await Notifications.cancelScheduledNotificationAsync(`${NOTIF_PREFIX}fixed`); } catch {}
  for (const hour of ALL_HOURS) {
    try { await Notifications.cancelScheduledNotificationAsync(`${NOTIF_PREFIX}${hour}`); } catch {}
  }
}

/** Call on app start + settings change to ensure DAILY triggers are active */
export async function initCreatineReminder(): Promise<void> {
  await setupCreatineChannel();
  const settings = await getCreatineSettings();
  if (!settings.enabled) {
    await cancelCreatineReminders();
    return;
  }
  // Always (re)schedule DAILY triggers — they survive without app launch.
  // If already taken today the UI hides the card; notifications may still
  // appear today but will be ignored by the user (acceptable trade-off).
  await scheduleCreatineReminders();
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
