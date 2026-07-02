import { createContext, useContext, type ReactNode } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';

type ToastType = 'success' | 'error' | 'info';
interface ToastCtx { toast: (type: ToastType, message: string) => void; }

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = (type: ToastType, message: string) => {
    if (type === 'success') sonnerToast.success(message);
    else if (type === 'error') sonnerToast.error(message);
    else sonnerToast(message);
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: '500',
          },
        }}
      />
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
