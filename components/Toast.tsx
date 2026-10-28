'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion';

interface ToastItem {
  id: number;
  message: string;
  tone?: 'default' | 'error' | 'success';
}

interface ToastContextValue {
  showToast: (message: string, tone?: 'default' | 'error' | 'success') => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastItem['tone'] = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        role="region"
        aria-label="Notifiche"
        aria-live="polite"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        className="pointer-events-none fixed inset-x-0 z-[80] mx-auto flex max-w-[430px] flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const isError = t.tone === 'error';
            const isSuccess = t.tone === 'success';
            const boxStyle = isError
              ? 'border border-[#E5484D]/50 bg-[#281B35]/95 text-[#F6EFE4]'
              : isSuccess
              ? 'border border-[#4ADE80]/40 bg-[#143020]/95 text-[#F6EFE4]'
              : 'border border-[#D8B995]/40 bg-[#1E1428]/95 text-[#F6EFE4]';
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.94 }}
                transition={springSnappy}
                className={`pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md ${boxStyle}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: isError ? '#E5484D' : 'var(--aura-1)',
                  }}
                />
                <span>{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
