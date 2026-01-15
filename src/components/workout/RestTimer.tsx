import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import { useWorkoutStore } from '@store/workoutStore';
import { dismissOngoingTimerNotification, cancelRestTimerNotifications } from '@services/timerNotifications';

function launchNativeTimer(seconds: number) {
  IntentLauncher.startActivityAsync('android.intent.action.SET_TIMER', {
    extra: {
      'android.intent.extra.alarm.LENGTH': seconds,
      'android.intent.extra.alarm.SKIP_UI': true,
      'android.intent.extra.alarm.MESSAGE': 'Repos Nokka',
    },
  }).catch(() => {});
}

export function RestTimer() {
  const { restEndTime, isRestTimerActive, clearRestTimer, startRestTimer, restDuration } =
    useWorkoutStore();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRestTimerActive || !restEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        dismissOngoingTimerNotification().catch(() => {});
        clearInterval(interval);
        clearRestTimer();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [restEndTime, isRestTimerActive]);

  if (!isRestTimerActive) return null;

  const totalSecs = restDuration;
  const progress = totalSecs > 0 ? Math.max(0, secondsLeft / totalSecs) : 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isLow = secondsLeft <= 10 && secondsLeft > 0;
  const isDone = secondsLeft === 0;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.row}>
        <Ionicons name="timer" size={18} color={isDone ? '#60f090' : isLow ? '#f0c060' : '#c8f060'} />
        <Text style={[styles.timeText, isLow && styles.timeLow, isDone && styles.timeDone]}>
          {isDone ? 'Rest done! 💪' : `${mins}:${String(secs).padStart(2, '0')}`}
        </Text>
        {Platform.OS === 'android' && (
          <TouchableOpacity
            onPress={() => launchNativeTimer(secondsLeft > 0 ? secondsLeft : restDuration)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.nativeBtn}
          >
            <Ionicons name="phone-portrait-outline" size={16} color="#7a7a90" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={clearRestTimer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color="#7a7a90" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%` as any,
              backgroundColor: isDone ? '#60f090' : isLow ? '#f0c060' : '#c8f060',
            },
          ]}
        />
      </View>

      {/* Quick restart buttons */}
      <View style={styles.buttons}>
        {[60, 90, 120, 180].map((d) => (
          <TouchableOpacity
            key={d}
            style={styles.quickBtn}
            onPress={() => {
              startRestTimer(d);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.quickBtnText}>
              {d < 60 ? `${d}s` : `${d / 60}m`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    flex: 1,
    color: '#c8f060',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeLow: {
    color: '#f0c060',
  },
  timeDone: {
    color: '#60f090',
  },
  track: {
    height: 5,
    backgroundColor: '#2a2a35',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  buttons: {
    flexDirection: 'row',
    gap: 6,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#2a2a35',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  quickBtnText: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '600',
  },
  nativeBtn: {
    marginRight: 4,
  },
});
