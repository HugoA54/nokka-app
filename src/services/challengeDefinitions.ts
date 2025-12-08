import { calculate1RM } from '@services/calorieCalculations';
import type { ChallengeDefinition, ChallengeEvalData } from '@types/index';

const UPPER_BODY_MUSCLES = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']);

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

export const SESSION_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'session_volume_5000',
    category: 'session',
    title: '5 000kg de volume',
    description: 'Atteins 5 000kg de volume total sur cette séance',
    icon: 'barbell-outline',
    target: 5000,
    unit: 'kg',
    color: '#c8f060',
    evaluate: ({ sessionSets }: ChallengeEvalData) =>
      sessionSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0),
  },
  {
    id: 'session_sets_20',
    category: 'session',
    title: '20 séries',
    description: 'Complète 20 séries dans cette séance',
    icon: 'layers-outline',
    target: 20,
    unit: 'séries',
    color: '#60d4f0',
    evaluate: ({ sessionSets }: ChallengeEvalData) => sessionSets.length,
  },
  {
    id: 'session_beat_pr',
    category: 'session',
    title: 'Bats un PR',
    description: 'Établis un nouveau record personnel sur au moins un exercice',
    icon: 'trophy-outline',
    target: 1,
    unit: 'PR',
    color: '#f0c060',
    evaluate: ({ sessionSets, allSets, exercises, currentSessionId, getPersonalRecord }: ChallengeEvalData) => {
      if (!currentSessionId) return 0;
      const exerciseIds = [...new Set(sessionSets.map((s) => s.exercise_id))];
      let prsBeaten = 0;
      for (const exId of exerciseIds) {
        const prBefore = allSets
          .filter((s) => s.exercise_id === exId && s.session_id !== currentSessionId)
          .reduce((best, s) => Math.max(best, calculate1RM(s.weight, s.repetitions)), 0);
        const prThis = sessionSets
          .filter((s) => s.exercise_id === exId)
          .reduce((best, s) => Math.max(best, calculate1RM(s.weight, s.repetitions)), 0);
        if (prThis > prBefore) prsBeaten++;
      }
      return prsBeaten;
    },
  },
  {
    id: 'session_upper_body',
    category: 'session',
    title: 'Haut du corps complet',
    description: 'Entraîne 3 muscles du haut du corps distincts',
    icon: 'body-outline',
    target: 3,
    unit: 'muscles',
    color: '#f060a8',
    evaluate: ({ sessionSets, exercises }: ChallengeEvalData) => {
      const muscles = new Set(
        sessionSets
          .map((s) => exercises.find((e) => e.id === s.exercise_id)?.muscle_group)
          .filter((m): m is string => !!m && UPPER_BODY_MUSCLES.has(m))
      );
      return muscles.size;
    },
  },
];

