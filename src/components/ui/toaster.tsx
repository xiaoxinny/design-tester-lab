'use client';

import { useToast } from '@/lib/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map((item) => (
        <Toast key={item.id} variant={item.variant}>
          <div className="flex flex-col gap-1">
            {item.title && <ToastTitle>{item.title}</ToastTitle>}
            {item.description && (
              <ToastDescription>{item.description}</ToastDescription>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
