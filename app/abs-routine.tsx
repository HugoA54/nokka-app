import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import { useChallengeStore } from '@store/challengeStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useHaptics } from '@hooks/useHaptics';
import { useToast } from '@hooks/useToast';
import {
  getAbsRoutine,
  getAbsSettings,
  hasAbsRoutineToday,
  markAbsRoutineDone,
  unmarkAbsRoutineToday,
  getAbsStreak,
  getAbsTotal,
} from '@services/absRoutine';
import type { AbsExercise, AbsLevel, AbsRoutine } from '@types/index';

const LEVEL_LABEL_KEYS: Record<AbsLevel, string> = {
  beginner: 'abs.level.beginner',
  intermediate: 'abs.level.intermediate',
  advanced: 'abs.level.advanced',
};

function ExerciseRow({
  exercise,
  index,
  checked,
  onToggle,
}: {
  exercise: AbsExercise;
  index: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const startTimer = () => {
    if (intervalRef.current) return;
    setSecondsLeft(exercise.value);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          Vibration.vibrate([0, 300, 100, 300]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsLeft(null);
  };

  const valueLabel =
    exercise.type === 'reps'
      ? `${exercise.value}${exercise.perSide ? ` (${Math.floor(exercise.value / 2)}/${t('abs.player.per_side')})` : ''} ${t('abs.player.reps')}`
      : `${exercise.value}s${exercise.perSide ? `/${t('abs.player.side')}` : ''}`;

  return (
    <View style={[styles.row, checked && styles.rowChecked]}>
      <TouchableOpacity
        style={[styles.checkbox, checked && styles.checkboxChecked]}
        onPress={onToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {checked && <Ionicons name="checkmark" size={16} color="#0f0f12" />}
      </TouchableOpacity>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, checked && styles.rowNameChecked]}>
          {index + 1}. {t(exercise.nameKey)}
        </Text>
        <Text style={styles.rowMeta}>
          {exercise.sets} × {valueLabel}
        </Text>
      </View>
      {exercise.type === 'time' && (
        secondsLeft === null ? (
          <TouchableOpacity style={styles.timerBtn} onPress={startTimer}>
            <Ionicons name="play" size={14} color="#0f0f12" />
            <Text style={styles.timerBtnText}>{exercise.value}s</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.timerBtn, secondsLeft === 0 ? styles.timerBtnDone : styles.timerBtnActive]}
            onPress={stopTimer}
          >
            <Text style={styles.timerBtnText}>
              {secondsLeft === 0 ? '✓' : `${secondsLeft}s`}
            </Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

export default function AbsRoutineScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const haptics = useHaptics();
  const toast = useToast();
  const { evaluateAll } = useChallengeStore();

  const [routine, setRoutine] = useState<AbsRoutine | null>(null);
  const [level, setLevel] = useState<AbsLevel>('beginner');
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const settings = await getAbsSettings();
        setLevel(settings.level);
        setRoutine(getAbsRoutine(settings.level));
        setDone(await hasAbsRoutineToday());
        setStreak(await getAbsStreak());
      })();
    }, [])
  );

  const toggleExercise = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    haptics.light();
  };

  const handleFinish = async () => {
    if (submitting || done) return;
    setSubmitting(true);
    setDone(true);
    try {
      await markAbsRoutineDone();
      const newStreak = await getAbsStreak();
      const newTotal = await getAbsTotal();
      setStreak(newStreak);

      const state = useWorkoutStore.getState();
      await evaluateAll({
        sessionSets: [],
        allSets: state.sets,
        sessions: state.sessions,
        exercises: state.exercises,
        currentSessionId: null,
        getPersonalRecord: state.getPersonalRecord,
        getStreakWeeks: state.getStreakWeeks,
        absStreak: newStreak,
        absTotal: newTotal,
      });
      await haptics.success();
      toast.success(t('abs.player.completed_toast'));
    } catch {
      setDone(false);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndo = async () => {
    setSubmitting(true);
    try {
      await unmarkAbsRoutineToday();
      setDone(false);
      setStreak(await getAbsStreak());
      setChecked(new Set());
      await haptics.light();
    } finally {
      setSubmitting(false);
    }
  };

  if (!routine) return null;

  const allChecked = routine.exercises.every((e) => checked.has(e.id));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.levelLabel}>{t(LEVEL_LABEL_KEYS[level])}</Text>
          <Text style={styles.headerTitle}>{t('abs.player.title')}</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={14} color="#f0a060" />
            <Text style={styles.streakText}>{streak} {t('abs.player.day_streak')}</Text>
          </View>
        )}
      </View>

      {done && (
        <View style={styles.doneBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#60f090" />
          <Text style={styles.doneBannerText}>{t('abs.player.done_today')}</Text>
        </View>
      )}

      <View style={styles.list}>
        {routine.exercises.map((ex, idx) => (
          <ExerciseRow
            key={ex.id}
            exercise={ex}
            index={idx}
            checked={checked.has(ex.id)}
            onToggle={() => toggleExercise(ex.id)}
          />
        ))}
      </View>

      {!done ? (
        <TouchableOpacity
          style={[styles.finishBtn, (!allChecked || submitting) && styles.finishBtnDim]}
          onPress={handleFinish}
          disabled={submitting}
        >
          <Ionicons name="checkmark-circle" size={20} color="#0f0f12" />
          <Text style={styles.finishBtnText}>
            {allChecked ? t('abs.player.finish') : t('abs.player.finish_force')}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.undoBtn}
          onPress={handleUndo}
          disabled={submitting}
        >
          <Text style={styles.undoBtnText}>{t('abs.player.undo')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { gap: 4 },
  levelLabel: { color: '#f060a8', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  headerTitle: { color: '#f0f0f0', fontSize: 24, fontWeight: '800' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(240,160,96,0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  streakText: { color: '#f0a060', fontSize: 12, fontWeight: '700' },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(96,240,144,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,240,144,0.3)',
  },
  doneBannerText: { color: '#60f090', fontSize: 13, fontWeight: '600' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  rowChecked: {
    backgroundColor: '#12181a',
    borderColor: '#1a3a1a',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#3a3a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#60f090',
    borderColor: '#60f090',
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  rowNameChecked: { color: '#7a7a90', textDecorationLine: 'line-through' },
  rowMeta: { color: '#7a7a90', fontSize: 12 },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#c8f060',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 56,
    justifyContent: 'center',
  },
  timerBtnActive: { backgroundColor: '#f0a060' },
  timerBtnDone: { backgroundColor: '#60f090' },
  timerBtnText: { color: '#0f0f12', fontWeight: '700', fontSize: 12 },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f060a8',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  finishBtnDim: { opacity: 0.7 },
  finishBtnText: { color: '#0f0f12', fontSize: 15, fontWeight: '700' },
  undoBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  undoBtnText: { color: '#7a7a90', fontSize: 13, fontWeight: '600' },
});
