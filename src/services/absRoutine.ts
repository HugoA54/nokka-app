import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import type { AbsLevel, AbsRoutine } from '@types/index';

const CHANNEL_ID = 'abs_routine';
const SETTINGS_KEY = 'nokka_abs_settings';
const HISTORY_KEY = 'nokka_abs_history';
const NOTIF_ID = 'abs-routine-reminder';

export interface AbsRoutineSettings {
  enabled: boolean;
  level: AbsLevel;
  reminderHour: number;
}

const DEFAULT_SETTINGS: AbsRoutineSettings = {
  enabled: false,
  level: 'beginner',
  reminderHour: 19,
};

const isExpoGo = Constants.appOwnership === 'expo';

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

// ── Routine definitions (one fixed routine per level) ────────────────────────

export const ABS_ROUTINES: Record<AbsLevel, AbsRoutine> = {
  beginner: {
    level: 'beginner',
    exercises: [
      { id: 'crunch', nameKey: 'abs.exercise.crunch', type: 'reps', sets: 3, value: 12 },
      { id: 'plank', nameKey: 'abs.exercise.plank', type: 'time', sets: 3, value: 30 },
      { id: 'bicycle', nameKey: 'abs.exercise.bicycle', type: 'reps', sets: 3, value: 20, perSide: true },
      { id: 'leg_raise_bent', nameKey: 'abs.exercise.leg_raise_bent', type: 'reps', sets: 3, value: 10 },
    ],
  },
  intermediate: {
    level: 'intermediate',
    exercises: [
      { id: 'crunch', nameKey: 'abs.exercise.crunch', type: 'reps', sets: 3, value: 20 },
      { id: 'plank', nameKey: 'abs.exercise.plank', type: 'time', sets: 3, value: 45 },
      { id: 'bicycle', nameKey: 'abs.exercise.bicycle', type: 'reps', sets: 3, value: 30, perSide: true },
      { id: 'russian_twist', nameKey: 'abs.exercise.russian_twist', type: 'reps', sets: 3, value: 30, perSide: true },
      { id: 'leg_raise', nameKey: 'abs.exercise.leg_raise', type: 'reps', sets: 3, value: 12 },
      { id: 'mountain_climber', nameKey: 'abs.exercise.mountain_climber', type: 'time', sets: 3, value: 30 },
    ],
  },
  advanced: {
    level: 'advanced',
    exercises: [
      { id: 'hanging_leg_raise', nameKey: 'abs.exercise.hanging_leg_raise', type: 'reps', sets: 3, value: 10 },
      { id: 'plank', nameKey: 'abs.exercise.plank', type: 'time', sets: 3, value: 60 },
      { id: 'v_up', nameKey: 'abs.exercise.v_up', type: 'reps', sets: 3, value: 15 },
      { id: 'russian_twist_weighted', nameKey: 'abs.exercise.russian_twist_weighted', type: 'reps', sets: 3, value: 40, perSide: true },
      { id: 'bicycle', nameKey: 'abs.exercise.bicycle', type: 'reps', sets: 3, value: 40 },
      { id: 'side_plank', nameKey: 'abs.exercise.side_plank', type: 'time', sets: 2, value: 45, perSide: true },
      { id: 'mountain_climber', nameKey: 'abs.exercise.mountain_climber', type: 'time', sets: 3, value: 45 },
    ],
  },
};

export function getAbsRoutine(level: AbsLevel): AbsRoutine {
  return ABS_ROUTINES[level];
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getAbsSettings(): Promise<AbsRoutineSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveAbsSettings(settings: AbsRoutineSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (settings.enabled) {
    await scheduleAbsReminder();
  } else {
    await cancelAbsReminder();
  }
}

// ── History / streak ─────────────────────────────────────────────────────────

async function getHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function saveHistory(history: string[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export async function hasAbsRoutineToday(): Promise<boolean> {
  const history = await getHistory();
  return history.includes(todayStr());
}

export async function markAbsRoutineDone(): Promise<void> {
  const history = await getHistory();
  const today = todayStr();
  if (!history.includes(today)) {
    history.push(today);
    await saveHistory(history);
  }
  // Cancel today's notification (will reschedule daily for tomorrow on next foreground)
  cancelAbsReminder().catch(() => {});
}

export async function unmarkAbsRoutineToday(): Promise<void> {
  const history = await getHistory();
  const today = todayStr();
  const filtered = history.filter((d) => d !== today);
  await saveHistory(filtered);
  await scheduleAbsReminder();
}

/** Number of consecutive days up to today (inclusive) where routine was done.
 *  Resets to 0 if today is not done AND yesterday is not done either (grace until end of today). */
export async function getAbsStreak(): Promise<number> {
  const history = await getHistory();
  if (history.length === 0) return 0;
  const set = new Set(history);
  // Walk backward from today; if today missing, start from yesterday (grace period).
  const cursor = new Date();
  if (!set.has(cursor.toLocaleDateString('en-CA'))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (set.has(cursor.toLocaleDateString('en-CA'))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getAbsTotal(): Promise<number> {
  const history = await getHistory();
  return history.length;
}

// ── Notifications ────────────────────────────────────────────────────────────

export async function setupAbsChannel(): Promise<void> {
  if (isExpoGo) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Routine Abdos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 100, 250],
      lightColor: '#f060a8',
    });
  }
}

export async function scheduleAbsReminder(): Promise<void> {
  if (isExpoGo) return;
  const settings = await getAbsSettings();
  if (!settings.enabled) return;

  await cancelAbsReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_ID,
    content: {
      title: '🔥 Routine abdos',
      body: "C'est l'heure de ta routine abdos quotidienne !",
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.reminderHour,
      minute: 0,
    },
  });
}

export async function cancelAbsReminder(): Promise<void> {
  if (isExpoGo) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID);
  } catch {}
}

export async function initAbsRoutine(): Promise<void> {
  await setupAbsChannel();
  const settings = await getAbsSettings();
  if (!settings.enabled) {
    await cancelAbsReminder();
    return;
  }
  const done = await hasAbsRoutineToday();
  if (!done) {
    await scheduleAbsReminder();
  }
}

export function startAbsAppStateListener(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      initAbsRoutine();
    }
  });
  return () => sub.remove();
}
