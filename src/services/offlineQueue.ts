import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutSet, Session } from '@types/index';

const QUEUE_KEY = 'nokka_offline_queue';

export type QueuedOp =
  | { type: 'addSet'; payload: Omit<WorkoutSet, 'id' | 'created_at'>; tempId: string }
  | { type: 'deleteSet'; payload: { setId: string } }
  | { type: 'updateSession'; payload: { sessionId: string; patch: Partial<Session> } };

export async function enqueue(op: QueuedOp): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueuedOp[] = raw ? JSON.parse(raw) : [];
  queue.push(op);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function dequeueAll(): Promise<QueuedOp[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function getQueueLength(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  try {
    return (JSON.parse(raw) as QueuedOp[]).length;
  } catch {
    return 0;
  }
}
