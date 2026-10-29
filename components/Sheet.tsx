'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, PanInfo, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { springSoft } from '@/lib/motion';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initialSnap?: 'half' | 'full';
  children: React.ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  initialSnap = 'half',
  children,
}: SheetProps) {
  const [snap, setSnap] = useState<'half' | 'full'>(initialSnap);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const accent = '#C98A3A';

  useEffect(() => {
    if (open) setSnap(initialSnap);
  }, [open, initialSnap]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = requestAnimationFrame(() => {
      sheetRef.current?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const vy = info.velocity.y;
    const dy = info.offset.y;

    if (dy > 110 || vy > 480) {
      if (snap === 'full' && dy < 220) {
        setSnap('half');
      } else {
        onClose();
      }
    } else if (dy < -50 || vy < -380) {
      setSnap('full');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden"
        >
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label="Chiudi pannello"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#140D1C]/75 cursor-default"
          />

          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.14}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: snap === 'full' ? '0%' : '26%' }}
            exit={{ y: '100%' }}
            transition={springSoft}
            className="relative z-10 flex h-[92dvh] w-full max-w-[460px] flex-col rounded-t-[32px] border-t border-[#D8B995]/25 bg-[#1E1428]/95 text-[#F6EFE4] shadow-[0_-16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl will-change-transform focus:outline-none"
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: 'none' }}
              className="shrink-0 select-none cursor-grab active:cursor-grabbing"
            >
              <div className="flex flex-col items-center pt-3 pb-2">
                <div className="h-1.5 w-11 rounded-full bg-[#D8B995]/40" />
              </div>

              <div className="flex items-start justify-between gap-4 px-6 pb-4 border-b border-white/[0.07]">
                <div>
                  <h2 className="font-serif text-2xl text-[#F6EFE4] leading-tight">{title}</h2>
                  {subtitle && <p className="text-sm text-[#B8A9C9] mt-0.5">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClose}
                  aria-label="Chiudi"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#281B35] text-[#F6EFE4] hover:bg-[#3A2A5E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B995]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div
              style={{
                overscrollBehavior: 'contain',
                touchAction: 'pan-y',
                paddingBottom: snap === 'half' ? 'calc(24dvh + 3rem)' : '3rem',
              }}
              className="flex-1 overflow-y-auto px-6 py-5"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
