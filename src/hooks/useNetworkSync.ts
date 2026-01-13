import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useWorkoutStore } from '@store/workoutStore';
import { useAuthStore } from '@store/authStore';

export function useNetworkSync() {
  const { setOnline, pendingCount, flushOfflineQueue } = useWorkoutStore();
  const user = useAuthStore((s) => s.user);
  const wasOffline = useRef(false);
  const isFlushing = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? true;
      setOnline(online);

      if (online && wasOffline.current && pendingCount > 0 && user && !isFlushing.current) {
        isFlushing.current = true;
        flushOfflineQueue(user.id).finally(() => {
          isFlushing.current = false;
        });
      }
      wasOffline.current = !online;
    });

    return () => unsubscribe();
  }, [pendingCount, user?.id]);
}
