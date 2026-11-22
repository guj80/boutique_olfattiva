'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function PlatinumMonogramSeal() {
  const uid = useId().replace(/:/g, '');
  const gradId = `vault-plat-${uid}`;

  return (
    <div className="relative h-20 w-16 select-none">
      <div
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle, rgba(238,242,244,0.22) 0%, rgba(16,185,129,0.12) 45%, transparent 72%)',
        }}
        className="pointer-events-none absolute -inset-4 rounded-full blur-xl"
      />
      <svg
        viewBox="220 205 1216 1455"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="relative h-full w-full"
      >
        <defs>
          <linearGradient
            id={gradId}
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
        </defs>
        <g fill={`url(#${gradId})`}>
          <polygon points="477,343 1184,220 1003,519 1030,343" />
          <polygon points="477,343 625,452 877,518 587,519" />
          <polygon points="680,552 926,553 680,620" />
          <polygon points="459,675 238,823 459,1520 459,1175 372,865 459,805" />
          <polygon points="1197,675 1418,823 1197,1520 1197,1175 1284,865 1197,805" />
          <polygon points="517,667 623,667 623,1531 940,1531 1060,1640 517,1640" />
          <polygon points="680,667 1143,667 1048,747 786,747 786,1183 1033,1400 1033,1163 890,1163 987,1056 1143,1056 1143,1638 680,1230" />
        </g>
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) router.replace('/');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !password) {
      setError('Inserisci credenziali valide.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Credenziali non valide.'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    router.push('/');
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-[#050308] px-5 py-10">
      <div
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(50% 40% at 50% 20%, rgba(183,194,203,0.09) 0%, rgba(16,185,129,0.05) 50%, transparent 78%)',
        }}
        className="pointer-events-none absolute inset-0"
      />

      <div className="relative z-10 w-full max-w-[390px]">
        <div
          style={{
            boxShadow:
              '0 32px 90px -20px rgba(0, 0, 0, 0.95), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
          }}
          className="relative overflow-hidden rounded-[32px] border border-white/12 bg-[#0B0812]/95 p-8 sm:p-10 backdrop-blur-2xl"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#EEF2F4]/45 to-transparent"
          />

          <div className="mb-9 flex flex-col items-center text-center">
            <PlatinumMonogramSeal />
            <span className="mt-5 font-mono text-[9px] uppercase tracking-[0.34em] text-[#B7C2CB]/70">
              Archivio Riservato
            </span>
            <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl tracking-tight text-[#F6EFE4]">
              Atelier LG
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[#B8A9C9]"
              >
                Email
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
                className="w-full rounded-2xl border border-white/10 bg-[#050308] px-4 py-3.5 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/25 transition focus:border-[#EEF2F4]/45 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[#B8A9C9]"
              >
                Password
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
                  className="w-full rounded-2xl border border-white/10 bg-[#050308] pl-4 pr-11 py-3.5 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/25 transition focus:border-[#EEF2F4]/45 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Nascondi password' : 'Mostra password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#B8A9C9]/55 transition hover:text-[#F6EFE4]"
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200"
              >
                {error}
              </p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="group flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#EEF2F4] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-[#050308] shadow-[0_10px_30px_-10px_rgba(238,242,244,0.45)] transition hover:bg-white disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Accesso…</span>
                  </>
                ) : (
                  <>
                    <span>Accedi</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-7 text-center text-xs text-[#B8A9C9]/70">
          Nuovo profilo?{' '}
          <Link
            href="/signup"
            className="font-semibold text-[#EEF2F4] underline-offset-4 hover:underline"
          >
            Crea accesso
          </Link>
        </p>
      </div>
    </main>
  );
}
