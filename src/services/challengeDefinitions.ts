import { calculate1RM } from '@services/calorieCalculations';
import type { ChallengeDefinition, ChallengeEvalData } from '@types/index';

const UPPER_BODY = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']);
const LOWER_BODY = new Set(['legs', 'glutes']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getISOWeekYear(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return `${d.getUTCFullYear()}-W${getISOWeek(date)}`;
}

function findMuscle(exerciseId: string, exercises: ChallengeEvalData['exercises']): string | undefined {
  return exercises.find((e) => String(e.id) === String(exerciseId))?.muscle_group;
}

function distinctMuscles(sets: ChallengeEvalData['sessionSets'], exercises: ChallengeEvalData['exercises'], filter?: Set<string>): number {
  const muscles = new Set(
    sets.map((s) => findMuscle(s.exercise_id, exercises)).filter((m): m is string => !!m && (!filter || filter.has(m)))
  );
  return muscles.size;
}

function totalVolume(sets: { weight: number; repetitions: number }[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);
}

function totalReps(sets: { repetitions: number }[]): number {
  return sets.reduce((sum, s) => sum + s.repetitions, 0);
}

function distinctExercises(sets: { exercise_id: string }[]): number {
  return new Set(sets.map((s) => s.exercise_id)).size;
}

function countPRs(sessionSets: ChallengeEvalData['sessionSets'], allSets: ChallengeEvalData['allSets'], currentSessionId: string | null): number {
  if (!currentSessionId) return 0;
  const exerciseIds = [...new Set(sessionSets.map((s) => s.exercise_id))];
  let prs = 0;
  for (const exId of exerciseIds) {
    const bestPrev = allSets
      .filter((s) => String(s.exercise_id) === String(exId) && String(s.session_id) !== String(currentSessionId))
      .reduce((best, s) => Math.max(best, calculate1RM(s.weight, s.repetitions)), 0);
    const bestThis = sessionSets
      .filter((s) => String(s.exercise_id) === String(exId))
      .reduce((best, s) => Math.max(best, calculate1RM(s.weight, s.repetitions)), 0);
    if (bestThis > bestPrev) prs++;
  }
  return prs;
}

function weekSessionIds(sessions: ChallengeEvalData['sessions']): Set<string> {
  const week = getISOWeekYear(new Date());
  return new Set(sessions.filter((s) => getISOWeekYear(new Date(s.date)) === week).map((s) => s.id));
}

function weekSets(allSets: ChallengeEvalData['allSets'], sessions: ChallengeEvalData['sessions']) {
  const ids = weekSessionIds(sessions);
  return allSets.filter((s) => ids.has(s.session_id));
}

// ── Seeded shuffle for deterministic daily/weekly rotation ────────────────────

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ── SESSION CHALLENGE POOL (daily rotation: 4 picked per day) ────────────────

const SESSION_POOL: ChallengeDefinition[] = [
  {
    id: 'ses_vol_5k', category: 'session', title: '5 000kg de volume',
    description: 'Atteins 5 000kg de volume total', icon: 'barbell-outline',
    target: 5000, unit: 'kg', color: '#c8f060',
    evaluate: ({ sessionSets }) => totalVolume(sessionSets),
  },
  {
    id: 'ses_vol_8k', category: 'session', title: '8 000kg de volume',
    description: 'Atteins 8 000kg de volume total', icon: 'barbell-outline',
    target: 8000, unit: 'kg', color: '#c8f060',
    evaluate: ({ sessionSets }) => totalVolume(sessionSets),
  },
  {
    id: 'ses_vol_12k', category: 'session', title: '12 000kg de volume',
    description: 'Atteins 12 000kg de volume en une séance', icon: 'barbell-outline',
    target: 12000, unit: 'kg', color: '#c8f060',
    evaluate: ({ sessionSets }) => totalVolume(sessionSets),
  },
  {
    id: 'ses_sets_15', category: 'session', title: '15 séries',
    description: 'Complète 15 séries dans cette séance', icon: 'layers-outline',
    target: 15, unit: 'séries', color: '#60d4f0',
    evaluate: ({ sessionSets }) => sessionSets.length,
  },
  {
    id: 'ses_sets_20', category: 'session', title: '20 séries',
    description: 'Complète 20 séries dans cette séance', icon: 'layers-outline',
    target: 20, unit: 'séries', color: '#60d4f0',
    evaluate: ({ sessionSets }) => sessionSets.length,
  },
  {
    id: 'ses_sets_25', category: 'session', title: '25 séries',
    description: 'Complète 25 séries — séance monstre !', icon: 'layers-outline',
    target: 25, unit: 'séries', color: '#60d4f0',
    evaluate: ({ sessionSets }) => sessionSets.length,
  },
  {
    id: 'ses_pr_1', category: 'session', title: 'Bats un PR',
    description: 'Établis un nouveau record personnel', icon: 'trophy-outline',
    target: 1, unit: 'PR', color: '#f0c060',
    evaluate: ({ sessionSets, allSets, currentSessionId }) => countPRs(sessionSets, allSets, currentSessionId),
  },
  {
    id: 'ses_pr_2', category: 'session', title: 'Bats 2 PRs',
    description: 'Établis 2 records personnels dans la même séance', icon: 'trophy-outline',
    target: 2, unit: 'PRs', color: '#f0c060',
    evaluate: ({ sessionSets, allSets, currentSessionId }) => countPRs(sessionSets, allSets, currentSessionId),
  },
  {
    id: 'ses_upper', category: 'session', title: 'Haut du corps complet',
    description: 'Entraîne 3 muscles du haut du corps distincts', icon: 'body-outline',
    target: 3, unit: 'muscles', color: '#f060a8',
    evaluate: ({ sessionSets, exercises }) => distinctMuscles(sessionSets, exercises, UPPER_BODY),
  },
  {
    id: 'ses_lower', category: 'session', title: 'Leg day',
    description: 'Entraîne jambes et fessiers', icon: 'walk-outline',
    target: 2, unit: 'muscles', color: '#a060f0',
    evaluate: ({ sessionSets, exercises }) => distinctMuscles(sessionSets, exercises, LOWER_BODY),
  },
  {
    id: 'ses_fullbody', category: 'session', title: 'Full body',
    description: 'Entraîne au moins 4 groupes musculaires différents', icon: 'fitness-outline',
    target: 4, unit: 'muscles', color: '#60f0d0',
    evaluate: ({ sessionSets, exercises }) => distinctMuscles(sessionSets, exercises),
  },
  {
    id: 'ses_variety_5', category: 'session', title: '5 exercices différents',
    description: 'Fais au moins 5 exercices distincts', icon: 'grid-outline',
    target: 5, unit: 'exercices', color: '#d0f060',
    evaluate: ({ sessionSets }) => distinctExercises(sessionSets),
  },
  {
    id: 'ses_variety_3', category: 'session', title: '3 exercices différents',
    description: 'Fais au moins 3 exercices distincts', icon: 'grid-outline',
    target: 3, unit: 'exercices', color: '#d0f060',
    evaluate: ({ sessionSets }) => distinctExercises(sessionSets),
  },
  {
    id: 'ses_reps_100', category: 'session', title: '100 reps totales',
    description: 'Accumule 100 répétitions dans cette séance', icon: 'repeat-outline',
    target: 100, unit: 'reps', color: '#60a0f0',
    evaluate: ({ sessionSets }) => totalReps(sessionSets),
  },
  {
    id: 'ses_reps_150', category: 'session', title: '150 reps totales',
    description: 'Accumule 150 répétitions — endurance !', icon: 'repeat-outline',
    target: 150, unit: 'reps', color: '#60a0f0',
    evaluate: ({ sessionSets }) => totalReps(sessionSets),
  },
  {
    id: 'ses_heavy', category: 'session', title: 'Série lourde',
    description: 'Fais au moins une série de 5 reps ou moins', icon: 'flash-outline',
    target: 1, unit: 'série', color: '#f07040',
    evaluate: ({ sessionSets }) => sessionSets.filter((s) => s.repetitions > 0 && s.repetitions <= 5).length > 0 ? 1 : 0,
  },
  {
    id: 'ses_endurance', category: 'session', title: 'Série endurance',
    description: 'Fais au moins une série de 12+ reps', icon: 'pulse-outline',
    target: 1, unit: 'série', color: '#40c0a0',
    evaluate: ({ sessionSets }) => sessionSets.filter((s) => s.repetitions >= 12).length > 0 ? 1 : 0,
  },
  {
    id: 'ses_focused', category: 'session', title: 'Focus musculaire',
    description: 'Fais 4+ séries sur un même exercice', icon: 'locate-outline',
    target: 1, unit: 'exercice', color: '#e0a040',
    evaluate: ({ sessionSets }) => {
      const counts = new Map<string, number>();
      sessionSets.forEach((s) => counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1));
      return [...counts.values()].some((c) => c >= 4) ? 1 : 0;
    },
  },
  {
    id: 'ses_rpe_control', category: 'session', title: 'Séance contrôlée',
    description: 'Renseigne le RPE sur au moins 5 séries', icon: 'speedometer-outline',
    target: 5, unit: 'séries', color: '#80d0f0',
    evaluate: ({ sessionSets }) => sessionSets.filter((s) => s.rpe != null && s.rpe > 0).length,
  },
  {
    id: 'ses_core', category: 'session', title: 'Abdos au programme',
    description: 'Inclus au moins un exercice de gainage/abdos', icon: 'shield-outline',
    target: 1, unit: 'exercice', color: '#e06080',
    evaluate: ({ sessionSets, exercises }) => distinctMuscles(sessionSets, exercises, new Set(['core'])),
  },
];

