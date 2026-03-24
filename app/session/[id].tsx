import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@store/workoutStore';
import { useAuthStore } from '@store/authStore';
import { useChallengeStore } from '@store/challengeStore';
import { geminiService } from '@services/geminiService';
import { SetCard } from '@components/workout/SetCard';
import { ExerciseCard } from '@components/workout/ExerciseCard';
import { RestTimer } from '@components/workout/RestTimer';
import { Modal } from '@components/ui/Modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import type { Exercise, WorkoutSet, ProgressionRecommendation } from '@types/index';

type SessionSection = {
  exerciseId: string;
  exerciseName: string;
  data: WorkoutSet[];
};

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const {
    sessions,
    sets,
    exercises,
    isRestTimerActive,
    loadSets,
    loadExercises,
    addSetToSession,
    deleteSession,
    updateSession,
    startRestTimer,
    restDuration,
    autoStartTimer,
    toggleAutoStartTimer,
    isLoadingSets,
    getLastPerformance,
    getLastSessionSetsForExercise,
    getPersonalRecord,
    getStreakWeeks,
  } = useWorkoutStore();
  const { evaluateAll, resetSessionProgress } = useChallengeStore();
  const toast = useToast();
  const haptics = useHaptics();

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseFilter, setExerciseFilter] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [showAddSet, setShowAddSet] = useState(false);
  const [note, setNote] = useState('');
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<ProgressionRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [showRecs, setShowRecs] = useState(true);
  const hasLoadedRecs = useRef(false);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = sessions.find((s) => String(s.id) === String(id));
  const sessionSets = sets.filter((s) => String(s.session_id) === String(id));

  // Group sets by exercise, preserving order of first appearance
  const sections = useMemo<SessionSection[]>(() => {
    const groups = new Map<string, WorkoutSet[]>();
    for (const s of sessionSets) {
      const key = String(s.exercise_id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()].map(([exerciseId, data]) => ({
      exerciseId,
      exerciseName:
        data[0]?.exercise?.name ??
        exercises.find((e) => String(e.id) === exerciseId)?.name ??
        'Exercise',
      data,
    }));
  }, [sessionSets, exercises]);

  const loadData = useCallback(async () => {
    if (id) {
      await loadSets(id);
      if (exercises.length === 0) await loadExercises();
    }
  }, [id]);

  useEffect(() => {
    loadData();
    if (session) {
      navigation.setOptions({ title: session.name });
      setNote(session.note ?? '');
    }
  }, [loadData, session?.name]);

  const generateRecommendations = useCallback(async (currentSections: typeof sections) => {
    if (hasLoadedRecs.current || currentSections.length === 0 || !id) return;
    hasLoadedRecs.current = true;

    const cacheKey = `recs_${id}`;

    // Load from cache if already generated for this session
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setAiRecommendations(JSON.parse(cached));
        return;
      }
    } catch {}

    // First time: call Gemini
    setIsLoadingRecs(true);

    const exercisesData = currentSections.map((section) => {
      const prevSets = getLastSessionSetsForExercise(section.exerciseId, id);
      if (prevSets.length === 0) return null;
      const setsText = prevSets
        .map((s, i) => `  Série ${i + 1}: ${s.weight}kg × ${s.repetitions} reps${s.rpe ? ` (RPE ${s.rpe})` : ''}`)
        .join('\n');
      return `Exercice: ${section.exerciseName}\nID: ${section.exerciseId}\nDernière séance:\n${setsText}`;
    }).filter(Boolean).join('\n\n');

    if (!exercisesData) { setIsLoadingRecs(false); return; }

    try {
      const recs = await geminiService.analyzeProgressiveOverload(exercisesData);
      setAiRecommendations(recs);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(recs));
    } catch {
      // Silent fail — recommendations are optional
    } finally {
      setIsLoadingRecs(false);
    }
  }, [id, getLastSessionSetsForExercise]);

  useEffect(() => {
    if (sections.length > 0 && !hasLoadedRecs.current) {
      generateRecommendations(sections);
    }
  }, [sections.length]);


  const triggerChallengeEval = useCallback(() => {
    // Read fresh state directly from store to avoid stale closure after addSetToSession
    const freshState = useWorkoutStore.getState();
    const freshSets = freshState.sets;
    const freshSessions = freshState.sessions;
    const freshExercises = freshState.exercises;
    const currentSessionSets = freshSets.filter(
      (s) => String(s.session_id) === String(id) && (s.weight > 0 || s.repetitions > 0)
    );
    evaluateAll({
      sessionSets: currentSessionSets,
      allSets: freshSets,
      sessions: freshSessions,
      exercises: freshExercises,
      currentSessionId: id ?? null,
      getPersonalRecord: freshState.getPersonalRecord,
      getStreakWeeks: freshState.getStreakWeeks,
    }).catch(() => {});
  }, [id, evaluateAll]);

  const handleNoteChange = (text: string) => {
    setNote(text);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => {
      if (id) updateSession(id, { note: text }).catch(() => {});
    }, 800);
  };

  const handleRepeatSet = async (lastSet: WorkoutSet) => {
    if (!user || !id) return;
    try {
      await addSetToSession({
        session_id: id,
        exercise_id: lastSet.exercise_id,
        weight: lastSet.weight,
        display_weight: `${lastSet.weight} kg`,
        repetitions: lastSet.repetitions,
        rpe: lastSet.rpe ?? null,
        note: null,
      });
      haptics.success();
      if (autoStartTimer) startRestTimer(180);
      triggerChallengeEval();
    } catch {
      toast.error('Failed to repeat set.');
    }
  };

  const handleSelectExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    const last = getLastPerformance(exercise.id);
    if (last) {
      setWeight(String(last.weight));
      setReps(String(last.repetitions));
    } else {
      setWeight('');
      setReps('');
    }
    setShowExercisePicker(false);
    setShowAddSet(true);
  };

  const handleAddSet = async () => {
    if (!selectedExercise || !id || !user) return;
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || w < 0) { toast.error('Enter a valid weight.'); return; }
    if (isNaN(r) || r <= 0) { toast.error('Enter a valid number of reps.'); return; }

    try {
      await addSetToSession({
        session_id: id,
        exercise_id: selectedExercise.id,
        weight: w,
        display_weight: `${w} kg`,
        repetitions: r,
        rpe: rpe ? parseFloat(rpe) : null,
        note: null,
      });
      await haptics.success();
      toast.success(`Set added: ${w}kg × ${r}`);
      setWeight('');
      setReps('');
      setRpe('');
      setShowAddSet(false);
      if (autoStartTimer) startRestTimer(180);
      triggerChallengeEval();
    } catch {
      toast.error('Failed to add set.');
    }
  };

  const handleAnalyzeSession = async () => {
    if (sessionSets.length === 0) { toast.error('Ajoute des séries avant d\'analyser.'); return; }
    setShowAIAnalysis(true);
    setAiAnalysis(null);
    setIsAnalyzing(true);

    // Build current session summary per exercise
    const exerciseSummaries = sections.map((section) => {
      const setsText = section.data
        .filter((s) => s.weight > 0 || s.repetitions > 0)
        .map((s, i) => `  Série ${i + 1}: ${s.weight}kg × ${s.repetitions} reps${s.rpe ? ` (RPE ${s.rpe})` : ''}${s.note ? ` — Note: "${s.note}"` : ''}`)
        .join('\n');
      return `${section.exerciseName}:\n${setsText}`;
    }).join('\n\n');

    // Build previous session summary for the same exercises
    const prevSummaries = sections.map((section) => {
      const prevSets = getLastSessionSetsForExercise(section.exerciseId, id);
      if (prevSets.length === 0) return `${section.exerciseName}: Pas de données précédentes`;
      const setsText = prevSets
        .map((s, i) => `  Série ${i + 1}: ${s.weight}kg × ${s.repetitions} reps${s.rpe ? ` (RPE ${s.rpe})` : ''}`)
        .join('\n');
      return `${section.exerciseName}:\n${setsText}`;
    }).join('\n\n');

    const totalVolume = sessionSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);

    const prompt = `Tu es un coach sportif expert en musculation. Analyse cette séance d'entraînement et compare-la à la précédente.

SÉANCE ACTUELLE (${session?.name ?? 'Séance'}) :
Volume total : ${totalVolume.toFixed(0)}kg
${exerciseSummaries}

SÉANCE PRÉCÉDENTE (mêmes exercices) :
${prevSummaries}

Donne une analyse concise en français (4-6 phrases) couvrant :
1. Les progrès notables par rapport à la séance précédente
2. Les points forts de cette séance
3. Un ou deux conseils concrets pour la prochaine séance
Sois direct et motivant, comme un vrai coach.`;

    try {
      const result = await geminiService.analyzeWorkoutSession(prompt);
      setAiAnalysis(result);
    } catch {
      setAiAnalysis('Impossible d\'analyser la séance pour le moment. Vérifie ta connexion et réessaie.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteSession = () => {
    Alert.alert('Delete Session', 'Delete this entire session and all its sets?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.heavy();
          navigation.goBack(); // navigate immediately (optimistic)
          deleteSession(id!).then(() => {
            resetSessionProgress();
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
          }).catch(() => {});
        },
      },
    ]);
  };

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(exerciseFilter.toLowerCase()) ||
    e.muscle_group.toLowerCase().includes(exerciseFilter.toLowerCase())
  );

  const exerciseSections = (() => {
    const grouped: Record<string, Exercise[]> = {};
    filteredExercises.forEach((e) => {
      if (!grouped[e.muscle_group]) grouped[e.muscle_group] = [];
      grouped[e.muscle_group].push(e);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([title, data]) => ({ title, data }));
  })();

  const volume = sessionSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Rest Timer */}
      {isRestTimerActive && (
        <View style={styles.timerWrapper}>
          <RestTimer />
        </View>
      )}

      {/* Sets List grouped by exercise */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => {
          const ex = exercises.find((e) => String(e.id) === section.exerciseId);
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionExerciseName}>{section.exerciseName}</Text>
              <Text style={styles.sectionSetCount}>
                {section.data.length} série{section.data.length > 1 ? 's' : ''}
              </Text>
              {ex && (
                <TouchableOpacity
                  style={styles.sectionAddBtn}
                  onPress={() => handleSelectExercise(ex)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add" size={16} color="#c8f060" />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        renderItem={({ item, index }) => (
          <SetCard
            set={item}
            index={index}
            onStartRest={(duration) => {
              startRestTimer(duration);
              haptics.light();
            }}
            onChallengeEval={triggerChallengeEval}
          />
        )}
        renderSectionFooter={({ section }) => {
          const lastSet = section.data.filter((s) => s.weight > 0 || s.repetitions > 0).at(-1);
          if (!lastSet) return null;
          return (
            <TouchableOpacity
              style={styles.repeatBtn}
              onPress={() => { handleRepeatSet(lastSet); haptics.light(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={13} color="#7a7a90" />
              <Text style={styles.repeatBtnText}>
                Répéter {lastSet.weight}kg × {lastSet.repetitions}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          <View style={styles.sessionHeader}>
            <View style={styles.sessionStats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{sessionSets.length}</Text>
                <Text style={styles.statLabel}>Sets</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{volume.toFixed(0)}</Text>
                <Text style={styles.statLabel}>kg total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{sections.length}</Text>
                <Text style={styles.statLabel}>Exercices</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.addExBtn}
                onPress={() => setShowExercisePicker(true)}
              >
                <Ionicons name="add" size={18} color="#0f0f12" />
                <Text style={styles.addExBtnText}>Add Set</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, autoStartTimer && styles.iconBtnActive]}
                onPress={() => { toggleAutoStartTimer(); haptics.light(); }}
              >
                <Ionicons name="timer-outline" size={18} color={autoStartTimer ? '#0f0f12' : '#c8f060'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSession}>
                <Ionicons name="trash-outline" size={18} color="#f06060" />
              </TouchableOpacity>
            </View>

            {/* Session note */}
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={handleNoteChange}
              placeholder="Note de séance (ressenti, PR tenté…)"
              placeholderTextColor="#3a3a4a"
              multiline
              numberOfLines={2}
            />

            {/* AI Progressive Overload Recommendations */}
            {(isLoadingRecs || (aiRecommendations.length > 0 && showRecs)) && (
              <View style={styles.recsCard}>
                <View style={styles.recsHeader}>
                  <Ionicons name="sparkles" size={14} color="#c8f060" />
                  <Text style={styles.recsTitle}>Recommandations surcharge progressive</Text>
                  {!isLoadingRecs && (
                    <TouchableOpacity
                      onPress={() => setShowRecs(false)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color="#5a5a70" />
                    </TouchableOpacity>
                  )}
                </View>
                {isLoadingRecs ? (
                  <View style={styles.recsLoading}>
                    <Ionicons name="sparkles" size={16} color="#3a3a4a" />
                    <Text style={styles.recsLoadingText}>Analyse de tes dernières séances…</Text>
                  </View>
                ) : (
                  aiRecommendations.map((rec) => (
                    <View key={rec.exerciseId} style={styles.recRow}>
                      <Text style={styles.recExName}>{rec.exerciseName}</Text>
                      <View style={styles.recTargets}>
                        <View style={styles.recChip}>
                          <Text style={styles.recChipText}>{rec.targetSets}×{rec.targetReps}</Text>
                          <Text style={styles.recChipSub}>séries×reps</Text>
                        </View>
                        {rec.targetWeight > 0 && (
                          <View style={[styles.recChip, styles.recChipHighlight]}>
                            <Text style={[styles.recChipText, styles.recChipTextHighlight]}>{rec.targetWeight}kg</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.recTip}>{rec.tip}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={52} color="#2a2a35" />
            <Text style={styles.emptyTitle}>No sets yet</Text>
            <Text style={styles.emptyText}>Tap "Add Set" to begin logging your workout</Text>
          </View>
        }
        ListFooterComponent={
          sessionSets.filter((s) => s.weight > 0 || s.repetitions > 0).length > 0 ? (
            <TouchableOpacity style={styles.aiBtn} onPress={handleAnalyzeSession}>
              <Ionicons name="sparkles" size={16} color="#0f0f12" />
              <Text style={styles.aiBtnText}>Analyser la séance avec l'IA</Text>
            </TouchableOpacity>
          ) : null
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      {/* Exercise Picker Modal */}
      <Modal
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        title="Select Exercise"
        fullHeight
      >
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#7a7a90" />
          <TextInput
            style={styles.searchInput}
            value={exerciseFilter}
            onChangeText={setExerciseFilter}
            placeholder="Search exercises…"
            placeholderTextColor="#3a3a4a"
            autoFocus
          />
        </View>
        <SectionList
          sections={exerciseSections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryHeaderText}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ExerciseCard
              exercise={item}
              onPress={() => handleSelectExercise(item)}
              showActions
              onAddSet={() => handleSelectExercise(item)}
              lastPerformance={getLastPerformance(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled
        />
      </Modal>

      {/* Add Set Modal */}
      <Modal
        visible={showAddSet}
        onClose={() => setShowAddSet(false)}
        title={`Add Set — ${selectedExercise?.name ?? ''}`}
      >
        <View style={styles.addSetContent}>
          {/* Last session sets history */}
          {selectedExercise && (() => {
            const lastSets = getLastSessionSetsForExercise(selectedExercise.id, id);
            if (lastSets.length === 0) return null;
            return (
              <View style={styles.lastSessionBox}>
                <View style={styles.lastSessionHeader}>
                  <Ionicons name="time-outline" size={13} color="#7a7a90" />
                  <Text style={styles.lastSessionTitle}>Dernière séance</Text>
                </View>
                {lastSets.map((s, i) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.lastSessionRow}
                    onPress={() => { setWeight(String(s.weight)); setReps(String(s.repetitions)); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.lastSessionDataRow}>
                      <Text style={styles.lastSessionSetNum}>#{i + 1}</Text>
                      <Text style={styles.lastSessionWeight}>{s.weight} kg</Text>
                      <Text style={styles.lastSessionX}>×</Text>
                      <Text style={styles.lastSessionReps}>{s.repetitions} reps</Text>
                      {s.rpe ? <Text style={styles.lastSessionRpe}>RPE {s.rpe}</Text> : null}
                    </View>
                    {s.note ? <Text style={styles.lastSessionNote}>{s.note}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}

          <View style={styles.setInputs}>
            <View style={styles.setInput}>
              <Text style={styles.setInputLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.setInputField}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#3a3a4a"
                autoFocus
              />
            </View>
            <View style={styles.setInput}>
              <Text style={styles.setInputLabel}>Reps</Text>
              <TextInput
                style={styles.setInputField}
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#3a3a4a"
              />
            </View>
            <View style={styles.setInput}>
              <Text style={styles.setInputLabel}>RPE</Text>
              <TextInput
                style={styles.setInputField}
                value={rpe}
                onChangeText={setRpe}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor="#3a3a4a"
              />
            </View>
          </View>

          {/* Quick weights */}
          <View style={styles.quickRow}>
            {[20, 40, 60, 80, 100, 120].map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.quickChip, weight === String(w) && styles.quickChipActive]}
                onPress={() => setWeight(String(w))}
              >
                <Text style={[styles.quickChipText, weight === String(w) && styles.quickChipTextActive]}>
                  {w}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick reps */}
          <View style={styles.quickRow}>
            {[5, 6, 8, 10, 12, 15].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.quickChip, reps === String(r) && styles.quickChipActive]}
                onPress={() => setReps(String(r))}
              >
                <Text style={[styles.quickChipText, reps === String(r) && styles.quickChipTextActive]}>
                  ×{r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.addSetBtn} onPress={handleAddSet}>
            <Ionicons name="add-circle" size={20} color="#0f0f12" />
            <Text style={styles.addSetBtnText}>Add Set</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* AI Analysis Modal */}
      <Modal
        visible={showAIAnalysis}
        onClose={() => setShowAIAnalysis(false)}
        title="Analyse IA de la séance"
      >
        <View style={styles.aiModalContent}>
          {isAnalyzing ? (
            <View style={styles.aiLoading}>
              <Ionicons name="sparkles" size={32} color="#c8f060" />
              <Text style={styles.aiLoadingText}>Analyse en cours…</Text>
              <Text style={styles.aiLoadingSubtext}>Gemini compare ta séance avec la précédente</Text>
            </View>
          ) : (
            <>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={16} color="#c8f060" />
                <Text style={styles.aiHeaderText}>Généré par Gemini AI</Text>
              </View>
              <Text style={styles.aiText}>{aiAnalysis}</Text>
              <TouchableOpacity style={styles.aiRetryBtn} onPress={handleAnalyzeSession}>
                <Ionicons name="refresh" size={14} color="#7a7a90" />
                <Text style={styles.aiRetryText}>Regénérer</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  timerWrapper: { padding: 16, paddingBottom: 0 },
  sessionHeader: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a35',
    marginBottom: 4,
  },
  sessionStats: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { color: '#c8f060', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#7a7a90', fontSize: 11 },
  statDivider: { width: 1, backgroundColor: '#2a2a35' },
  headerActions: { flexDirection: 'row', gap: 10 },
  addExBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#c8f060', borderRadius: 12, paddingVertical: 12,
  },
  addExBtnText: { color: '#0f0f12', fontSize: 15, fontWeight: '700' },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#16161c', borderWidth: 1, borderColor: '#2a2a35',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: '#c8f060', borderColor: '#c8f060',
  },
  deleteBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(240,96,96,0.1)', borderWidth: 1, borderColor: 'rgba(240,96,96,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  noteInput: {
    backgroundColor: '#0f0f12', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 12, paddingVertical: 10,
    color: '#f0f0f0', fontSize: 13, lineHeight: 18, minHeight: 44,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a22',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  sectionExerciseName: { color: '#c8f060', fontSize: 14, fontWeight: '700', flex: 1 },
  sectionSetCount: { color: '#7a7a90', fontSize: 12 },
  sectionAddBtn: {
    backgroundColor: 'rgba(200,240,96,0.1)',
    borderRadius: 6,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(200,240,96,0.3)',
    marginLeft: 6,
  },
  repeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: '#16161c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  repeatBtnText: {
    color: '#5a5a70',
    fontSize: 12,
    fontWeight: '600',
  },
  list: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10, padding: 24 },
  emptyTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#7a7a90', fontSize: 14, textAlign: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f0f12', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#f0f0f0', fontSize: 15 },
  categoryHeader: {
    backgroundColor: '#1a1a22', paddingHorizontal: 14, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#2a2a35',
  },
  categoryHeaderText: { color: '#c8f060', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  addSetContent: { gap: 16 },
  setInputs: { flexDirection: 'row', gap: 10 },
  setInput: { flex: 1, gap: 6 },
  setInputLabel: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
  setInputField: {
    backgroundColor: '#0f0f12', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 10, paddingVertical: 14,
    color: '#f0f0f0', fontSize: 22, fontWeight: '800', textAlign: 'center',
  },
  quickRow: { flexDirection: 'row', gap: 6 },
  quickChip: {
    flex: 1, backgroundColor: '#2a2a35', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  quickChipActive: { backgroundColor: '#c8f060' },
  quickChipText: { color: '#7a7a90', fontSize: 13, fontWeight: '600' },
  quickChipTextActive: { color: '#0f0f12' },
  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#c8f060', borderRadius: 14, paddingVertical: 16,
  },
  addSetBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
  lastSessionBox: {
    backgroundColor: '#0f0f12', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#2a2a35', gap: 6,
  },
  lastSessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  lastSessionTitle: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
  lastSessionRow: {
    flexDirection: 'column', gap: 3,
    paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 8, backgroundColor: '#16161c',
  },
  lastSessionDataRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastSessionSetNum: { color: '#3a3a4a', fontSize: 11, width: 22 },
  lastSessionWeight: { color: '#c8f060', fontSize: 14, fontWeight: '700', flex: 1 },
  lastSessionX: { color: '#7a7a90', fontSize: 13 },
  lastSessionReps: { color: '#f0f0f0', fontSize: 14, fontWeight: '600', flex: 1 },
  lastSessionRpe: { color: '#7a7a90', fontSize: 11 },
  lastSessionNote: { color: '#5a5a70', fontSize: 11, fontStyle: 'italic', paddingLeft: 22 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#c8f060', borderRadius: 14, paddingVertical: 14,
    marginTop: 16, marginBottom: 8,
  },
  aiBtnText: { color: '#0f0f12', fontSize: 15, fontWeight: '700' },
  aiModalContent: { gap: 16, minHeight: 120 },
  aiLoading: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  aiLoadingText: { color: '#f0f0f0', fontSize: 16, fontWeight: '600' },
  aiLoadingSubtext: { color: '#7a7a90', fontSize: 13, textAlign: 'center' },
  aiHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a35',
  },
  aiHeaderText: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
  aiText: { color: '#f0f0f0', fontSize: 15, lineHeight: 24 },
  aiRetryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: '#1a1a22', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a35',
  },
  aiRetryText: { color: '#7a7a90', fontSize: 12 },
  recsCard: {
    backgroundColor: '#0f1a08', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(200,240,96,0.2)', gap: 8,
  },
  recsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(200,240,96,0.1)', paddingBottom: 8,
  },
  recsTitle: { color: '#c8f060', fontSize: 12, fontWeight: '700', flex: 1 },
  recsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  recsLoadingText: { color: '#3a3a4a', fontSize: 13 },
  recRow: {
    backgroundColor: '#161c0e', borderRadius: 10, padding: 10, gap: 4,
    borderWidth: 1, borderColor: 'rgba(200,240,96,0.08)',
  },
  recExName: { color: '#e0e0e0', fontSize: 13, fontWeight: '700' },
  recTargets: { flexDirection: 'row', gap: 6, marginTop: 4 },
  recChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 3,
    backgroundColor: '#2a2a35', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  recChipHighlight: { backgroundColor: 'rgba(200,240,96,0.12)', borderWidth: 1, borderColor: 'rgba(200,240,96,0.3)' },
  recChipText: { color: '#f0f0f0', fontSize: 14, fontWeight: '700' },
  recChipTextHighlight: { color: '#c8f060' },
  recChipSub: { color: '#5a5a70', fontSize: 10 },
  recTip: { color: '#7a7a90', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
