import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@services/supabase';
import { geminiService } from '@services/geminiService';
import type { AIMeal, AIMacroGoals, AIMacroTotals, AIMacroResult, AIAnalysisStep } from '@types/index';

const GOALS_KEY = 'nokka_ai_macro_goals';

const DEFAULT_GOALS: AIMacroGoals = {
  calories: 2000,
  proteines: 150,
  glucides: 200,
  lipides: 65,
};

function getTodayString(): string {
  return new Date().toLocaleDateString('en-CA');
}

interface MacroAIState {
  // Daily meals
  meals: AIMeal[];
  isLoadingMeals: boolean;

  // Goals
  goals: AIMacroGoals;
  isLoadingGoals: boolean;

  // Analysis
  analysisStep: AIAnalysisStep;
  imageUri: string | null;
  imageBase64: string | null;
  analysisResult: AIMacroResult | null;
  analysisError: string | null;
  analysisNotes: string;
  isAnalyzing: boolean;

  // Computed
  todayTotals: AIMacroTotals;

  // Meal Actions
  fetchTodayMeals: (userId: string) => Promise<void>;
  addMeal: (userId: string, meal: Omit<AIMeal, 'id' | 'date' | 'created_at'>) => Promise<void>;
  updateMeal: (userId: string, mealId: number, updates: Partial<AIMeal>) => Promise<void>;
  deleteMeal: (userId: string, mealId: number) => Promise<void>;

  // Goals Actions
  loadGoals: (userId: string, profileGoals?: AIMacroGoals) => Promise<void>;
  updateGoals: (userId: string, goals: AIMacroGoals) => Promise<void>;

  // Analysis Actions
  setImagePreview: (uri: string, base64: string) => void;
  setAnalysisNotes: (notes: string) => void;
  analyzeImage: () => Promise<void>;
  setAnalysisResult: (result: AIMacroResult) => void;
  resetAnalysis: () => void;
  setAnalysisStep: (step: AIAnalysisStep) => void;
}

export const useMacroAIStore = create<MacroAIState>((set, get) => ({
  meals: [],
  isLoadingMeals: false,
  goals: DEFAULT_GOALS,
  isLoadingGoals: false,
  analysisStep: 'idle',
  imageUri: null,
  imageBase64: null,
  analysisResult: null,
  analysisError: null,
  analysisNotes: '',
  isAnalyzing: false,

  get todayTotals(): AIMacroTotals {
    const { meals } = get();
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        proteines: acc.proteines + m.proteines,
        glucides: acc.glucides + m.glucides,
        lipides: acc.lipides + m.lipides,
      }),
      { calories: 0, proteines: 0, glucides: 0, lipides: 0 }
    );
  },

  // ── Meal Actions ───────────────────────────────────────────────────────────

  fetchTodayMeals: async (userId: string) => {
    set({ isLoadingMeals: true });
    try {
      const today = getTodayString();
      const { data, error } = await supabase
        .from('ai_meals')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .order('created_at');
      if (error) throw error;
      set({ meals: data ?? [] });
    } catch (error) {
      console.error('[macroAIStore] fetchTodayMeals:', error);
    } finally {
      set({ isLoadingMeals: false });
    }
  },

  addMeal: async (userId, mealData) => {
    const today = getTodayString();
    const { data, error } = await supabase
      .from('ai_meals')
      .insert({ ...mealData, user_id: userId, date: today })
      .select()
      .single();
    if (error) throw error;
    set((state) => ({ meals: [...state.meals, data as AIMeal] }));
  },

  updateMeal: async (userId, mealId, updates) => {
    const { error } = await supabase
      .from('ai_meals')
      .update(updates)
      .eq('id', mealId)
      .eq('user_id', userId);
    if (error) throw error;
    set((state) => ({
      meals: state.meals.map((m) => (m.id === mealId ? { ...m, ...updates } : m)),
    }));
  },

  deleteMeal: async (userId, mealId) => {
    const { error } = await supabase
      .from('ai_meals')
      .delete()
      .eq('id', mealId)
      .eq('user_id', userId);
    if (error) throw error;
    set((state) => ({ meals: state.meals.filter((m) => m.id !== mealId) }));
  },

  // ── Goals Actions ──────────────────────────────────────────────────────────

  loadGoals: async (userId: string, profileGoals?: AIMacroGoals) => {
    set({ isLoadingGoals: true });
    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from('ai_macro_goals')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const goals: AIMacroGoals = {
          calories: data.calories,
          proteines: data.proteines,
          glucides: data.glucides,
          lipides: data.lipides,
        };
        set({ goals });
        await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
      } else {
        // Fall back to local cache
        const cached = await AsyncStorage.getItem(GOALS_KEY);
        if (cached) {
          set({ goals: JSON.parse(cached) });
        } else if (profileGoals) {
          // Use profile-computed goals as default when no user-set goals exist
          set({ goals: profileGoals });
        }
      }
    } catch (error) {
      console.error('[macroAIStore] loadGoals:', error);
      // Last resort: local cache or profile goals
      try {
        const cached = await AsyncStorage.getItem(GOALS_KEY);
        if (cached) set({ goals: JSON.parse(cached) });
        else if (profileGoals) set({ goals: profileGoals });
      } catch {}
    } finally {
      set({ isLoadingGoals: false });
    }
  },

  updateGoals: async (userId: string, goals: AIMacroGoals) => {
    set({ goals });
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    await supabase
      .from('ai_macro_goals')
      .upsert({ user_id: userId, ...goals, updated_at: new Date().toISOString() });
  },

  // ── Analysis Actions ───────────────────────────────────────────────────────

  setImagePreview: (uri: string, base64: string) => {
    set({ imageUri: uri, imageBase64: base64, analysisStep: 'preview', analysisResult: null, analysisError: null });
  },

  setAnalysisNotes: (notes: string) => set({ analysisNotes: notes }),

  analyzeImage: async () => {
    const { imageBase64, analysisNotes } = get();
    if (!imageBase64) {
      set({ analysisError: 'No image selected.' });
      return;
    }
    set({ isAnalyzing: true, analysisStep: 'analyzing', analysisError: null });
    try {
      const result = await geminiService.analyzeMealImage(imageBase64, analysisNotes);
      set({ analysisResult: result, analysisStep: 'review', isAnalyzing: false });
    } catch (error: any) {
      console.error('[macroAIStore] analyzeImage:', error);
      set({
        analysisError: error?.message ?? 'AI analysis failed. Please try again.',
        analysisStep: 'preview',
        isAnalyzing: false,
      });
    }
  },

  setAnalysisResult: (result: AIMacroResult) => {
    set({ analysisResult: result });
  },

  resetAnalysis: () => {
    set({
      analysisStep: 'idle',
      imageUri: null,
      imageBase64: null,
      analysisResult: null,
      analysisError: null,
      analysisNotes: '',
      isAnalyzing: false,
    });
  },

  setAnalysisStep: (step: AIAnalysisStep) => set({ analysisStep: step }),
}));
