import { useUIStore } from '@store/uiStore';
import type { ToastType } from '@types/index';

export function useToast() {
  const showToast = useUIStore((s) => s.showToast);

  return {
    toast: (message: string, type: ToastType = 'info') => showToast(message, type),
    success: (message: string) => showToast(message, 'success'),
    error: (message: string) => showToast(message, 'error'),
    info: (message: string) => showToast(message, 'info'),
  };
}
