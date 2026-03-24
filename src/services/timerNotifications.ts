import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const CHANNEL_ID = 'rest_timer';

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
