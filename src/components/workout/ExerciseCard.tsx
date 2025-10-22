import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Exercise } from '@types/index';

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#60d4f0',
  back: '#c8f060',
  shoulders: '#f0c060',
  biceps: '#f060a8',
  triceps: '#f060a8',
  legs: '#a060f0',
  glutes: '#a060f0',
  core: '#f06060',
  cardio: '#60f090',
  full_body: '#f0f0f0',
};

interface ExerciseCardProps {
  exercise: Exercise;
  onPress?: () => void;
  onAddSet?: () => void;
  showActions?: boolean;
  setCount?: number;
  lastPerformance?: { weight: number; repetitions: number } | null;
}

export function ExerciseCard({
  exercise,
  onPress,
  onAddSet,
  showActions = false,
  setCount = 0,
  lastPerformance = null,
}: ExerciseCardProps) {
  const color = MUSCLE_COLORS[exercise.muscle_group] ?? '#7a7a90';
  const muscleLabel = exercise.muscle_group.replace('_', ' ');

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {/* Left accent bar */}
      <View style={[styles.accent, { backgroundColor: color }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.name}>{exercise.name}</Text>
          {exercise.is_bodyweight && (
            <View style={styles.bwBadge}>
              <Text style={styles.bwText}>BW</Text>
            </View>
          )}
        </View>

        <View style={styles.meta}>
          <View style={[styles.muscleBadge, { borderColor: color }]}>
            <Text style={[styles.muscleText, { color }]}>{muscleLabel}</Text>
          </View>
          {setCount > 0 && (
            <Text style={styles.setCount}>{setCount} sets today</Text>
          )}
        </View>

        {lastPerformance && (
          <Text style={styles.lastPerf}>
            Last: {lastPerformance.weight}kg × {lastPerformance.repetitions}
          </Text>
        )}
      </View>

      {showActions && onAddSet && (
        <TouchableOpacity style={styles.addBtn} onPress={onAddSet}>
          <Ionicons name="add" size={20} color="#0f0f12" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a35',
    overflow: 'hidden',
  },
  accent: {
    width: 4,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
  },
  bwBadge: {
    backgroundColor: '#2a2a35',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bwText: {
    color: '#7a7a90',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muscleBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  muscleText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  setCount: {
    color: '#7a7a90',
    fontSize: 12,
  },
  lastPerf: {
    color: '#7a7a90',
    fontSize: 12,
  },
  addBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c8f060',
    margin: 10,
    borderRadius: 10,
  },
});
