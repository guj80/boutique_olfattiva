'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  animate,
} from 'framer-motion';
import { Eye, EyeOff, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const EMERALD = '#10B981';

/**
 * Monogramma platino con livello liquido interno e tappo animato
 * che reagisce alla compilazione delle credenziali e allo sblocco.
 */
function InteractiveBottleSeal({
  fillProgress,
  unlocked,
}: {
  fillProgress: number; // 0..1
  unlocked: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const platId = `login-plat-${uid}`;
  const liquidId = `login-liq-${uid}`;
  const clipId = `login-clip-${uid}`;

  // Livello Y nel viewBox (da 1650 fondo a 660 cima)
  const liquidY = 1650 - Math.max(0, Math.min(1, fillProgress)) * 990;

  return (
    <div className="relative h-24 w-20 select-none">
      {/* Alone ambientale che cresce con il riempimento */}
      <div
        aria-hidden="true"
        style={{
          opacity: 0.14 + fillProgress * 0.28,
          background:
            'radial-gradient(circle, rgba(16,185,129,0.55) 0%, rgba(183,194,203,0.18) 55%, transparent 75%)',
        }}
        className="pointer-events-none absolute -inset-4 rounded-full blur-xl transition-opacity duration-500"
      />

      <svg
        viewBox="220 170 1216 1490"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="relative h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient
            id={platId}
            gradientUnits="userSpaceOnUse"
            x1="300"
            y1="200"
            x2="1300"
            y2="1650"
          >
            <stop offset="0" stopColor="#F7F9FA" />
            <stop offset="0.45" stopColor="#B7C2CB" />
            <stop offset="0.7" stopColor="#EEF2F4" />
            <stop offset="1" stopColor="#7F8D98" />
          </linearGradient>

          <linearGradient
            id={liquidId}
            gradientUnits="userSpaceOnUse"
            x1="400"
            y1="660"
            x2="1200"
            y2="1650"
          >
            <stop offset="0" stopColor="#34D399" />
            <stop offset="0.55" stopColor="#10B981" />
            <stop offset="1" stopColor="#D4AF37" />
          </linearGradient>

          <clipPath id={clipId}>
            <rect
              x="200"
              y={liquidY}
              width="1260"
              height="1100"
              className="transition-all duration-500 ease-out"
            />
          </clipPath>
        </defs>

        {/* Base platino del corpo */}
        <g fill={`url(#${platId})`}>
          <polygon points="680,552 926,553 680,620" />
          <polygon points="459,675 238,823 459,1520 459,1175 372,865 459,805" />
          <polygon points="1197,675 1418,823 1197,1520 1197,1175 1284,865 1197,805" />
          <polygon points="517,667 623,667 623,1531 940,1531 1060,1640 517,1640" />
          <polygon points="680,667 1143,667 1048,747 786,747 786,1183 1033,1400 1033,1163 890,1163 987,1056 1143,1056 1143,1638 680,1230" />
        </g>

        {/* Riempimento luminoso interno legato ai campi compilati */}
        <g fill={`url(#${liquidId})`} clipPath={`url(#${clipId})`} opacity="0.9">
          <polygon points="459,675 238,823 459,1520 459,1175 372,865 459,805" />
          <polygon points="1197,675 1418,823 1197,1520 1197,1175 1284,865 1197,805" />
          <polygon points="517,667 623,667 623,1531 940,1531 1060,1640 517,1640" />
          <polygon points="680,667 1143,667 1048,747 786,747 786,1183 1033,1400 1033,1163 890,1163 987,1056 1143,1056 1143,1638 680,1230" />
        </g>

        {/* Tappo che si solleva quando il sigillo e' pronto / sbloccato */}
        <motion.g
          fill={`url(#${platId})`}
          animate={
            unlocked
              ? { y: -95, rotate: -6 }
              : fillProgress >= 0.95
              ? { y: -24, rotate: -1.5 }
              : { y: 0, rotate: 0 }
          }
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <polygon points="477,343 1184,220 1003,519 1030,343" />
          <polygon points="477,343 625,452 877,518 587,519" />
        </motion.g>
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [maxDrag, setMaxDrag] = useState(210);
  const dragX = useMotionValue(0);

  const fillWidth = useTransform(dragX, [0, maxDrag], ['0%', '100%']);
  const labelOpacity = useTransform(dragX, [0, maxDrag * 0.55], [1, 0]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) router.replace('/');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const updateTrackWidth = () => {
      if (!trackRef.current) return;
      const w = trackRef.current.offsetWidth;
      // 48px pomello + 8px padding
      setMaxDrag(Math.max(120, w - 56));
    };
    updateTrackWidth();
    window.addEventListener('resize', updateTrackWidth);
    return () => window.removeEventListener('resize', updateTrackWidth);
  }, []);

  // Calcolo progressivo del riempimento (0..1) mentre l'utente compila
  const emailScore = email.includes('@') && email.includes('.') ? 0.5 : Math.min(0.4, email.trim().length * 0.04);
  const passScore = Math.min(0.5, password.length * 0.085);
  const fillProgress = unlocked ? 1 : Math.min(1, emailScore + passScore);
  const isReady = email.trim().length >= 5 && password.length >= 4;

  async function performLogin() {
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Inserisci email e password per sbloccare l’Atelier.');
      animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 28 });
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setUnlocked(false);
      animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 28 });
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Credenziali non valide. Controlla email e password.'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    setUnlocked(true);
    animate(dragX, maxDrag, { duration: 0.25 });
    setTimeout(() => {
      router.push('/');
    }, 420);
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLogin();
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#050308] px-5 py-10">
      {/* Fascio luminoso verticale da teca */}
      <div
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 18%, rgba(16,185,129,0.16) 0%, rgba(183,194,203,0.06) 45%, transparent 75%)',
        }}
        className="pointer-events-none absolute inset-0"
      />

      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Teca centrale in vetro fumé */}
        <div
          style={{
            borderColor: unlocked
              ? 'rgba(52, 211, 153, 0.55)'
              : isReady
              ? 'rgba(183, 194, 203, 0.28)'
              : 'rgba(255, 255, 255, 0.1)',
            boxShadow:
              '0 30px 80px -20px rgba(0, 0, 0, 0.9), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
          }}
          className="relative overflow-hidden rounded-[32px] border bg-[#0E0A16]/90 p-7 sm:p-9 backdrop-blur-2xl transition-colors duration-500"
        >
          {/* Riflesso sottile superiore */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#EEF2F4]/40 to-transparent"
          />

          {/* Intestazione con Sigillo Interattivo */}
          <div className="mb-8 flex flex-col items-center text-center">
            <InteractiveBottleSeal fillProgress={fillProgress} unlocked={unlocked} />

            <span className="mt-4 font-mono text-[9px] uppercase tracking-[0.32em] text-[#B7C2CB]/75">
              Archivio Privato
            </span>
            <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl tracking-tight text-[#F6EFE4]">
              Atelier LG
            </h1>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Campo Email in capsula incassata */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[#B8A9C9]"
              >
                Identificativo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="nome@dominio.it"
                className="w-full rounded-2xl border border-white/10 bg-[#08060C]/90 px-4 py-3.5 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/30 transition focus:border-[#10B981]/60 focus:outline-none"
              />
            </div>

            {/* Campo Password con toggle visibilità */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[#B8A9C9]"
              >
                Chiave d’Accesso
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-white/10 bg-[#08060C]/90 pl-4 pr-11 py-3.5 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/30 transition focus:border-[#10B981]/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Nascondi password' : 'Mostra password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#B8A9C9]/60 transition hover:text-[#F6EFE4]"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-xs leading-relaxed text-rose-200"
              >
                {error}
              </motion.p>
            )}

            {/* Cursore Magnetico Atomizzatore: trascina OPPURE clicca */}
            <div className="pt-2">
              <div
                ref={trackRef}
                onClick={() => {
                  // Permette anche il clic diretto per chi non vuole trascinare
                  if (!loading && !unlocked) {
                    void performLogin();
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void performLogin();
                  }
                }}
                aria-label="Trascina o premi per entrare nell'Atelier"
                style={{
                  borderColor: isReady
                    ? 'rgba(16, 185, 129, 0.45)'
                    : 'rgba(255, 255, 255, 0.12)',
                }}
                className="relative flex h-14 w-full cursor-pointer items-center overflow-hidden rounded-full border bg-[#08060C] p-1 select-none transition-colors"
              >
                {/* Scia luminosa che si riempie durante il trascinamento */}
                <motion.div
                  aria-hidden="true"
                  style={{
                    width: fillWidth,
                    background:
                      'linear-gradient(90deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.45) 100%)',
                  }}
                  className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
                />

                {/* Testo centrale */}
                <motion.span
                  style={{ opacity: labelOpacity }}
                  className="pointer-events-none w-full pl-10 pr-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#EEF2F4]/80"
                >
                  {loading
                    ? 'Apertura sigillo…'
                    : unlocked
                    ? 'Benvenuto'
                    : 'Scorri o premi per aprire'}
                </motion.span>

                {/* Tacca magnetica di arrivo a destra */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 flex items-center text-[#10B981]/50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </span>

                {/* Pomello trascinabile */}
                <motion.div
                  drag={loading || unlocked ? false : 'x'}
                  dragConstraints={{ left: 0, right: maxDrag }}
                  dragElastic={0.05}
                  style={{
                    x: dragX,
                    background: isReady
                      ? `linear-gradient(135deg, #EEF2F4 0%, ${EMERALD} 100%)`
                      : 'linear-gradient(135deg, #EEF2F4 0%, #94A3B8 100%)',
                    boxShadow: isReady ? '0 0 20px rgba(16,185,129,0.5)' : undefined,
                  }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x >= maxDrag * 0.68) {
                      void performLogin();
                    } else {
                      animate(dragX, 0, { type: 'spring', stiffness: 420, damping: 30 });
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!loading && !unlocked) {
                      void performLogin();
                    }
                  }}
                  className="relative z-10 flex h-12 w-12 shrink-0 cursor-grab items-center justify-center rounded-full text-[#050308] active:cursor-grabbing"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-5 w-5 stroke-[2.5]" />
                  )}
                </motion.div>
              </div>
            </div>
          </form>
        </div>

        <p className="mt-7 text-center text-xs text-[#B8A9C9]/80">
          Prima volta nell’archivio?{' '}
          <Link
            href="/signup"
            style={{ color: EMERALD }}
            className="font-semibold underline-offset-4 hover:underline"
          >
            Crea il tuo accesso
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
