import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const CHANNEL_ID = 'rest_timer';
const ONGOING_ID = 'rest_timer_ongoing';
const DONE_ID = 'rest_timer_done';

// Notifications not supported in Expo Go (SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

export async function setupTimerNotificationChannel() {
  if (isExpoGo) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rest Timer',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 100, 300],
      lightColor: '#c8f060',
    });
  }
}

export async function requestTimerPermissions(): Promise<boolean> {
  if (isExpoGo) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function showRestTimerNotification(durationSeconds: number): Promise<void> {
  if (isExpoGo) return;
  await cancelRestTimerNotifications();

  const endDate = new Date(Date.now() + durationSeconds * 1000);
  const endStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Sticky notification — static end time, always accurate in background
  await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_ID,
    content: {
      title: '⏱ Rest Timer',
      body: `Ends at ${endStr}`,
      sticky: true,
      data: { type: ONGOING_ID, endTimeMs: endDate.getTime() },
    },
    trigger: null,
  });

  // Completion notification — DATE trigger is more reliable on Android in background
  await Notifications.scheduleNotificationAsync({
    identifier: DONE_ID,
    content: {
      title: '💪 Rest terminé !',
      body: 'Retourne au boulot 🔥',
      data: { type: DONE_ID },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endDate,
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    } as any,
  });
}

export async function updateRestTimerNotification(secondsLeft: number, endTimeMs: number): Promise<void> {
  if (isExpoGo) return;
  const endStr = new Date(endTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_ID,
    content: {
      title: secondsLeft <= 10 ? '⚠️ Rest Timer' : '⏱ Rest Timer',
      body: secondsLeft > 0 ? `${formatTime(secondsLeft)} — ends at ${endStr}` : 'Rest done! 💪',
      sticky: true,
      data: { type: ONGOING_ID, endTimeMs },
    },
    trigger: null,
  });
}

// Called when timer completes in foreground — only dismiss ongoing, let DONE fire
export async function dismissOngoingTimerNotification(): Promise<void> {
  if (isExpoGo) return;
  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(ONGOING_ID),
    Notifications.dismissNotificationAsync(ONGOING_ID),
  ]);
}

// Called when user manually cancels timer, or before starting a new one
export async function cancelRestTimerNotifications(): Promise<void> {
  if (isExpoGo) return;
  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(ONGOING_ID),
    Notifications.cancelScheduledNotificationAsync(DONE_ID),
    Notifications.dismissNotificationAsync(ONGOING_ID),
    Notifications.dismissNotificationAsync(DONE_ID),
  ]);
}