// ── WEEKLY CHALLENGE POOL (weekly rotation: 3 picked per week) ───────────────

const WEEKLY_POOL: ChallengeDefinition[] = [
  {
    id: 'wk_sess_3', category: 'weekly', title: '3 séances cette semaine',
    description: 'Complète 3 séances d\'entraînement', icon: 'calendar-outline',
    target: 3, unit: 'séances', color: '#c8f060',
    evaluate: ({ sessions }) => weekSessionIds(sessions).size,
  },
  {
    id: 'wk_sess_4', category: 'weekly', title: '4 séances cette semaine',
    description: 'Complète 4 séances — régularité !', icon: 'calendar-outline',
    target: 4, unit: 'séances', color: '#c8f060',
    evaluate: ({ sessions }) => weekSessionIds(sessions).size,
  },
  {
    id: 'wk_sess_5', category: 'weekly', title: '5 séances cette semaine',
    description: 'Semaine intense : 5 séances !', icon: 'calendar-outline',
    target: 5, unit: 'séances', color: '#c8f060',
    evaluate: ({ sessions }) => weekSessionIds(sessions).size,
  },
  {
    id: 'wk_pr_1', category: 'weekly', title: '1 PR cette semaine',
    description: 'Bats au moins 1 record personnel cette semaine', icon: 'trending-up-outline',
    target: 1, unit: 'PR', color: '#f0c060',
    evaluate: ({ sessions, allSets }) => {
      const ids = weekSessionIds(sessions);
      const thisWeek = allSets.filter((s) => ids.has(s.session_id));
      const prev = allSets.filter((s) => !ids.has(s.session_id));
      const exerciseIds = [...new Set(thisWeek.map((s) => s.exercise_id))];
      let prs = 0;
      for (const exId of exerciseIds) {
        const bp = prev.filter((s) => String(s.exercise_id) === String(exId)).reduce((b, s) => Math.max(b, calculate1RM(s.weight, s.repetitions)), 0);
        const bt = thisWeek.filter((s) => String(s.exercise_id) === String(exId)).reduce((b, s) => Math.max(b, calculate1RM(s.weight, s.repetitions)), 0);
        if (bt > bp) prs++;
      }
      return prs;
    },
  },
  {
    id: 'wk_pr_3', category: 'weekly', title: '3 PRs cette semaine',
    description: 'Bats 3 records personnels en une semaine', icon: 'trending-up-outline',
    target: 3, unit: 'PRs', color: '#f0c060',
    evaluate: ({ sessions, allSets }) => {
      const ids = weekSessionIds(sessions);
      const thisWeek = allSets.filter((s) => ids.has(s.session_id));
      const prev = allSets.filter((s) => !ids.has(s.session_id));
      const exerciseIds = [...new Set(thisWeek.map((s) => s.exercise_id))];
      let prs = 0;
      for (const exId of exerciseIds) {
        const bp = prev.filter((s) => String(s.exercise_id) === String(exId)).reduce((b, s) => Math.max(b, calculate1RM(s.weight, s.repetitions)), 0);
        const bt = thisWeek.filter((s) => String(s.exercise_id) === String(exId)).reduce((b, s) => Math.max(b, calculate1RM(s.weight, s.repetitions)), 0);
        if (bt > bp) prs++;
      }
      return prs;
    },
  },
  {
    id: 'wk_vol_15k', category: 'weekly', title: '15 000kg cette semaine',
    description: 'Accumule 15 000kg de volume total', icon: 'flash-outline',
    target: 15000, unit: 'kg', color: '#60d4f0',
    evaluate: ({ sessions, allSets }) => totalVolume(weekSets(allSets, sessions)),
  },
  {
    id: 'wk_vol_25k', category: 'weekly', title: '25 000kg cette semaine',
    description: 'Accumule 25 000kg de volume total', icon: 'flash-outline',
    target: 25000, unit: 'kg', color: '#60d4f0',
    evaluate: ({ sessions, allSets }) => totalVolume(weekSets(allSets, sessions)),
  },
  {
    id: 'wk_vol_40k', category: 'weekly', title: '40 000kg cette semaine',
    description: 'Semaine massive : 40 000kg !', icon: 'flash-outline',
    target: 40000, unit: 'kg', color: '#60d4f0',
    evaluate: ({ sessions, allSets }) => totalVolume(weekSets(allSets, sessions)),
  },
  {
    id: 'wk_sets_50', category: 'weekly', title: '50 séries cette semaine',
    description: 'Complète 50 séries au total cette semaine', icon: 'layers-outline',
    target: 50, unit: 'séries', color: '#a0d060',
    evaluate: ({ sessions, allSets }) => weekSets(allSets, sessions).length,
  },
  {
    id: 'wk_sets_75', category: 'weekly', title: '75 séries cette semaine',
    description: 'Complète 75 séries — volume énorme !', icon: 'layers-outline',
    target: 75, unit: 'séries', color: '#a0d060',
    evaluate: ({ sessions, allSets }) => weekSets(allSets, sessions).length,
  },
  {
    id: 'wk_muscles_5', category: 'weekly', title: '5 muscles cette semaine',
    description: 'Entraîne au moins 5 groupes musculaires différents', icon: 'body-outline',
    target: 5, unit: 'muscles', color: '#f060a8',
    evaluate: ({ sessions, allSets, exercises }) => distinctMuscles(weekSets(allSets, sessions), exercises),
  },
  {
    id: 'wk_reps_300', category: 'weekly', title: '300 reps cette semaine',
    description: 'Accumule 300 répétitions sur la semaine', icon: 'repeat-outline',
    target: 300, unit: 'reps', color: '#60a0f0',
    evaluate: ({ sessions, allSets }) => totalReps(weekSets(allSets, sessions)),
  },
  {
    id: 'wk_reps_500', category: 'weekly', title: '500 reps cette semaine',
    description: 'Machine à reps : 500 cette semaine !', icon: 'repeat-outline',
    target: 500, unit: 'reps', color: '#60a0f0',
    evaluate: ({ sessions, allSets }) => totalReps(weekSets(allSets, sessions)),
  },
  {
    id: 'wk_variety_10', category: 'weekly', title: '10 exercices différents',
    description: 'Fais 10 exercices distincts cette semaine', icon: 'grid-outline',
    target: 10, unit: 'exercices', color: '#d0f060',
    evaluate: ({ sessions, allSets }) => distinctExercises(weekSets(allSets, sessions)),
  },
];