export const WEEKLY_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'week_3_sessions',
    category: 'weekly',
    title: '3 séances cette semaine',
    description: 'Complète 3 séances d\'entraînement dans la semaine',
    icon: 'calendar-outline',
    target: 3,
    unit: 'séances',
    color: '#c8f060',
    evaluate: ({ sessions }: ChallengeEvalData) => {
      const currentWeek = getISOWeekYear(new Date());
      return sessions.filter((s) => getISOWeekYear(new Date(s.date)) === currentWeek).length;
    },
  },
  {
    id: 'week_new_pr',
    category: 'weekly',
    title: '1 nouveau PR cette semaine',
    description: 'Bats au moins un record personnel cette semaine',
    icon: 'trending-up-outline',
    target: 1,
    unit: 'PR',
    color: '#f0c060',
    evaluate: ({ sessions, allSets, exercises }: ChallengeEvalData) => {
      const currentWeek = getISOWeekYear(new Date());
      const thisWeekSessionIds = new Set(
        sessions.filter((s) => getISOWeekYear(new Date(s.date)) === currentWeek).map((s) => s.id)
      );
      const thisWeekSets = allSets.filter((s) => thisWeekSessionIds.has(s.session_id));
      const prevSets = allSets.filter((s) => !thisWeekSessionIds.has(s.session_id));
      const exerciseIds = [...new Set(thisWeekSets.map((s) => s.exercise_id))];
      let prs = 0;
      for (const exId of exerciseIds) {
        const bestPrev = prevSets
          .filter((s) => s.exercise_id === exId)
          .reduce((best, s) => Math.max(best, calculate1RM(s.weight, s.repetitions)), 0);
        const bestThis = thisWeekSets
          .filter((s) => s.exercise_id === exId)
          .reduce((best, s) => Math.max(best, calculate1RM(s.weight, s.repetitions)), 0);
        if (bestThis > bestPrev) prs++;
      }
      return prs;
    },
  },
  {
    id: 'week_volume_20000',
    category: 'weekly',
    title: '20 000kg cette semaine',
    description: 'Accumule 20 000kg de volume total sur la semaine',
    icon: 'flash-outline',
    target: 20000,
    unit: 'kg',
    color: '#60d4f0',
    evaluate: ({ sessions, allSets }: ChallengeEvalData) => {
      const currentWeek = getISOWeekYear(new Date());
      const thisWeekSessionIds = new Set(
        sessions.filter((s) => getISOWeekYear(new Date(s.date)) === currentWeek).map((s) => s.id)
      );
      return allSets
        .filter((s) => thisWeekSessionIds.has(s.session_id))
        .reduce((sum, s) => sum + s.weight * s.repetitions, 0);
    },
  },
];

export const ACHIEVEMENTS: ChallengeDefinition[] = [
  {
    id: 'ach_first_session',
    category: 'achievement',
    title: 'Première séance',
    description: 'Complète ta toute première séance d\'entraînement',
    icon: 'star-outline',
    target: 1,
    unit: 'séance',
    color: '#c8f060',
    evaluate: ({ sessions }: ChallengeEvalData) => sessions.length,
  },
  {
    id: 'ach_10_sessions',
    category: 'achievement',
    title: '10 séances',
    description: 'Atteins 10 séances d\'entraînement au total',
    icon: 'medal-outline',
    target: 10,
    unit: 'séances',
    color: '#60d4f0',
    evaluate: ({ sessions }: ChallengeEvalData) => sessions.length,
  },
  {
    id: 'ach_50_sessions',
    category: 'achievement',
    title: 'Guerrier du gym',
    description: '50 séances complètes — tu es sérieux !',
    icon: 'shield-outline',
    target: 50,
    unit: 'séances',
    color: '#f0c060',
    evaluate: ({ sessions }: ChallengeEvalData) => sessions.length,
  },
  {
    id: 'ach_first_pr',
    category: 'achievement',
    title: 'Premier PR',
    description: 'Établis ton premier record personnel',
    icon: 'trophy-outline',
    target: 1,
    unit: 'PR',
    evaluate: ({ allSets }: ChallengeEvalData) => {
      const exerciseIds = [...new Set(allSets.map((s) => s.exercise_id))];
      return exerciseIds.length > 0 ? 1 : 0;
    },
  },
  {
    id: 'ach_streak_4',
    category: 'achievement',
    title: '4 semaines consécutives',
    description: 'Entraîne-toi 4 semaines de suite',
    icon: 'flame-outline',
    target: 4,
    unit: 'semaines',
    color: '#f07040',
    evaluate: ({ getStreakWeeks }: ChallengeEvalData) => getStreakWeeks(),
  },
  {
    id: 'ach_volume_100t',
    category: 'achievement',
    title: '100 tonnes soulevées',
    description: 'Cumule 100 000kg de volume total all-time',
    icon: 'barbell-outline',
    target: 100000,
    unit: 'kg',
    color: '#c860f0',
    evaluate: ({ allSets }: ChallengeEvalData) =>
      allSets.reduce((sum, s) => sum + s.weight * s.repetitions, 0),
  },
];

export const ALL_CHALLENGES: ChallengeDefinition[] = [
  ...SESSION_CHALLENGES,
  ...WEEKLY_CHALLENGES,
  ...ACHIEVEMENTS,
];
