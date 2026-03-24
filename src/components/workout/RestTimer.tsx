import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '@store/workoutStore';

// Vibration pattern: wait 0ms, vibrate 500ms, pause 300ms, vibrate 500ms (repeats)
const VIBRATION_PATTERN = [0, 500, 300, 500];

export function RestTimer() {
  const { restEndTime, isRestTimerActive, clearRestTimer, startRestTimer, restDuration } =
    useWorkoutStore();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const hasEnteredOvertime = useRef(false);

  const handleStop = () => {
    Vibration.cancel();
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    hasEnteredOvertime.current = false;
    clearRestTimer();
  };

  useEffect(() => {
    if (!isRestTimerActive || !restEndTime) return;

    hasEnteredOvertime.current = false;

    const interval = setInterval(() => {
      const remaining = Math.ceil((restEndTime - Date.now()) / 1000);
      setSecondsLeft(remaining);

      // Crossed into overtime
      if (remaining <= 0 && !hasEnteredOvertime.current) {
        hasEnteredOvertime.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate(VIBRATION_PATTERN, true);

        // Start looping pulse animation
        pulseLoop.current = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          ])
        );
        pulseLoop.current.start();
      }
    }, 250);

    return () => {
      clearInterval(interval);
      Vibration.cancel();
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    };
  }, [restEndTime, isRestTimerActive]);

  if (!isRestTimerActive) return null;

  const isOvertime = secondsLeft <= 0;
  const displaySecs = Math.abs(secondsLeft);
  const mins = Math.floor(displaySecs / 60);
  const secs = displaySecs % 60;
  const timeStr = `${isOvertime ? '+' : ''}${mins}:${String(secs).padStart(2, '0')}`;

  const isLow = secondsLeft <= 10 && secondsLeft > 0;
  const accentColor = isOvertime ? '#f06060' : isLow ? '#f0c060' : '#c8f060';

  const progress = isOvertime ? 0 : restDuration > 0 ? secondsLeft / restDuration : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        isOvertime && styles.containerOvertime,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <View style={styles.row}>
        <Ionicons name="timer" size={18} color={accentColor} />
        <Text style={[styles.timeText, { color: accentColor }]}>{timeStr}</Text>
        {isOvertime ? (
          <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleStop} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="#7a7a90" />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%` as any, backgroundColor: accentColor },
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
              Vibration.cancel();
              pulseLoop.current?.stop();
              pulseAnim.setValue(1);
              hasEnteredOvertime.current = false;
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
  containerOvertime: {
    borderColor: 'rgba(240,96,96,0.4)',
    backgroundColor: '#1c1414',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stopBtn: {
    backgroundColor: '#f06060',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
});
