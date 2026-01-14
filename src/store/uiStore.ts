import { create } from 'zustand';
import type { Toast, ToastType } from '@types/index';

let toastIdCounter = 0;

interface UIState {
  toasts: Toast[];
  // Actions
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],

  showToast: (message: string, type: ToastType = 'info') => {
    const id = String(++toastIdCounter);
    const toast: Toast = { id, message, type };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    // Auto-dismiss after 3500ms
    setTimeout(() => {
      get().dismissToast(id);
    }, 3500);
  },

  dismissToast: (id: string) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  clearAllToasts: () => set({ toasts: [] }),
}));
