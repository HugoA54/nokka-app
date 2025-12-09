import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_CHALLENGES, WEEKLY_CHALLENGES, ACHIEVEMENTS } from '@services/challengeDefinitions';
import type { Achievement, ChallengeProgress, ChallengeEvalData } from '@types/index';

const STORAGE_KEY_ACHIEVEMENTS = 'nokka_achievements';
const STORAGE_KEY_WEEK = 'nokka_challenge_week';

function getISOWeekYear(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

interface ChallengeState {
  unlockedAchievements: Achievement[];
  sessionProgress: Record<string, ChallengeProgress>;
  weeklyProgress: Record<string, ChallengeProgress>;
  newlyUnlocked: Achievement | null;

  loadAchievements: () => Promise<void>;
  evaluateAll: (data: ChallengeEvalData) => Promise<void>;
  clearNewlyUnlocked: () => void;
  resetSessionProgress: () => void;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  unlockedAchievements: [],
  sessionProgress: {},
  weeklyProgress: {},
  newlyUnlocked: null,

  loadAchievements: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
      if (raw) {
        set({ unlockedAchievements: JSON.parse(raw) });
      }
    } catch {}
  },

  evaluateAll: async (data: ChallengeEvalData) => {
    const { unlockedAchievements, sessionProgress, weeklyProgress } = get();
    const currentWeek = getISOWeekYear(new Date());

    // Check if week changed → reset weekly progress
    let storedWeek: string | null = null;
    try { storedWeek = await AsyncStorage.getItem(STORAGE_KEY_WEEK); } catch {}
    let newWeeklyProgress = { ...weeklyProgress };
    if (storedWeek !== currentWeek) {
      newWeeklyProgress = {};
      try { await AsyncStorage.setItem(STORAGE_KEY_WEEK, currentWeek); } catch {}
    }

    const newSessionProgress = { ...sessionProgress };
    let newUnlocked: Achievement | null = null;
    let newAchievements = [...unlockedAchievements];

    // Evaluate session challenges
    for (const def of SESSION_CHALLENGES) {
      const current = def.evaluate(data);
      const prev = newSessionProgress[def.id];
      const wasCompleted = prev?.completedAt != null;
      newSessionProgress[def.id] = {
        challengeId: def.id,
        current,
        target: def.target,
        completedAt: wasCompleted ? prev.completedAt : (current >= def.target ? new Date().toISOString() : null),
      };
    }

    // Evaluate weekly challenges
    for (const def of WEEKLY_CHALLENGES) {
      const current = def.evaluate(data);
      const prev = newWeeklyProgress[def.id];
      const wasCompleted = prev?.completedAt != null;
      newWeeklyProgress[def.id] = {
        challengeId: def.id,
        current,
        target: def.target,
        completedAt: wasCompleted ? prev.completedAt : (current >= def.target ? new Date().toISOString() : null),
      };
    }

    // Evaluate achievements (one-time permanent unlock)
    for (const def of ACHIEVEMENTS) {
      const alreadyUnlocked = unlockedAchievements.some((a) => a.id === def.id);
      if (alreadyUnlocked) continue;
      const current = def.evaluate(data);
      if (current >= def.target) {
        const achievement: Achievement = {
          id: def.id,
          title: def.title,
          description: def.description,
          icon: def.icon,
          color: def.color,
          unlockedAt: new Date().toISOString(),
        };
        newAchievements = [...newAchievements, achievement];
        // Show toast for the first newly unlocked one
        if (!newUnlocked) newUnlocked = achievement;
      }
    }

    // Persist achievements if new ones unlocked
    if (newAchievements.length !== unlockedAchievements.length) {
      try { await AsyncStorage.setItem(STORAGE_KEY_ACHIEVEMENTS, JSON.stringify(newAchievements)); } catch {}
    }

    set({
      sessionProgress: newSessionProgress,
      weeklyProgress: newWeeklyProgress,
      unlockedAchievements: newAchievements,
      newlyUnlocked: newUnlocked ?? get().newlyUnlocked,
    });
  },

  clearNewlyUnlocked: () => set({ newlyUnlocked: null }),

  resetSessionProgress: () => set({ sessionProgress: {} }),
}));
