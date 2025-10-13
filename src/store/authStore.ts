import { create } from 'zustand';
import { supabase } from '@services/supabase';
import type { User } from '@types/index';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
}

// Module-level reference so we can unsubscribe if initialize() is called multiple times
let _authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: { id: session.user.id, email: session.user.email ?? '' } });
      }
      // Unsubscribe previous listener before creating a new one
      _authSubscription?.unsubscribe();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          set({ user: { id: session.user.id, email: session.user.email ?? '' } });
        } else {
          set({ user: null });
        }
      });
      _authSubscription = subscription;
    } catch (error) {
      console.error('[authStore] initialize error:', error);
    } finally {
      set({ isInitialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        set({ user: { id: data.user.id, email: data.user.email ?? '' } });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },

  setUser: (user: User | null) => set({ user }),
}));
