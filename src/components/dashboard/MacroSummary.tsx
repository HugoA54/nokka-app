import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MacroBar } from '@components/ui/MacroBar';
import type { AIMacroTotals, AIMacroGoals } from '@types/index';

interface MacroSummaryProps {
  totals: AIMacroTotals;
  goals: AIMacroGoals;
  onEditGoals?: () => void;
  title?: string;
}

export function MacroSummary({ totals, goals, onEditGoals, title = "Today's Macros" }: MacroSummaryProps) {
  const calPercent = goals.calories > 0
    ? Math.min(Math.round((totals.calories / goals.calories) * 100), 100)
    : 0;
  const isOver = totals.calories > goals.calories;
  const remaining = goals.calories - totals.calories;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onEditGoals && (
          <TouchableOpacity onPress={onEditGoals} style={styles.editBtn}>
            <Ionicons name="settings-outline" size={16} color="#7a7a90" />
            <Text style={styles.editBtnText}>Goals</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Calorie ring summary */}
      <LinearGradient
        colors={['#16161c', '#1a1a22']}
        style={styles.calCard}
      >
        <View style={styles.calRow}>
          <View>
            <Text style={styles.calValue}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calLabel}>kcal consumed</Text>
          </View>
          <View style={styles.calDivider} />
          <View style={styles.calRight}>
            <Text style={[styles.calRemaining, isOver && styles.calOver]}>
              {isOver ? '+' : ''}{Math.abs(remaining).toFixed(0)}
            </Text>
            <Text style={styles.calLabel}>{isOver ? 'over goal' : 'remaining'}</Text>
          </View>
        </View>

        {/* Overall progress bar */}
        <View style={styles.calTrack}>
          <View
            style={[
              styles.calFill,
              {
                width: `${calPercent}%` as any,
                backgroundColor: isOver ? '#f06060' : '#c8f060',
              },
            ]}
          />
        </View>
        <Text style={styles.calGoal}>Goal: {goals.calories} kcal ({calPercent}%)</Text>
      </LinearGradient>

      {/* Macro bars */}
      <View style={styles.barsContainer}>
        <MacroBar
          label="Protein"
          current={totals.proteines}
          goal={goals.proteines}
          color="#60d4f0"
          unit="g"
        />
        <MacroBar
          label="Carbs"
          current={totals.glucides}
          goal={goals.glucides}
          color="#f0c060"
          unit="g"
        />
        <MacroBar
          label="Fats"
          current={totals.lipides}
          goal={goals.lipides}
          color="#f060a8"
          unit="g"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '700',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2a2a35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: {
    color: '#7a7a90',
    fontSize: 13,
    fontWeight: '600',
  },
  calCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 12,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  calValue: {
    color: '#f0f0f0',
    fontSize: 32,
    fontWeight: '800',
  },
  calLabel: {
    color: '#7a7a90',
    fontSize: 12,
    marginTop: 2,
  },
  calDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2a2a35',
  },
  calRight: {
    flex: 1,
  },
  calRemaining: {
    color: '#c8f060',
    fontSize: 24,
    fontWeight: '700',
  },
  calOver: {
    color: '#f06060',
  },
  calTrack: {
    height: 8,
    backgroundColor: '#2a2a35',
    borderRadius: 4,
    overflow: 'hidden',
  },
  calFill: {
    height: '100%',
    borderRadius: 4,
  },
  calGoal: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '500',
  },
  barsContainer: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 14,
  },
});
