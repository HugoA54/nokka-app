import React, { useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@store/authStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useMacroAIStore } from '@store/macroAIStore';
import { useNutritionStore } from '@store/nutritionStore';
import { MacroSummary } from '@components/dashboard/MacroSummary';
import { CreatineCard } from '@components/dashboard/CreatineCard';
import { MacroSummarySkeleton, SessionCardSkeleton } from '@components/ui/LoadingSkeleton';
import { saveWidgetData } from '@widgets/widgetTaskHandler';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { NokkaWidget } from '@widgets/NokkaWidget';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    sessions,
    sets,
    userProfile,
    isLoadingSessions,
    loadSessions,
    loadExercises,
    loadUserProfile,
    getStreakWeeks,
    isOnline,
    pendingCount,
  } = useWorkoutStore();
  const {
    meals: aiMeals,
    goals,
    isLoadingMeals,
    fetchTodayMeals,
    loadGoals,
  } = useMacroAIStore();
  const { todayMealEntries, loadTodayLog } = useNutritionStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      loadSessions(user.id),
      loadExercises(),
      loadUserProfile(user.id),
      fetchTodayMeals(user.id),
      loadGoals(user.id),
      loadTodayLog(user.id),
    ]);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Combine AI-scanned meals + manually added nutrition entries
  const aiTotals = aiMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteines: acc.proteines + m.proteines,
      glucides: acc.glucides + m.glucides,
      lipides: acc.lipides + m.lipides,
    }),
    todayMealEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calories ?? 0),
        proteines: acc.proteines + (e.protein ?? 0),
        glucides: acc.glucides + (e.carbs ?? 0),
        lipides: acc.lipides + (e.fats ?? 0),
      }),
      { calories: 0, proteines: 0, glucides: 0, lipides: 0 }
    )
  );

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const recentSessions = sessions.slice(0, 3);
  const streak = getStreakWeeks();

  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);

  // Compute week sessions for widget
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toLocaleDateString('en-CA');
  const weekSessions = sessions.filter((s) => s.date >= weekStartStr).length;

  // Write widget data and force refresh whenever key values change
  useEffect(() => {
    const data = {
      calories: aiTotals.calories,
      calorieGoal: goals?.calories ?? 2000,
      weekSessions,
    };
    saveWidgetData(data)
      .then(() =>
        requestWidgetUpdate({
          widgetName: 'NokkaWidget',
          renderWidget: () =>
            React.createElement(NokkaWidget, data),
        })
      )
      .catch(() => {});
  }, [aiTotals.calories, goals?.calories, weekSessions]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
    >
      {/* Offline banner */}
      {(!isOnline || pendingCount > 0) && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#f06060" />
          <Text style={styles.offlineBannerText}>
            {!isOnline
              ? pendingCount > 0
                ? `Hors-ligne — ${pendingCount} série(s) en attente de sync`
                : 'Hors-ligne — les données seront synchronisées à la reconnexion'
              : `${pendingCount} série(s) en attente de synchronisation`}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.username}>{user?.email?.split('@')[0] ?? 'Athlete'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push('/leaderboard')}
        >
          <Ionicons name="trophy-outline" size={22} color="#c8f060" />
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        {[
          { label: 'Sessions', value: sessions.length, icon: 'barbell-outline' },
          { label: 'Streak', value: `${streak}w`, icon: 'flame-outline' },
          { label: 'Volume', value: `${(totalVolume / 1000).toFixed(1)}t`, icon: 'trending-up-outline' },
        ].map((stat) => (
          <View key={stat.label} style={styles.statItem}>
            <Ionicons name={stat.icon as any} size={18} color="#c8f060" />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Today's workout section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Workout</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/workout')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {todaySessions.length > 0 ? (
          todaySessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => router.push(`/session/${session.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.sessionIcon}>
                <Ionicons name="barbell" size={20} color="#c8f060" />
              </View>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionName}>{session.name}</Text>
                <Text style={styles.sessionMeta}>
                  {sets.filter((s) => s.session_id === session.id).length} sets logged
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#7a7a90" />
            </TouchableOpacity>
          ))
        ) : (
          <LinearGradient
            colors={['#16161c', '#1a1a22']}
            style={styles.emptyWorkout}
          >
            <Ionicons name="barbell-outline" size={32} color="#2a2a35" />
            <Text style={styles.emptyTitle}>No workout today</Text>
            <Text style={styles.emptySubtitle}>Ready to crush it?</Text>
            <TouchableOpacity
              style={styles.startWorkoutBtn}
              onPress={() => router.push('/(tabs)/workout')}
            >
              <Text style={styles.startWorkoutText}>Start Session</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>

      {/* Macro Summary */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/macro-ai')}>
            <Text style={styles.seeAll}>AI Analysis</Text>
          </TouchableOpacity>
        </View>
        {isLoadingMeals ? (
          <MacroSummarySkeleton />
        ) : (
          <MacroSummary
            totals={aiTotals}
            goals={goals}
            onEditGoals={() => router.push('/(tabs)/macro-ai')}
          />
        )}
      </View>

      {/* Creatine Reminder */}
      <CreatineCard />

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'New Session', icon: 'add-circle-outline', route: '/(tabs)/workout' as const, color: '#c8f060' },
            { label: 'AI Photo', icon: 'camera-outline', route: '/(tabs)/macro-ai' as const, color: '#60d4f0' },
            { label: 'Nutrition', icon: 'nutrition-outline', route: '/(tabs)/nutrition' as const, color: '#f0c060' },
            { label: 'Stats', icon: 'stats-chart-outline', route: '/(tabs)/stats' as const, color: '#f060a8' },
            { label: 'Shopping', icon: 'cart-outline', route: '/shopping-list' as const, color: '#60f090' },
            { label: 'Leaderboard', icon: 'trophy-outline', route: '/leaderboard' as const, color: '#f0c060' },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickItem}
              onPress={() => router.push(action.route)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIcon, { borderColor: action.color }]}>
                <Ionicons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {isLoadingSessions ? (
            <>
              <SessionCardSkeleton />
              <SessionCardSkeleton />
            </>
          ) : (
            recentSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.recentCard}
                onPress={() => router.push(`/session/${session.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.recentLeft}>
                  <Text style={styles.recentName}>{session.name}</Text>
                  <Text style={styles.recentDate}>{new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentSets}>{sets.filter((s) => s.session_id === session.id).length} sets</Text>
                  <Ionicons name="chevron-forward" size={16} color="#7a7a90" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  content: { padding: 20, paddingBottom: 40, gap: 24 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a0f0f',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3a1a1a',
  },
  offlineBannerText: { color: '#f06060', fontSize: 12, fontWeight: '600', flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  greeting: { color: '#7a7a90', fontSize: 14, fontWeight: '500' },
  username: { color: '#f0f0f0', fontSize: 24, fontWeight: '800', marginTop: 2 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#16161c', borderWidth: 1, borderColor: '#2a2a35',
    alignItems: 'center', justifyContent: 'center',
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { color: '#f0f0f0', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#7a7a90', fontSize: 11 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  seeAll: { color: '#c8f060', fontSize: 13, fontWeight: '600' },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  sessionIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(200,240,96,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  sessionInfo: { flex: 1, gap: 2 },
  sessionName: { color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  sessionMeta: { color: '#7a7a90', fontSize: 12 },
  emptyWorkout: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 28,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  emptyTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  emptySubtitle: { color: '#7a7a90', fontSize: 13 },
  startWorkoutBtn: {
    backgroundColor: '#c8f060',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  startWorkoutText: { color: '#0f0f12', fontWeight: '700', fontSize: 15 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: { width: '30%', alignItems: 'center', gap: 6 },
  quickIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#16161c', borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { color: '#7a7a90', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  recentLeft: { flex: 1, gap: 2 },
  recentName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  recentDate: { color: '#7a7a90', fontSize: 12 },
  recentRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentSets: { color: '#7a7a90', fontSize: 13 },
});
