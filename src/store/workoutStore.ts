import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@services/supabase';
import { enqueue, dequeueAll, clearQueue } from '@services/offlineQueue';
import { calculate1RM, calculateDailyMetrics } from '@services/calorieCalculations';
import { showRestTimerNotification, cancelRestTimerNotifications } from '@services/timerNotifications';
import type {
  Exercise,
  Session,
  WorkoutSet,
  PersonalRecord,
  ExerciseProgressionPoint,
  MuscleDistribution,
  HeatmapEntry,
  UserProfile,
  DailyMetrics,
} from '@types/index';

const REST_TIMER_KEY = 'nokka_rest_end_time';
const AUTO_START_TIMER_KEY = 'nokka_auto_start_timer';

interface WorkoutState {
  // Data
  exercises: Exercise[];
  sessions: Session[];
  sets: WorkoutSet[];
  userProfile: UserProfile | null;
  selectedExercise: Exercise | null;
  currentSession: Session | null;

  // Rest Timer
  restDuration: number;            // seconds
  restEndTime: number | null;      // epoch ms
  isRestTimerActive: boolean;

  // Loading
  isLoadingExercises: boolean;
  isLoadingSessions: boolean;
  isLoadingSets: boolean;

  // Offline
  isOnline: boolean;
  pendingCount: number;
  setOnline: (v: boolean) => void;
  flushOfflineQueue: (userId: string) => Promise<void>;

  // Actions – Exercises
  loadExercises: () => Promise<void>;