// ── ACHIEVEMENTS (permanent, not rotated) ────────────────────────────────────

export const ACHIEVEMENTS: ChallengeDefinition[] = [
  {
    id: 'ach_first_session', category: 'achievement', title: 'Première séance',
    description: 'Complète ta toute première séance d\'entraînement',
    icon: 'star-outline', target: 1, unit: 'séance', color: '#c8f060',
    evaluate: ({ sessions }) => sessions.length,
  },
  {
    id: 'ach_10_sessions', category: 'achievement', title: '10 séances',
    description: 'Atteins 10 séances d\'entraînement au total',
    icon: 'medal-outline', target: 10, unit: 'séances', color: '#60d4f0',
    evaluate: ({ sessions }) => sessions.length,
  },
  {
    id: 'ach_50_sessions', category: 'achievement', title: 'Guerrier du gym',
    description: '50 séances complètes — tu es sérieux !',
    icon: 'shield-outline', target: 50, unit: 'séances', color: '#f0c060',
    evaluate: ({ sessions }) => sessions.length,
  },
  {
    id: 'ach_100_sessions', category: 'achievement', title: 'Centurion',
    description: '100 séances — la discipline fait la différence',
    icon: 'ribbon-outline', target: 100, unit: 'séances', color: '#c860f0',
    evaluate: ({ sessions }) => sessions.length,
  },
  {
    id: 'ach_first_pr', category: 'achievement', title: 'Premier PR',
    description: 'Établis ton premier record personnel',
    icon: 'trophy-outline', target: 1, unit: 'PR', color: '#f0c060',
    evaluate: ({ allSets }) => new Set(allSets.map((s) => s.exercise_id)).size > 0 ? 1 : 0,
  },
  {
    id: 'ach_streak_4', category: 'achievement', title: '4 semaines consécutives',
    description: 'Entraîne-toi 4 semaines de suite',
    icon: 'flame-outline', target: 4, unit: 'semaines', color: '#f07040',
    evaluate: ({ getStreakWeeks }) => getStreakWeeks(),
  },
  {
    id: 'ach_streak_8', category: 'achievement', title: '8 semaines consécutives',
    description: '2 mois sans lâcher — machine !',
    icon: 'flame-outline', target: 8, unit: 'semaines', color: '#f04040',
    evaluate: ({ getStreakWeeks }) => getStreakWeeks(),
  },
  {
    id: 'ach_volume_50t', category: 'achievement', title: '50 tonnes soulevées',
    description: 'Cumule 50 000kg de volume all-time',
    icon: 'barbell-outline', target: 50000, unit: 'kg', color: '#60d4f0',
    evaluate: ({ allSets }) => totalVolume(allSets),
  },
  {
    id: 'ach_volume_100t', category: 'achievement', title: '100 tonnes soulevées',
    description: 'Cumule 100 000kg de volume all-time',
    icon: 'barbell-outline', target: 100000, unit: 'kg', color: '#c860f0',
    evaluate: ({ allSets }) => totalVolume(allSets),
  },
];

// ── Daily / Weekly rotation exports ──────────────────────────────────────────

export function getDailySessionChallenges(): ChallengeDefinition[] {
  const seed = hashString(todayKey());
  return seededShuffle(SESSION_POOL, seed).slice(0, 4);
}

export function getWeeklyChallenges(): ChallengeDefinition[] {
  const seed = hashString(getISOWeekYear(new Date()));
  return seededShuffle(WEEKLY_POOL, seed).slice(0, 3);
}

// Keep backward compat exports for the store
export const SESSION_CHALLENGES = getDailySessionChallenges();
export const WEEKLY_CHALLENGES = getWeeklyChallenges();

export const ALL_CHALLENGES: ChallengeDefinition[] = [
  ...SESSION_POOL,
  ...WEEKLY_POOL,
  ...ACHIEVEMENTS,
];
