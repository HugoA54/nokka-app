import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useChallengeStore } from '@store/challengeStore';
import { ExerciseCard } from '@components/workout/ExerciseCard';
import { RestTimer } from '@components/workout/RestTimer';
import { SessionCardSkeleton } from '@components/ui/LoadingSkeleton';
import { useHaptics } from '@hooks/useHaptics';
import { useToast } from '@hooks/useToast';
import type { Session } from '@types/index';

export default function WorkoutScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    sessions,
    exercises,
    sets,
    isLoadingSessions,
    isLoadingExercises,
    isRestTimerActive,
    loadSessions,
    loadExercises,
    createNewSession,
    createSessionFromTemplate,
    deleteSession,
    resumeRestTimer,
  } = useWorkoutStore();
  const { evaluateAll } = useChallengeStore();
  const haptics = useHaptics();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionTab, setNewSessionTab] = useState<'blank' | 'template'>('blank');
  const [tab, setTab] = useState<'sessions' | 'exercises'>('sessions');
  const [exerciseFilter, setExerciseFilter] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    await Promise.all([loadSessions(user.id), loadExercises(), resumeRestTimer()]);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateSession = async (templateName?: string) => {
    if (!user) return;
    const name = templateName ?? (newSessionName.trim() || `Workout ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
    try {
      const session = templateName
        ? await createSessionFromTemplate(user.id, name)
        : await createNewSession(user.id, name);
      setShowNewSession(false);
      setNewSessionName('');
      setNewSessionTab('blank');
      await haptics.success();
      // Re-evaluate after session creation (unlocks "première séance", compteurs, etc.)
      const state = useWorkoutStore.getState();
      evaluateAll({
        sessionSets: [],
        allSets: state.sets,
        sessions: state.sessions,
        exercises: state.exercises,
        currentSessionId: session.id,
        getPersonalRecord: state.getPersonalRecord,
        getStreakWeeks: state.getStreakWeeks,
      }).catch(() => {});
      router.push(`/session/${session.id}`);
    } catch {
      toast.error('Failed to create session.');
    }
  };

  // Get unique routine names from past sessions (templates)
  const templates = [...new Map(
    sessions.map((s) => [s.name, s])
  ).values()].slice(0, 10);

  const handleDeleteSession = (session: Session) => {
    Alert.alert('Delete Session', `Delete "${session.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.medium();
          toast.success('Session deleted.');
          deleteSession(session.id).then(() => {
            const state = useWorkoutStore.getState();
            evaluateAll({
              sessionSets: [],
              allSets: state.sets,
              sessions: state.sessions,
              exercises: state.exercises,
              currentSessionId: null,
              getPersonalRecord: state.getPersonalRecord,
              getStreakWeeks: state.getStreakWeeks,
            }).catch(() => {});
          }).catch(() => toast.error('Failed to delete.'));
        },
      },
    ]);
  };

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(exerciseFilter.toLowerCase()) ||
    e.muscle_group.toLowerCase().includes(exerciseFilter.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Rest Timer (always visible if active) */}
      {isRestTimerActive && (
        <View style={styles.timerContainer}>
          <RestTimer />
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['sessions', 'exercises'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'sessions' ? (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <TouchableOpacity
                style={styles.newSessionBtn}
                onPress={() => setShowNewSession(true)}
              >
                <Ionicons name="add" size={20} color="#0f0f12" />
                <Text style={styles.newSessionBtnText}>New Session</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const sessionSets = sets.filter((s) => s.session_id === item.id);
            const volume = sessionSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);
            return (
              <TouchableOpacity
                style={styles.sessionCard}
                onPress={() => router.push(`/session/${item.id}`)}
                onLongPress={() => handleDeleteSession(item)}
                activeOpacity={0.8}
              >
                <View style={styles.sessionTop}>
                  <View style={styles.sessionIconWrap}>
                    <Ionicons name="barbell" size={18} color="#c8f060" />
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName}>{item.name}</Text>
                    <Text style={styles.sessionDate}>
                      {new Date(item.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#7a7a90" />
                </View>
                <View style={styles.sessionStats}>
                  <View style={styles.sessionStat}>
                    <Text style={styles.sessionStatValue}>{sessionSets.length}</Text>
                    <Text style={styles.sessionStatLabel}>sets</Text>
                  </View>
                  <View style={styles.sessionStatDivider} />
                  <View style={styles.sessionStat}>
                    <Text style={styles.sessionStatValue}>{volume.toFixed(0)}</Text>
                    <Text style={styles.sessionStatLabel}>kg total</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            !isLoadingSessions ? (
              <View style={styles.empty}>
                <Ionicons name="barbell-outline" size={52} color="#2a2a35" />
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptyText}>Create your first workout session</Text>
              </View>
            ) : (
              <View style={{ padding: 16 }}>
                <SessionCardSkeleton />
                <SessionCardSkeleton />
                <SessionCardSkeleton />
              </View>
            )
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#7a7a90" />
              <TextInput
                style={styles.searchInput}
                value={exerciseFilter}
                onChangeText={setExerciseFilter}
                placeholder="Search exercises…"
                placeholderTextColor="#3a3a4a"
              />
              {exerciseFilter.length > 0 && (
                <TouchableOpacity onPress={() => setExerciseFilter('')}>
                  <Ionicons name="close-circle" size={16} color="#7a7a90" />
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ExerciseCard
              exercise={item}
              onPress={() => router.push(`/exercise/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* New Session Modal */}
      <Modal visible={showNewSession} transparent animationType="slide" onRequestClose={() => setShowNewSession(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowNewSession(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Session</Text>

            {/* Blank / Template toggle */}
            <View style={styles.modalTabBar}>
              {(['blank', 'template'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.modalTab, newSessionTab === t && styles.modalTabActive]}
                  onPress={() => setNewSessionTab(t)}
                >
                  <Text style={[styles.modalTabText, newSessionTab === t && styles.modalTabTextActive]}>
                    {t === 'blank' ? 'Blank' : 'From Template'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newSessionTab === 'blank' ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={newSessionName}
                  onChangeText={setNewSessionName}
                  placeholder="Session name (optional)"
                  placeholderTextColor="#3a3a4a"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => handleCreateSession()}
                />
                <TouchableOpacity style={styles.modalBtn} onPress={() => handleCreateSession()}>
                  <Text style={styles.modalBtnText}>Start Session</Text>
                </TouchableOpacity>
              </>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const templateSets = sets.filter((s) => String(s.session_id) === String(item.id));
                  const exerciseCount = new Set(templateSets.map((s) => s.exercise_id)).size;
                  return (
                    <TouchableOpacity
                      style={styles.templateRow}
                      onPress={() => handleCreateSession(item.name)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.templateIcon}>
                        <Ionicons name="copy-outline" size={18} color="#c8f060" />
                      </View>
                      <View style={styles.templateInfo}>
                        <Text style={styles.templateName}>{item.name}</Text>
                        <Text style={styles.templateMeta}>
                          {exerciseCount > 0 ? `${exerciseCount} exercises · ` : ''}
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#3a3a4a" />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#7a7a90', fontSize: 14 }}>No past sessions to use as template.</Text>
                  </View>
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  timerContainer: { padding: 16, paddingBottom: 0 },
  tabBar: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#c8f060' },
  tabText: { color: '#7a7a90', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#0f0f12' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  listHeader: { marginBottom: 8 },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#c8f060',
    borderRadius: 14,
    paddingVertical: 14,
  },
  newSessionBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
  sessionCard: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 12,
  },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(200,240,96,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  sessionInfo: { flex: 1 },
  sessionName: { color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  sessionDate: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
  sessionStats: { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
  sessionStat: { flex: 1, alignItems: 'center' },
  sessionStatValue: { color: '#c8f060', fontSize: 20, fontWeight: '800' },
  sessionStatLabel: { color: '#7a7a90', fontSize: 11, marginTop: 2 },
  sessionStatDivider: { width: 1, height: 32, backgroundColor: '#2a2a35' },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
    padding: 24,
  },
  emptyTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#7a7a90', fontSize: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16161c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#f0f0f0', fontSize: 15 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: '#16161c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#3a3a4a',
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  modalTitle: { color: '#f0f0f0', fontSize: 20, fontWeight: '700' },
  modalInput: {
    backgroundColor: '#0f0f12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f0f0f0',
    fontSize: 16,
  },
  modalBtn: {
    backgroundColor: '#c8f060',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
  modalTabBar: {
    flexDirection: 'row', backgroundColor: '#0f0f12',
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: '#2a2a35',
  },
  modalTab: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  modalTabActive: { backgroundColor: '#c8f060' },
  modalTabText: { color: '#7a7a90', fontSize: 13, fontWeight: '600' },
  modalTabTextActive: { color: '#0f0f12' },
  templateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f0f12', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35', marginBottom: 8,
  },
  templateIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(200,240,96,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  templateInfo: { flex: 1 },
  templateName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  templateMeta: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
});