  // Actions – Sessions
  loadSessions: (userId: string) => Promise<void>;
  createNewSession: (userId: string, name?: string) => Promise<Session>;
  createSessionFromTemplate: (userId: string, templateName: string) => Promise<Session>;
  openSession: (session: Session) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, patch: Partial<Session>) => Promise<void>;
  startRoutine: (userId: string, routineName: string) => Promise<Session>;

  // Actions – Sets
  loadSets: (sessionId: string) => Promise<void>;
  addSetToSession: (set: Omit<WorkoutSet, 'id' | 'created_at'>) => Promise<void>;
  updateSet: (setId: string, patch: Partial<WorkoutSet>) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;

  // Actions – Profile
  loadUserProfile: (userId: string) => Promise<void>;
  updateUserProfile: (profileData: Partial<UserProfile>) => Promise<void>;

  // Actions – Rest Timer
  autoStartTimer: boolean;
  toggleAutoStartTimer: () => Promise<void>;
  loadAutoStartTimer: () => Promise<void>;
  startRestTimer: (duration: number) => Promise<void>;
  clearRestTimer: () => Promise<void>;
  resumeRestTimer: () => Promise<void>;

  // Actions – Derived Stats
  setSelectedExercise: (exercise: Exercise | null) => void;
  calculate1RMForSet: (weight: number, reps: number) => number;
  getLastPerformance: (exerciseId: string) => WorkoutSet | null;
  getLastSessionSetsForExercise: (exerciseId: string, excludeSessionId?: string) => WorkoutSet[];
  getExerciseProgressionData: (exerciseId: string) => ExerciseProgressionPoint[];
  getPersonalRecord: (exerciseId: string) => PersonalRecord | null;
  getMuscleDistribution: () => MuscleDistribution[];
  getStreakWeeks: () => number;
  getYearHeatmapData: () => HeatmapEntry[];
  getDailyMetrics: (todaySets: WorkoutSet[]) => DailyMetrics | null;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  exercises: [],
  sessions: [],
  sets: [],
  userProfile: null,
  selectedExercise: null,
  currentSession: null,
  restDuration: 90,
  restEndTime: null,
  isRestTimerActive: false,
  autoStartTimer: false,
  isLoadingExercises: false,
  isLoadingSessions: false,
  isLoadingSets: false,
  isOnline: true,
  pendingCount: 0,

  setOnline: (v: boolean) => set({ isOnline: v }),

  flushOfflineQueue: async (userId: string) => {
    const ops = await dequeueAll();
    if (ops.length === 0) return;

    const addOps = ops.filter((o) => o.type === 'addSet') as Extract<typeof ops[number], { type: 'addSet' }>[];
    const deleteOps = ops.filter((o) => o.type === 'deleteSet') as Extract<typeof ops[number], { type: 'deleteSet' }>[];

    try {
      // Batch insert all queued sets in one request
      if (addOps.length > 0) {
        const rows = addOps.map((o) => {
          const { exercise: _ex, ...insertData } = o.payload as any;
          return { ...insertData, display_weight: insertData.weight };
        });
        const { data } = await supabase.from('sets').insert(rows).select('id, created_at');
        if (data) {
          // Map each returned row back to its temp ID by insertion order
          data.forEach((row, i) => {
            const tempId = addOps[i].tempId;
            set((state) => ({
              sets: state.sets.map((s) =>
                s.id === tempId ? { ...s, id: row.id, created_at: row.created_at } : s
              ),
            }));
          });
        }
      }

      // Batch delete all queued sets in one request
      if (deleteOps.length > 0) {
        const ids = deleteOps.map((o) => o.payload.setId);
        await supabase.from('sets').delete().in('id', ids);
      }
    } catch (e) {
      console.error('[workoutStore] flushOfflineQueue error:', e);
    }

    await clearQueue();
    set({ pendingCount: 0 });
  },

  // ── Exercises ──────────────────────────────────────────────────────────────

  loadExercises: async () => {
    set({ isLoadingExercises: true });
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');
      if (error) throw error;
      set({ exercises: data ?? [] });
    } catch (error) {
      console.error('[workoutStore] loadExercises:', error);
    } finally {
      set({ isLoadingExercises: false });
    }
  },

  // ── Sessions ───────────────────────────────────────────────────────────────

  loadSessions: async (userId: string) => {
    set({ isLoadingSessions: true });
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (error) throw error;
      const sessions = data ?? [];
      set({ sessions });
      // Only load sets for the 50 most recent sessions — covers all practical use cases
      // (last performance, stats, heatmap). Older data is loaded on demand via loadSets().
      const recentIds = sessions.slice(0, 50).map((s: Session) => s.id);
      if (recentIds.length > 0) {
        const { data: setsData } = await supabase
          .from('sets')
          .select('*, exercise:exercises(*)')
          .in('session_id', recentIds)
          .order('created_at');
        if (setsData) set({ sets: setsData });
      }
    } catch (error) {
      console.error('[workoutStore] loadSessions:', error);
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  createNewSession: async (userId: string, name?: string) => {
    const today = new Date().toLocaleDateString('en-CA');
    const sessionName = name ?? `Session ${today}`;
    const { data, error } = await supabase
      .from('sessions')
      .insert({ user_id: userId, date: today, name: sessionName })
      .select()
      .single();
    if (error) throw error;
    const newSession = data as Session;
    set((state) => ({ sessions: [newSession, ...state.sessions], currentSession: newSession }));
    return newSession;
  },

  openSession: (session: Session) => {
    set({ currentSession: session });
  },

  deleteSession: async (sessionId: string) => {
    // Optimistic update — remove immediately from UI
    const prev = get().sessions;
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      sets: state.sets.filter((s) => s.session_id !== sessionId),
      currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
    }));
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
    if (error) {
      set({ sessions: prev }); // rollback
      throw error;
    }
  },

  updateSession: async (sessionId: string, patch: Partial<Session>) => {
    const { error } = await supabase
      .from('sessions')
      .update(patch)
      .eq('id', sessionId);
    if (error) throw error;
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)),
      currentSession:
        state.currentSession?.id === sessionId
          ? { ...state.currentSession, ...patch }
          : state.currentSession,
    }));
  },

  createSessionFromTemplate: async (userId: string, templateName: string): Promise<Session> => {
    const { sessions } = get();
    // Find the most recent session with that name (before creating the new one)
    const templateSession = sessions
      .filter((s) => s.name === templateName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    // Create the new session
    const newSession = await get().createNewSession(userId, templateName);

    if (!templateSession) return newSession;

    // Fetch the template session's sets directly from DB (don't rely on local store)
    const { data: templateSets } = await supabase
      .from('sets')
      .select('exercise_id')
      .eq('session_id', templateSession.id)
      .order('created_at');

    if (!templateSets || templateSets.length === 0) return newSession;

    // Get unique exercises in chronological order of first appearance
    const seen = new Set<string>();
    const exerciseIds: string[] = [];
    for (const s of templateSets) {
      const eid = String(s.exercise_id);
      if (!seen.has(eid)) { seen.add(eid); exerciseIds.push(eid); }
    }

    // Batch insert all placeholder sets in one query
    const placeholders = exerciseIds.map((exerciseId) => ({
      session_id: newSession.id,
      exercise_id: exerciseId,
      weight: 0,
      display_weight: 0,
      repetitions: 0,
      rpe: null,
      note: null,
    }));
    const { data: insertedSets } = await supabase.from('sets').insert(placeholders).select('*');
    if (insertedSets) {
      const { exercises } = get();
      const enriched = insertedSets.map((s) => ({
        ...s,
        exercise: exercises.find((e) => String(e.id) === String(s.exercise_id)) ?? null,
      }));
      set((state) => ({ sets: [...state.sets, ...enriched] }));
    }

    return newSession;
  },

  startRoutine: async (userId: string, routineName: string) => {
    const { sessions, sets } = get();
    // Find last session that matches the routine name
    const previousSession = sessions.find((s) => s.name === routineName);
    const newSession = await get().createNewSession(userId, routineName);
    if (previousSession) {
      // Copy exercises (not sets) from previous session
      const prevSets = sets.filter((s) => s.session_id === previousSession.id);
      const uniqueExerciseIds = [...new Set(prevSets.map((s) => s.exercise_id))];
      // We don't copy actual set data – just open the session with context
      console.log(`[workoutStore] Routine started with ${uniqueExerciseIds.length} exercises from previous session`);
    }
    return newSession;
  },

  // ── Sets ───────────────────────────────────────────────────────────────────

  loadSets: async (sessionId: string) => {
    set({ isLoadingSets: true });
    try {
      const { data, error } = await supabase
        .from('sets')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at');
      if (error) throw error;
      // Enrich with local exercises (no DB join needed)
      const { exercises } = get();
      const enriched = (data ?? []).map((s) => ({
        ...s,
        exercise: exercises.find((e) => String(e.id) === String(s.exercise_id)) ?? null,
      }));
      set((state) => ({
        sets: [
          ...state.sets.filter((s) => String(s.session_id) !== String(sessionId)),
          ...enriched,
        ],
      }));
    } catch (error) {
      console.error('[workoutStore] loadSets:', error);
    } finally {
      set({ isLoadingSets: false });
    }
  },

  addSetToSession: async (setData: Omit<WorkoutSet, 'id' | 'created_at'>) => {
    const { exercise: _ex, ...insertData } = setData as any;
    const dbData = { ...insertData, display_weight: insertData.weight };

    // Optimistic: add immediately with a temp id using local exercise data
    const localExercise = get().exercises.find((e) => String(e.id) === String(insertData.exercise_id));
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticSet: WorkoutSet = {
      ...insertData,
      id: tempId,
      created_at: new Date().toISOString(),
      exercise: localExercise ?? null,
    } as any;
    set((state) => ({ sets: [...state.sets, optimisticSet] }));

    // If offline, queue the op and keep the optimistic state
    if (!get().isOnline) {
      await enqueue({ type: 'addSet', payload: insertData, tempId });
      set((state) => ({ pendingCount: state.pendingCount + 1 }));
      return;
    }

    // Only fetch id + created_at — exercise is already in local state
    const { data, error } = await supabase
      .from('sets')
      .insert(dbData)
      .select('id, created_at')
      .single();
    if (error) {
      set((state) => ({ sets: state.sets.filter((s) => s.id !== tempId) }));
      throw error;
    }
    // Replace temp id with real DB id, keep local exercise reference
    set((state) => ({
      sets: state.sets.map((s) =>
        s.id === tempId ? { ...optimisticSet, id: data.id, created_at: data.created_at } : s
      ),
    }));
  },

  updateSet: async (setId: string, patch: Partial<WorkoutSet>) => {
    // Optimistic: update UI immediately, rollback on error
    const prev = get().sets;
    const dbPatch = { ...patch } as any;
    if (dbPatch.weight !== undefined) dbPatch.display_weight = dbPatch.weight;
    set((state) => ({
      sets: state.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    }));
    const { error } = await supabase.from('sets').update(dbPatch).eq('id', setId);
    if (error) {
      set({ sets: prev });
      throw error;
    }
  },

  deleteSet: async (setId: string) => {
    // Optimistic update
    const prev = get().sets;
    set((state) => ({ sets: state.sets.filter((s) => s.id !== setId) }));

    // If offline, queue the op and keep the optimistic deletion
    if (!get().isOnline) {
      await enqueue({ type: 'deleteSet', payload: { setId } });
      set((state) => ({ pendingCount: state.pendingCount + 1 }));
      return;
    }

    const { error } = await supabase.from('sets').delete().eq('id', setId);
    if (error) {
      set({ sets: prev }); // rollback
      throw error;
    }
  },

  // ── Profile ────────────────────────────────────────────────────────────────

  loadUserProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) {
        // Create default profile
        const defaultProfile: Omit<UserProfile, 'id'> = {
          user_id: userId,
          weight: 75,
          height: 175,
          age: 25,
          gender: 'male',
          activity_level: 'moderate',
          goal: 'maintain',
          use_auto_calculation: true,
          manual_calorie_goal: null,
        };
        const { data: created, error: createError } = await supabase
          .from('user_profiles')
          .insert(defaultProfile)
          .select()
          .single();
        if (createError) throw createError;
        set({ userProfile: created as UserProfile });
      } else {
        set({ userProfile: data as UserProfile });
      }
    } catch (error) {
      console.error('[workoutStore] loadUserProfile:', error);
    }
  },

  updateUserProfile: async (profileData: Partial<UserProfile>) => {
    const { userProfile } = get();
    if (!userProfile) return;
    const { error } = await supabase
      .from('user_profiles')
      .update(profileData)
      .eq('id', userProfile.id);
    if (error) throw error;
    set({ userProfile: { ...userProfile, ...profileData } });
  },

  // ── Rest Timer ─────────────────────────────────────────────────────────────

  loadAutoStartTimer: async () => {
    const stored = await AsyncStorage.getItem(AUTO_START_TIMER_KEY);
    set({ autoStartTimer: stored === 'true' });
  },

  toggleAutoStartTimer: async () => {
    const next = !get().autoStartTimer;
    set({ autoStartTimer: next });
    await AsyncStorage.setItem(AUTO_START_TIMER_KEY, String(next));
  },

  startRestTimer: async (duration: number) => {
    const endTime = Date.now() + duration * 1000;
    await AsyncStorage.setItem(REST_TIMER_KEY, String(endTime));
    set({ restDuration: duration, restEndTime: endTime, isRestTimerActive: true });
    try { await showRestTimerNotification(duration); } catch {}
  },

  clearRestTimer: async () => {
    await AsyncStorage.removeItem(REST_TIMER_KEY);
    set({ restEndTime: null, isRestTimerActive: false });
    cancelRestTimerNotifications().catch(() => {});
  },

  resumeRestTimer: async () => {
    try {
      // Also restore auto-start preference
      const autoStart = await AsyncStorage.getItem(AUTO_START_TIMER_KEY);
      if (autoStart !== null) set({ autoStartTimer: autoStart === 'true' });

      const stored = await AsyncStorage.getItem(REST_TIMER_KEY);
      if (stored) {
        const endTime = Number(stored);
        if (endTime > Date.now()) {
          set({ restEndTime: endTime, isRestTimerActive: true });
        } else {
          await AsyncStorage.removeItem(REST_TIMER_KEY);
        }
      }
    } catch (error) {
      console.error('[workoutStore] resumeRestTimer:', error);
    }
  },

  // ── Derived Stats ──────────────────────────────────────────────────────────

  setSelectedExercise: (exercise: Exercise | null) => set({ selectedExercise: exercise }),

  calculate1RMForSet: (weight: number, reps: number) => calculate1RM(weight, reps),

  getLastPerformance: (exerciseId: string) => {
    const { sets } = get();
    const exerciseSets = sets
      .filter((s) => String(s.exercise_id) === String(exerciseId) && (s.weight > 0 || s.repetitions > 0))
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return exerciseSets[0] ?? null;
  },

  getLastSessionSetsForExercise: (exerciseId: string, excludeSessionId?: string) => {
    const { sets, sessions } = get();
    // Exclude placeholder sets (weight=0 AND reps=0 are template placeholders)
    const exerciseSets = sets.filter(
      (s) =>
        String(s.exercise_id) === String(exerciseId) &&
        (s.weight > 0 || s.repetitions > 0) &&
        (!excludeSessionId || String(s.session_id) !== String(excludeSessionId))
    );
    if (exerciseSets.length === 0) return [];
    // Find the most recent session_id that contains this exercise
    const sessionIds = [...new Set(exerciseSets.map((s) => s.session_id))];
    const lastSession = sessions
      .filter((s) => sessionIds.includes(s.id) || sessionIds.map(String).includes(String(s.id)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    if (!lastSession) return [];
    return exerciseSets
      .filter((s) => String(s.session_id) === String(lastSession.id))
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
  },

  getExerciseProgressionData: (exerciseId: string): ExerciseProgressionPoint[] => {
    const { sets } = get();
    const exerciseSets = sets
      .filter((s) => s.exercise_id === exerciseId)
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    return exerciseSets.map((s) => ({
      date: s.created_at?.split('T')[0] ?? '',
      weight: s.weight,
      repetitions: s.repetitions,
      estimated_1rm: calculate1RM(s.weight, s.repetitions),
    }));
  },

  getPersonalRecord: (exerciseId: string): PersonalRecord | null => {
    const { sets, exercises } = get();
    const exerciseSets = sets.filter((s) => s.exercise_id === exerciseId);
    if (exerciseSets.length === 0) return null;
    const best = exerciseSets.reduce((prev, curr) => {
      const prev1RM = calculate1RM(prev.weight, prev.repetitions);
      const curr1RM = calculate1RM(curr.weight, curr.repetitions);
      return curr1RM > prev1RM ? curr : prev;
    });
    const exercise = exercises.find((e) => e.id === exerciseId);
    return {
      exercise_id: exerciseId,
      exercise_name: exercise?.name ?? 'Unknown',
      weight: best.weight,
      repetitions: best.repetitions,
      estimated_1rm: calculate1RM(best.weight, best.repetitions),
      date: best.created_at?.split('T')[0] ?? '',
    };
  },

  getMuscleDistribution: (): MuscleDistribution[] => {
    const { sets, exercises } = get();
    const counts: Partial<Record<string, number>> = {};
    let total = 0;
    for (const s of sets) {
      const exercise = exercises.find((e) => e.id === s.exercise_id);
      if (exercise) {
        counts[exercise.muscle_group] = (counts[exercise.muscle_group] ?? 0) + 1;
        total++;
      }
    }
    return Object.entries(counts).map(([muscle_group, set_count]) => ({
      muscle_group: muscle_group as any,
      set_count: set_count ?? 0,
      percentage: total > 0 ? Math.round(((set_count ?? 0) / total) * 100) : 0,
    }));
  },

  getStreakWeeks: (): number => {
    const { sessions } = get();
    if (sessions.length === 0) return 0;
    const weekSet = new Set(
      sessions.map((s) => {
        const d = new Date(s.date);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      })
    );
    const sortedWeeks = [...weekSet].sort((a, b) => b - a);
    let streak = 1;
    for (let i = 0; i < sortedWeeks.length - 1; i++) {
      if (sortedWeeks[i] - sortedWeeks[i + 1] === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  getYearHeatmapData: (): HeatmapEntry[] => {
    const { sessions, sets } = get();
    const map: Record<string, HeatmapEntry> = {};
    for (const session of sessions) {
      const sessionSets = sets.filter((s) => s.session_id === session.id);
      const volume = sessionSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);
      if (map[session.date]) {
        map[session.date].volume += volume;
        map[session.date].count += sessionSets.length;
      } else {
        map[session.date] = { date: session.date, volume, count: sessionSets.length };
      }
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  },

  getDailyMetrics: (todaySets: WorkoutSet[]): DailyMetrics | null => {
    const { userProfile, exercises } = get();
    if (!userProfile) return null;
    const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]));
    return calculateDailyMetrics(userProfile, todaySets, exerciseById);
  },
}));
