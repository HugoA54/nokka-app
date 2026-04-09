import { create } from 'zustand';
import { supabase } from '@services/supabase';
import { useWorkoutStore } from '@store/workoutStore';
import type { Template, TemplateExercise, Session } from '@types/index';

interface TemplateState {
  templates: Template[];
  isLoading: boolean;

  fetchTemplates: (userId: string) => Promise<void>;
  createTemplate: (userId: string, name: string, description?: string) => Promise<Template>;
  updateTemplate: (
    templateId: string,
    name: string,
    description: string | null,
    exercises: Omit<TemplateExercise, 'id' | 'template_id'>[]
  ) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  getTemplateExercises: (templateId: string) => Promise<TemplateExercise[]>;
  instantiateSessionFromTemplate: (userId: string, templateId: string, templateName: string) => Promise<Session>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  isLoading: false,

  fetchTemplates: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ templates: data ?? [] });
    } catch (e) {
      console.error('[templateStore] fetchTemplates:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  createTemplate: async (userId: string, name: string, description?: string) => {
    const { data, error } = await supabase
      .from('templates')
      .insert({ user_id: userId, name, description: description ?? null })
      .select()
      .single();
    if (error) throw error;
    const tmpl = data as Template;
    set((state) => ({ templates: [tmpl, ...state.templates] }));
    return tmpl;
  },

  updateTemplate: async (
    templateId: string,
    name: string,
    description: string | null,
    exercises: Omit<TemplateExercise, 'id' | 'template_id'>[]
  ) => {
    const { error: metaError } = await supabase
      .from('templates')
      .update({ name, description })
      .eq('id', templateId);
    if (metaError) throw metaError;

    await supabase.from('template_exercises').delete().eq('template_id', templateId);
    if (exercises.length > 0) {
      const rows = exercises.map((e, i) => ({
        template_id: templateId,
        exercise_id: e.exercise_id,
        exercise_name: e.exercise_name,
        order_index: i,
        default_sets: e.default_sets,
        default_reps: e.default_reps,
        default_weight: e.default_weight,
      }));
      const { error: insertError } = await supabase.from('template_exercises').insert(rows);
      if (insertError) throw insertError;
    }

    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === templateId ? { ...t, name, description } : t
      ),
    }));
  },

  deleteTemplate: async (templateId: string) => {
    const prev = get().templates;
    set((state) => ({ templates: state.templates.filter((t) => t.id !== templateId) }));
    const { error } = await supabase.from('templates').delete().eq('id', templateId);
    if (error) {
      set({ templates: prev });
      throw error;
    }
  },

  getTemplateExercises: async (templateId: string): Promise<TemplateExercise[]> => {
    const { data, error } = await supabase
      .from('template_exercises')
      .select('*')
      .eq('template_id', templateId)
      .order('order_index');
    if (error) throw error;
    return (data ?? []) as TemplateExercise[];
  },

  instantiateSessionFromTemplate: async (
    userId: string,
    templateId: string,
    templateName: string
  ): Promise<Session> => {
    const workoutStore = useWorkoutStore.getState();
    const session = await workoutStore.createNewSession(userId, templateName);

    const { data: templateExercises, error } = await supabase
      .from('template_exercises')
      .select('*')
      .eq('template_id', templateId)
      .order('order_index');

    if (error || !templateExercises || templateExercises.length === 0) return session;

    const rows: any[] = [];
    for (const te of templateExercises) {
      const count = Math.max(1, te.default_sets);
      for (let i = 0; i < count; i++) {
        rows.push({
          session_id: session.id,
          exercise_id: te.exercise_id,
          weight: te.default_weight,
          display_weight: te.default_weight,
          repetitions: te.default_reps,
          rpe: null,
          note: null,
        });
      }
    }

    const { data: insertedSets } = await supabase.from('sets').insert(rows).select('*');
    if (insertedSets) {
      const exercises = workoutStore.exercises;
      const enriched = insertedSets.map((s: any) => ({
        ...s,
        exercise: exercises.find((e) => String(e.id) === String(s.exercise_id)) ?? null,
      }));
      useWorkoutStore.setState((state) => ({ sets: [...state.sets, ...enriched] }));
    }

    return session;
  },
}));
