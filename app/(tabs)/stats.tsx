import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, ContributionGraph } from 'react-native-chart-kit';
import { useAuthStore } from '@store/authStore';
import { useWorkoutStore } from '@store/workoutStore';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;

const CHART_CONFIG = {
  backgroundColor: '#16161c',
  backgroundGradientFrom: '#16161c',
  backgroundGradientTo: '#16161c',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(200, 240, 96, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(122, 122, 144, ${opacity})`,
  style: { borderRadius: 12 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#c8f060' },
};

type StatsTab = 'volume' | 'exercises' | 'muscles' | 'calendar';

export default function StatsScreen() {
  const user = useAuthStore((s) => s.user);
  const {
    sessions,
    sets,
    exercises,
    isLoadingSessions,
    loadSessions,
    loadExercises,
    getMuscleDistribution,
    getStreakWeeks,
    getYearHeatmapData,
    getPersonalRecord,
    selectedExercise,
    setSelectedExercise,
    getExerciseProgressionData,
  } = useWorkoutStore();
  const [tab, setTab] = useState<StatsTab>('volume');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    await Promise.all([loadSessions(user.id), loadExercises()]);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  // ── Volume over last 7 sessions ────────────────────────────────────────────
  const last7 = sessions.slice(0, 7).reverse();
  const volumeData = last7.map((s) =>
    sets.filter((st) => st.session_id === s.id).reduce((sum, st) => sum + st.weight * st.repetitions, 0)
  );
  const volumeLabels = last7.map((s) => {
    const d = new Date(s.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  // ── Muscle Distribution ────────────────────────────────────────────────────
  const muscleDist = getMuscleDistribution();
  const streak = getStreakWeeks();
  const heatmapData = getYearHeatmapData();

  // ── Personal Records ───────────────────────────────────────────────────────
  const prs = exercises
    .map((e) => getPersonalRecord(e.id))
    .filter(Boolean)
    .sort((a, b) => (b?.estimated_1rm ?? 0) - (a?.estimated_1rm ?? 0))
    .slice(0, 10);

  // ── Exercise Progression ───────────────────────────────────────────────────
  const progression = selectedExercise
    ? getExerciseProgressionData(selectedExercise.id).slice(-10)
    : [];

  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);
  const totalSets = sets.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
    >
      {/* Header stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total Sessions', value: sessions.length, icon: 'barbell-outline' },
          { label: 'Total Sets', value: totalSets, icon: 'layers-outline' },
          { label: 'Volume (t)', value: `${(totalVolume / 1000).toFixed(1)}`, icon: 'trending-up-outline' },
          { label: 'Streak (wks)', value: streak, icon: 'flame-outline' },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Ionicons name={stat.icon as any} size={18} color="#c8f060" />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'volume', label: 'Volume' },
          { key: 'exercises', label: 'PRs' },
          { key: 'muscles', label: 'Muscles' },
          { key: 'calendar', label: 'Calendar' },
        ] as { key: StatsTab; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Volume Chart */}
      {tab === 'volume' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume per Session (kg)</Text>
          {volumeData.length >= 2 ? (
            <LineChart
              data={{ labels: volumeLabels, datasets: [{ data: volumeData, color: () => '#c8f060', strokeWidth: 2 }] }}
              width={CHART_W}
              height={200}
              chartConfig={CHART_CONFIG}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>Need at least 2 sessions to display chart</Text>
            </View>
          )}
        </View>
      )}

      {/* Personal Records */}
      {tab === 'exercises' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Records</Text>
          {prs.length === 0 ? (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>No sets logged yet</Text>
            </View>
          ) : (
            prs.map((pr, i) => pr && (
              <View key={pr.exercise_id} style={styles.prCard}>
                <View style={styles.prRank}>
                  <Text style={styles.prRankText}>{i + 1}</Text>
                </View>
                <View style={styles.prInfo}>
                  <Text style={styles.prName}>{pr.exercise_name}</Text>
                  <Text style={styles.prDetails}>
                    {pr.weight}kg × {pr.repetitions} reps
                  </Text>
                </View>
                <View style={styles.prRM}>
                  <Text style={styles.prRMValue}>{pr.estimated_1rm}kg</Text>
                  <Text style={styles.prRMLabel}>est. 1RM</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Muscle Distribution */}
      {tab === 'muscles' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muscle Group Distribution</Text>
          {muscleDist.length === 0 ? (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>No sets logged yet</Text>
            </View>
          ) : (
            muscleDist
              .sort((a, b) => b.set_count - a.set_count)
              .map((m) => {
                const MUSCLE_COLORS: Record<string, string> = {
                  chest: '#60d4f0', back: '#c8f060', shoulders: '#f0c060',
                  biceps: '#f060a8', triceps: '#f060a8', legs: '#a060f0',
                  glutes: '#a060f0', core: '#f06060', cardio: '#60f090', full_body: '#f0f0f0',
                };
                const color = MUSCLE_COLORS[m.muscle_group] ?? '#7a7a90';
                return (
                  <View key={m.muscle_group} style={styles.muscleRow}>
                    <Text style={[styles.muscleName, { color }]}>
                      {m.muscle_group.replace('_', ' ')}
                    </Text>
                    <View style={styles.muscleBar}>
                      <View style={[styles.muscleBarFill, { width: `${m.percentage}%` as any, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.musclePercent}>{m.percentage}%</Text>
                    <Text style={styles.muscleSets}>{m.set_count}s</Text>
                  </View>
                );
              })
          )}
        </View>
      )}

      {/* Calendar Heatmap */}
      {tab === 'calendar' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Calendar</Text>
          {heatmapData.length > 0 ? (
            <ContributionGraph
              values={heatmapData.map((h) => ({ date: h.date, count: Math.min(Math.round(h.count / 3), 4) }))}
              endDate={new Date()}
              numDays={105}
              width={CHART_W}
              height={220}
              chartConfig={{
                ...CHART_CONFIG,
                color: (opacity = 1) => `rgba(200, 240, 96, ${opacity})`,
              }}
              style={styles.chart}
            />
          ) : (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>No workout data yet</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%',
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  statValue: { color: '#f0f0f0', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#7a7a90', fontSize: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#c8f060' },
  tabText: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#0f0f12' },
  section: { gap: 12 },
  sectionTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  chart: { borderRadius: 12, marginHorizontal: 0 },
  noData: {
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  noDataText: { color: '#7a7a90', fontSize: 14 },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  prRank: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2a2a35', alignItems: 'center', justifyContent: 'center',
  },
  prRankText: { color: '#7a7a90', fontSize: 13, fontWeight: '700' },
  prInfo: { flex: 1 },
  prName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  prDetails: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
  prRM: { alignItems: 'flex-end' },
  prRMValue: { color: '#c8f060', fontSize: 18, fontWeight: '800' },
  prRMLabel: { color: '#7a7a90', fontSize: 10 },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  muscleName: { width: 70, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  muscleBar: { flex: 1, height: 8, backgroundColor: '#2a2a35', borderRadius: 4, overflow: 'hidden' },
  muscleBarFill: { height: '100%', borderRadius: 4 },
  musclePercent: { width: 36, color: '#7a7a90', fontSize: 12, textAlign: 'right' },
  muscleSets: { width: 28, color: '#7a7a90', fontSize: 11, textAlign: 'right' },
});
