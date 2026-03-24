import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const CHANNEL_ID = 'creatine_reminder';
const STORAGE_KEY_PREFIX = 'nokka_creatine_';
const NOTIF_ID = 'creatine-hourly';

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

  // Don't schedule if already taken today
  const taken = await hasCreatineToday();
  if (taken) return;

  // Cancel existing before rescheduling
  await cancelCreatineReminders();

  // Schedule a repeating notification every hour
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_ID,
    content: {
      title: '💊 Créatine !',
      body: "Tu n'as pas encore pris ta créatine aujourd'hui !",
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3600,
      repeats: true,
    },
  });
}

export async function cancelCreatineReminders(): Promise<void> {
  if (isExpoGo) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID);
  } catch {}
}

/** Call on app start to check daily reset and reschedule if needed */
export async function initCreatineReminder(): Promise<void> {
  await setupCreatineChannel();
  const taken = await hasCreatineToday();
  if (taken) {
    await cancelCreatineReminders();
  } else {
    await scheduleCreatineReminders();
  }
}
