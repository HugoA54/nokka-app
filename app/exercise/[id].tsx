import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useWorkoutStore } from '@store/workoutStore';

const { width: SCREEN_W } = Dimensions.get('window');

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#60d4f0', back: '#c8f060', shoulders: '#f0c060',
  biceps: '#f060a8', triceps: '#f060a8', legs: '#a060f0',
  glutes: '#a060f0', core: '#f06060', cardio: '#60f090', full_body: '#f0f0f0',
};

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { exercises, loadExercises, getPersonalRecord, getExerciseProgressionData, getLastPerformance } = useWorkoutStore();

  useEffect(() => {
    if (exercises.length === 0) loadExercises();
  }, []);

  const [metric, setMetric] = useState<'1rm' | 'weight' | 'volume'>('1rm');

  const exercise = exercises.find((e) => String(e.id) === String(id));
  const pr = exercise ? getPersonalRecord(exercise.id) : null;
  const progression = exercise ? getExerciseProgressionData(exercise.id) : [];
  const lastPerf = exercise ? getLastPerformance(exercise.id) : null;

  useEffect(() => {
    if (exercise) navigation.setOptions({ title: exercise.name });
  }, [exercise?.name]);

  if (!exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Exercise not found</Text>
      </View>
    );
  }

  const color = MUSCLE_COLORS[exercise.muscle_group] ?? '#7a7a90';
  const last20 = progression.slice(-20);
  const chartData = last20.map((p) => {
    if (metric === 'weight') return p.weight;
    if (metric === 'volume') return p.weight * p.repetitions;
    return p.estimated_1rm;
  });
  const chartLabels = last20.map((p) => {
    const d = new Date(p.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const metricTitle = metric === 'weight' ? 'Poids max' : metric === 'volume' ? 'Volume par série' : '1RM Progression';
  const metricUnit = metric === 'volume' ? 'kg×reps' : 'kg';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Exercise Header */}
      <View style={[styles.header, { borderColor: color }]}>
        <View style={styles.headerTop}>
          <Text style={styles.name}>{exercise.name}</Text>
          {exercise.is_bodyweight && (
            <View style={styles.bwBadge}>
              <Text style={styles.bwText}>Bodyweight</Text>
            </View>
          )}
        </View>
        <View style={[styles.muscleBadge, { borderColor: color }]}>
          <Text style={[styles.muscleText, { color }]}>
            {exercise.muscle_group.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {/* PR Card */}
      {pr && (
        <View style={styles.prCard}>
          <View style={styles.prHeader}>
            <Ionicons name="trophy" size={20} color="#f0c060" />
            <Text style={styles.prTitle}>Personal Record</Text>
          </View>
          <View style={styles.prStats}>
            <View style={styles.prStat}>
              <Text style={styles.prStatValue}>{pr.weight}</Text>
              <Text style={styles.prStatLabel}>kg lifted</Text>
            </View>
            <View style={styles.prDivider} />
            <View style={styles.prStat}>
              <Text style={styles.prStatValue}>{pr.repetitions}</Text>
              <Text style={styles.prStatLabel}>reps</Text>
            </View>
            <View style={styles.prDivider} />
            <View style={styles.prStat}>
              <Text style={[styles.prStatValue, { color: '#c8f060' }]}>{pr.estimated_1rm}</Text>
              <Text style={styles.prStatLabel}>est. 1RM (kg)</Text>
            </View>
          </View>
        </View>
      )}

      {/* Last Performance */}
      {lastPerf && (
        <View style={styles.lastCard}>
          <Ionicons name="time-outline" size={16} color="#7a7a90" />
          <Text style={styles.lastText}>
            Last workout: <Text style={{ color: '#f0f0f0', fontWeight: '700' }}>{lastPerf.weight}kg × {lastPerf.repetitions} reps</Text>
          </Text>
        </View>
      )}

      {/* Progression Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>{metricTitle}</Text>
        <View style={styles.metricRow}>
          {([
            { key: '1rm', label: 'Est. 1RM' },
            { key: 'weight', label: 'Poids max' },
            { key: 'volume', label: 'Volume' },
          ] as { key: typeof metric; label: string }[]).map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.metricPill, metric === m.key && { backgroundColor: '#c8f060' }]}
              onPress={() => setMetric(m.key)}
            >
              <Text style={[styles.metricPillText, metric === m.key && { color: '#0f0f12' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {chartData.length >= 2 ? (
          <LineChart
            data={{
              labels: chartLabels,
              datasets: [{ data: chartData, color: () => color, strokeWidth: 2 }],
            }}
            width={SCREEN_W - 40}
            height={200}
            chartConfig={{
              backgroundColor: '#16161c',
              backgroundGradientFrom: '#16161c',
              backgroundGradientTo: '#16161c',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(200, 240, 96, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(122, 122, 144, ${opacity})`,
              style: { borderRadius: 12 },
              propsForDots: { r: '4', strokeWidth: '2', stroke: color },
            }}
            bezier
            style={{ borderRadius: 12 }}
            yAxisSuffix={` ${metricUnit}`}
          />
        ) : (
          <View style={styles.noChart}>
            <Text style={styles.noChartText}>
              {progression.length === 0
                ? 'No sets logged for this exercise yet'
                : 'Need at least 2 data points to show chart'}
            </Text>
          </View>
        )}
      </View>

      {/* All Sets History */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>All Sets ({progression.length})</Text>
        {progression.length === 0 ? (
          <View style={styles.noHistory}>
            <Text style={styles.noHistoryText}>No sets logged yet for this exercise</Text>
          </View>
        ) : (
          [...progression].reverse().slice(0, 20).map((p, i) => (
            <View key={i} style={styles.historyRow}>
              <Text style={styles.historyDate}>{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              <Text style={styles.historyWeight}>{p.weight}kg</Text>
              <Text style={styles.historyReps}>× {p.repetitions}</Text>
              <Text style={[styles.history1RM, { color }]}>{p.estimated_1rm}kg 1RM</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#7a7a90', fontSize: 16 },
  header: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: '#f0f0f0', fontSize: 22, fontWeight: '800' },
  bwBadge: {
    backgroundColor: '#2a2a35', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  bwText: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
  muscleBadge: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  muscleText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  prCard: {
    backgroundColor: '#16161c', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f0c060', gap: 14,
  },
  prHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prTitle: { color: '#f0c060', fontSize: 16, fontWeight: '700' },
  prStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  prStat: { alignItems: 'center', gap: 4 },
  prStatValue: { color: '#f0f0f0', fontSize: 28, fontWeight: '800' },
  prStatLabel: { color: '#7a7a90', fontSize: 11 },
  prDivider: { width: 1, height: 40, backgroundColor: '#2a2a35' },
  lastCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#16161c', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  lastText: { color: '#7a7a90', fontSize: 14 },
  chartSection: { gap: 12 },
  sectionTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  metricRow: { flexDirection: 'row', gap: 8 },
  metricPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#16161c', borderWidth: 1, borderColor: '#2a2a35',
  },
  metricPillText: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
  noChart: {
    backgroundColor: '#16161c', borderRadius: 12, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a35',
  },
  noChartText: { color: '#7a7a90', fontSize: 14, textAlign: 'center' },
  historySection: { gap: 10 },
  noHistory: {
    backgroundColor: '#16161c', borderRadius: 12, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a35',
  },
  noHistoryText: { color: '#7a7a90', fontSize: 14 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16161c', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35', gap: 10,
  },
  historyDate: { color: '#7a7a90', fontSize: 12, width: 50 },
  historyWeight: { color: '#f0f0f0', fontSize: 15, fontWeight: '700', flex: 1 },
  historyReps: { color: '#7a7a90', fontSize: 14 },
  history1RM: { fontSize: 13, fontWeight: '700', minWidth: 70, textAlign: 'right' },
});
