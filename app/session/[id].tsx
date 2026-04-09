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
import { useTemplateStore } from '@store/templateStore';
import { geminiService } from '@services/geminiService';
import { SetCard } from '@components/workout/SetCard';
import { ExerciseCard } from '@components/workout/ExerciseCard';
import { RestTimer } from '@components/workout/RestTimer';
import { Modal } from '@components/ui/Modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import { useTranslation } from 'react-i18next';
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
    getLastNSessionsForExercise,
    getPersonalRecord,
    getStreakWeeks,
  } = useWorkoutStore();
  const { evaluateAll, resetSessionProgress } = useChallengeStore();
  const toast = useToast();
  const haptics = useHaptics();
  const { t } = useTranslation();

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseFilter, setExerciseFilter] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [showAddSet, setShowAddSet] = useState(false);
  const [note, setNote] = useState('');
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<ProgressionRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const aiEnabledRef = useRef(false);
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
    // Check AI status + load cached analysis
    const enabled = await geminiService.isEnabled();
    setAiEnabled(enabled);
    aiEnabledRef.current = enabled;
    if (id) {
      const cached = await AsyncStorage.getItem(`ai_analysis_${id}`);
      if (cached) setAiAnalysis(cached);
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
    if (hasLoadedRecs.current || currentSections.length === 0 || !id || !aiEnabledRef.current) return;
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
      const history = getLastNSessionsForExercise(section.exerciseId, 3, id);
      if (history.length === 0) return null;
      const historyText = history.map((h, hi) => {
        const label = hi === 0 ? 'Séance N-1' : hi === 1 ? 'Séance N-2' : 'Séance N-3';
        const sessionNote = h.note ? ` (note: "${h.note}")` : '';
        const setsText = h.sets
          .map((s, i) => `    S${i + 1}: ${s.weight}kg×${s.repetitions}${s.rpe ? ` RPE${s.rpe}` : ''}${s.note ? ` "${s.note}"` : ''}`)
          .join(' | ');
        return `  ${label} [${h.date}]${sessionNote}:\n    ${setsText}`;
      }).join('\n');
      return `Exercice: ${section.exerciseName} (ID:${section.exerciseId})\n${historyText}`;
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
    if (sections.length > 0 && !hasLoadedRecs.current && aiEnabled) {
      generateRecommendations(sections);
    }
  }, [sections.length, aiEnabled]);


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
      toast.error(t('session.failed_repeat_set'));
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
    if (isNaN(w) || w < 0) { toast.error(t('session.invalid_weight')); return; }
    if (isNaN(r) || r <= 0) { toast.error(t('session.invalid_reps')); return; }

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
      toast.success(t('session.set_added', { weight: w, reps: r }));
      setWeight('');
      setReps('');
      setRpe('');
      setShowAddSet(false);
      if (autoStartTimer) startRestTimer(180);
      triggerChallengeEval();
    } catch {
      toast.error(t('session.failed_add_set'));
    }
  };

  const handleAnalyzeSession = async () => {
    if (sessionSets.length === 0) { toast.error(t('session.no_sets')); return; }
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

    // Build history for each exercise (last 3 sessions)
    const historyByExercise = sections.map((section) => {
      const history = getLastNSessionsForExercise(section.exerciseId, 3, id);
      if (history.length === 0) return `${section.exerciseName}: aucun historique`;
      const lines = history.map((h, hi) => {
        const label = hi === 0 ? 'N-1' : hi === 1 ? 'N-2' : 'N-3';
        const sessionNote = h.note ? ` (note séance: "${h.note}")` : '';
        const setsText = h.sets
          .map((s, i) => `S${i + 1}:${s.weight}kg×${s.repetitions}${s.rpe ? `/RPE${s.rpe}` : ''}${s.note ? `/"${s.note}"` : ''}`)
          .join(' ');
        return `  [${label} ${h.date}]${sessionNote}: ${setsText}`;
      }).join('\n');
      return `${section.exerciseName}:\n${lines}`;
    }).join('\n\n');

    const totalVolume = sessionSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);
    const sessionNoteText = note?.trim() ? `\nNote de l'athlète: "${note}"` : '';

    const prompt = `Tu es un coach expert en musculation. Analyse cette séance et son historique récent.

SÉANCE ACTUELLE — ${session?.name ?? 'Séance'} (volume: ${totalVolume.toFixed(0)}kg)${sessionNoteText}
${exerciseSummaries}

HISTORIQUE (3 dernières séances par exercice) :
${historyByExercise}

Rédige une analyse coach en français, 5-7 phrases max, structurée ainsi :
1. Tendance globale sur les dernières séances (progression, stagnation, régression ?)
2. Signaux de fatigue détectés (RPE en hausse pour même charge ?)
3. Points forts de cette séance
4. 1-2 ajustements précis et actionnables pour la prochaine séance (charge, volume, récup)
Sois direct, factuel, cite des chiffres. Pas de blabla.`;

    try {
      const result = await geminiService.analyzeWorkoutSession(prompt);
      setAiAnalysis(result);
      await AsyncStorage.setItem(`ai_analysis_${id}`, result);
    } catch {
      setAiAnalysis(t('session.analysis_error'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!user || !saveTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      const { createTemplate, updateTemplate } = useTemplateStore.getState();
      const tmpl = await createTemplate(user.id, saveTemplateName.trim());
      const exercises = sections.map((section, i) => {
        const realSets = section.data.filter((s) => s.weight > 0 || s.repetitions > 0);
        const lastSet = realSets.at(-1);
        return {
          exercise_id: section.exerciseId,
          exercise_name: section.exerciseName,
          order_index: i,
          default_sets: realSets.length || 3,
          default_reps: lastSet?.repetitions ?? 10,
          default_weight: lastSet?.weight ?? 0,
        };
      });
      await updateTemplate(tmpl.id, saveTemplateName.trim(), null, exercises);
      setShowSaveTemplate(false);
      setSaveTemplateName('');
      toast.success(t('session.template_saved'));
    } catch {
      toast.error(t('templates.failed_save'));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteSession = () => {
    Alert.alert(t('session.delete_session'), t('session.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
          const rec = aiRecommendations.find((r) => String(r.exerciseId) === String(section.exerciseId));
          return (
            <View style={styles.sectionHeaderWrap}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionExerciseName}>{section.exerciseName}</Text>
                <Text style={styles.sectionSetCount}>
                  {section.data.length === 1 ? t('session.set_count_one') : t('session.set_count_other', { count: section.data.length })}
                </Text>
                {isLoadingRecs && (
                  <Ionicons name="sparkles" size={13} color="#3a3a4a" style={{ marginLeft: 4 }} />
                )}
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
              {rec && ex && (
                <TouchableOpacity
                  style={styles.recBanner}
                  onPress={() => {
                    setSelectedExercise(ex);
                    setWeight(String(rec.targetWeight > 0 ? rec.targetWeight : ''));
                    setReps(String(rec.targetReps));
                    setRpe('');
                    setShowAddSet(true);
                    haptics.light();
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="sparkles" size={11} color="#c8f060" />
                  <Text style={styles.recBannerText}>
                    {rec.targetWeight > 0 ? `${rec.targetWeight}kg × ` : ''}{rec.targetReps} reps · {rec.tip}
                  </Text>
                  <Ionicons name="chevron-forward" size={11} color="#5a5a70" />
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
                {t('session.repeat_set')} {lastSet.weight}kg × {lastSet.repetitions}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          <View style={styles.sessionHeader}>
            <View style={styles.sessionStats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{sessionSets.length}</Text>
                <Text style={styles.statLabel}>{t('session.sets')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{volume.toFixed(0)}</Text>
                <Text style={styles.statLabel}>kg total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{sections.length}</Text>
                <Text style={styles.statLabel}>{t('session.exercises_count')}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.addExBtn}
                onPress={() => setShowExercisePicker(true)}
              >
                <Ionicons name="add" size={18} color="#0f0f12" />
                <Text style={styles.addExBtnText}>{t('session.add_set')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, autoStartTimer && styles.iconBtnActive]}
                onPress={() => { toggleAutoStartTimer(); haptics.light(); }}
              >
                <Ionicons name="timer-outline" size={18} color={autoStartTimer ? '#0f0f12' : '#c8f060'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSummary(true)}>
                <Ionicons name="camera-outline" size={18} color="#c8f060" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setSaveTemplateName(session?.name ?? '');
                  setShowSaveTemplate(true);
                }}
              >
                <Ionicons name="bookmark-outline" size={18} color="#c8f060" />
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
              placeholder={t('session.session_note')}
              placeholderTextColor="#3a3a4a"
              multiline
              numberOfLines={2}
            />

            {/* Recs loading indicator in header (before exercises appear) */}
            {aiEnabled && isLoadingRecs && sections.length === 0 && (
              <View style={styles.recsLoading}>
                <Ionicons name="sparkles" size={14} color="#3a3a4a" />
                <Text style={styles.recsLoadingText}>{t('session.analyzing')}</Text>
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
            <View style={styles.footerContainer}>
              {/* Saved AI analysis inline */}
              {aiAnalysis && !isAnalyzing && (
                <View style={styles.aiSavedCard}>
                  <View style={styles.aiSavedHeader}>
                    <Ionicons name="sparkles" size={14} color="#c8f060" />
                    <Text style={styles.aiSavedTitle}>Analyse IA</Text>
                    {aiEnabled && (
                      <TouchableOpacity
                        style={styles.aiRefreshBtn}
                        onPress={handleAnalyzeSession}
                      >
                        <Ionicons name="refresh" size={13} color="#7a7a90" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.aiSavedText}>{aiAnalysis}</Text>
                </View>
              )}
              {/* AI button — only if enabled */}
              {aiEnabled && !aiAnalysis && (
                <TouchableOpacity style={styles.aiBtn} onPress={handleAnalyzeSession}>
                  <Ionicons name="sparkles" size={16} color="#0f0f12" />
                  <Text style={styles.aiBtnText}>{t('session.analyze_session')}</Text>
                </TouchableOpacity>
              )}
            </View>
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
            <Text style={styles.addSetBtnText}>{t('session.add_set')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Summary Screenshot Modal */}
      <Modal
        visible={showSummary}
        onClose={() => setShowSummary(false)}
        title={session?.name ?? 'Résumé'}
        scrollable
        fullHeight
      >
        <View style={styles.summaryContent}>
          {/* Date + stats */}
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatVal}>{sessionSets.length}</Text>
              <Text style={styles.summaryStatLbl}>séries</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatVal}>{volume.toFixed(0)}</Text>
              <Text style={styles.summaryStatLbl}>kg total</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatVal}>{sections.length}</Text>
              <Text style={styles.summaryStatLbl}>exercices</Text>
            </View>
          </View>

          {/* Exercises + sets */}
          {sections.map((section) => (
            <View key={section.exerciseId} style={styles.summaryExBlock}>
              <Text style={styles.summaryExName}>{section.exerciseName}</Text>
              <View style={styles.summarySetsGrid}>
                {section.data.map((s, i) => (
                  <View key={s.id} style={styles.summarySetChip}>
                    <Text style={styles.summarySetNum}>#{i + 1}</Text>
                    <Text style={styles.summarySetMain}>{s.weight}kg × {s.repetitions}</Text>
                    {s.rpe ? <Text style={styles.summarySetRpe}>RPE {s.rpe}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {sections.length === 0 && (
            <Text style={styles.summaryEmpty}>Aucune série enregistrée</Text>
          )}
        </View>
      </Modal>

      {/* Save as Template Modal */}
      <Modal
        visible={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        title={t('session.save_as_template')}
      >
        <View style={styles.saveTemplateContent}>
          <Text style={styles.saveTemplateHint}>{t('session.save_as_template_hint')}</Text>
          <TextInput
            style={styles.saveTemplateInput}
            value={saveTemplateName}
            onChangeText={setSaveTemplateName}
            placeholder={t('templates.name_placeholder')}
            placeholderTextColor="#3a3a4a"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSaveAsTemplate}
          />
          {sections.length > 0 && (
            <View style={styles.saveTemplateExList}>
              {sections.map((s) => (
                <View key={s.exerciseId} style={styles.saveTemplateExRow}>
                  <Ionicons name="barbell-outline" size={12} color="#7a7a90" />
                  <Text style={styles.saveTemplateExName}>{s.exerciseName}</Text>
                  <Text style={styles.saveTemplateExMeta}>
                    {s.data.filter((x) => x.weight > 0 || x.repetitions > 0).length} {t('workout.sets')}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[styles.saveTemplateBtn, savingTemplate && { opacity: 0.6 }]}
            onPress={handleSaveAsTemplate}
            disabled={savingTemplate}
          >
            <Ionicons name="bookmark" size={16} color="#0f0f12" />
            <Text style={styles.saveTemplateBtnText}>{t('templates.save')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* AI Analysis Modal */}
      <Modal
        visible={showAIAnalysis}
        onClose={() => setShowAIAnalysis(false)}
        title="Analyse IA de la séance"
        scrollable
      >
        <View style={styles.aiModalContent}>
          {isAnalyzing ? (
            <View style={styles.aiLoading}>
              <Ionicons name="sparkles" size={32} color="#c8f060" />
              <Text style={styles.aiLoadingText}>Analyse en cours…</Text>
              <Text style={styles.aiLoadingSubtext}>L'IA compare ta séance avec la précédente</Text>
            </View>
          ) : (
            <>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={16} color="#c8f060" />
                <Text style={styles.aiHeaderText}>Analyse IA</Text>
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
  sectionHeaderWrap: {
    marginTop: 12,
    marginBottom: 4,
    gap: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a22',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  recBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f1a08',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(200,240,96,0.2)',
  },
  recBannerText: {
    flex: 1,
    color: '#a0c050',
    fontSize: 12,
    fontWeight: '600',
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
  footerContainer: { gap: 12, marginTop: 8, marginBottom: 8 },
  aiSavedCard: {
    backgroundColor: '#0f1a08', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(200,240,96,0.2)', gap: 10,
  },
  aiSavedHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(200,240,96,0.1)',
  },
  aiSavedTitle: { color: '#c8f060', fontSize: 13, fontWeight: '700', flex: 1 },
  aiRefreshBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(200,240,96,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  aiSavedText: { color: '#e0e0e0', fontSize: 14, lineHeight: 22 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#c8f060', borderRadius: 14, paddingVertical: 14,
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
  recsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  recsLoadingText: { color: '#3a3a4a', fontSize: 13 },
  summaryContent: { gap: 12 },
  summaryStats: {
    flexDirection: 'row', backgroundColor: '#0f0f12', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#2a2a35', justifyContent: 'space-around',
    marginBottom: 4,
  },
  summaryStat: { alignItems: 'center', gap: 2 },
  summaryStatVal: { color: '#c8f060', fontSize: 20, fontWeight: '800' },
  summaryStatLbl: { color: '#7a7a90', fontSize: 11 },
  summaryStatDivider: { width: 1, backgroundColor: '#2a2a35' },
  summaryExBlock: {
    backgroundColor: '#0f0f12', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35', gap: 8,
  },
  summaryExName: { color: '#c8f060', fontSize: 13, fontWeight: '700' },
  summarySetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  summarySetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1a22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  summarySetNum: { color: '#3a3a4a', fontSize: 10, width: 18 },
  summarySetMain: { color: '#f0f0f0', fontSize: 13, fontWeight: '700' },
  summarySetRpe: { color: '#7a7a90', fontSize: 10, marginLeft: 2 },
  summaryEmpty: { color: '#5a5a70', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  // Save as Template
  saveTemplateContent: { gap: 14 },
  saveTemplateHint: { color: '#7a7a90', fontSize: 13 },
  saveTemplateInput: {
    backgroundColor: '#0f0f12', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 14, paddingVertical: 12,
    color: '#f0f0f0', fontSize: 16,
  },
  saveTemplateExList: {
    backgroundColor: '#0f0f12', borderRadius: 10, borderWidth: 1,
    borderColor: '#2a2a35', padding: 10, gap: 6,
  },
  saveTemplateExRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveTemplateExName: { flex: 1, color: '#c0c0d0', fontSize: 13 },
  saveTemplateExMeta: { color: '#5a5a70', fontSize: 12 },
  saveTemplateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#c8f060', borderRadius: 12, paddingVertical: 14,
  },
  saveTemplateBtnText: { color: '#0f0f12', fontSize: 15, fontWeight: '700' },
});
