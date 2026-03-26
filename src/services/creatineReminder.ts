import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';

const CHANNEL_ID = 'creatine_reminder';
const STORAGE_KEY_PREFIX = 'nokka_creatine_';
const NOTIF_PREFIX = 'creatine-h-';

// Hours at which to send reminders (8h → 22h, every hour)
const REMINDER_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const isExpoGo = Constants.appOwnership === 'expo';

function todayKey(): string {
  return STORAGE_KEY_PREFIX + new Date().toLocaleDateString('en-CA');
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
  await cancelCreatineReminders();
}

export async function scheduleCreatineReminders(): Promise<void> {
  if (isExpoGo) return;

  const taken = await hasCreatineToday();
  if (taken) return;

  await cancelCreatineReminders();

  const now = new Date();
  const currentHour = now.getHours();

  for (const hour of REMINDER_HOURS) {
    // Skip hours that have already passed today
    if (hour <= currentHour) continue;

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
  for (const hour of REMINDER_HOURS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`${NOTIF_PREFIX}${hour}`);
    } catch {}
  }
}

/** Call on app start + app resume to check daily reset and reschedule */
export async function initCreatineReminder(): Promise<void> {
  await setupCreatineChannel();
  const taken = await hasCreatineToday();
  if (taken) {
    await cancelCreatineReminders();
  } else {
    await scheduleCreatineReminders();
  }
}

/** Listen for app becoming active to reschedule (handles new day while app was in background) */
export function startCreatineAppStateListener(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      initCreatineReminder();
    }
  });
  return () => sub.remove();
}
