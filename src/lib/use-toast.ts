import { useSyncExternalStore } from 'react';

export type Toast = {
  id: string;
  variant?: 'default' | 'success' | 'error';
  title?: string;
  description?: string;
};

let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, ...props }];
  emitChange();

  setTimeout(() => dismiss(id), 5000);
}

export function dismiss(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emitChange();
}

export function useToast() {
  return {
    toasts: useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
    dismiss,
  };
}
