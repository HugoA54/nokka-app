import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MacroBarProps {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

export function MacroBar({ label, current, goal, color, unit = 'g' }: MacroBarProps) {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const isOver = current > goal;
  const remaining = goal - current;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={[styles.values, isOver && styles.overValues]}>
          {current.toFixed(0)}
          <Text style={styles.separator}>/</Text>
          {goal.toFixed(0)}{unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%` as any,
              backgroundColor: isOver ? '#f06060' : color,
            },
          ]}
        />
      </View>
      <Text style={[styles.remaining, isOver && styles.overRemaining]}>
        {isOver
          ? `+${Math.abs(remaining).toFixed(0)}${unit} over`
          : `${remaining.toFixed(0)}${unit} remaining`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '600',
  },
  values: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '500',
  },
  overValues: {
    color: '#f06060',
  },
  separator: {
    color: '#3a3a4a',
    marginHorizontal: 2,
  },
  track: {
    height: 6,
    backgroundColor: '#2a2a35',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  remaining: {
    color: '#7a7a90',
    fontSize: 11,
    fontWeight: '400',
  },
  overRemaining: {
    color: '#f06060',
  },
});
