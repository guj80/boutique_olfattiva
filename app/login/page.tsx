'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';

const EMERALD = '#10B981';

interface GatewayFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  minLength?: number;
}

function GatewayField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
}: GatewayFieldProps) {
  return (
    <div className="group relative">
      <label
        htmlFor={id}
        className="mb-1 block font-mono text-[10px] uppercase tracking-[0.22em] text-[#B8A9C9] transition-colors group-focus-within:text-[#10B981]"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-0 bg-transparent px-0 py-3 text-base text-[#F6EFE4] placeholder:text-[#B8A9C9]/35 focus:outline-none focus:ring-0"
      />
      {/* Linea di base */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-white/15"
      />
      {/* Linea smeraldo che si illumina al focus */}
      <span
        aria-hidden="true"
        style={{ backgroundColor: EMERALD, boxShadow: `0 0 14px 1px ${EMERALD}` }}
        className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 opacity-0 transition-[transform,opacity] duration-500 ease-out group-focus-within:scale-x-100 group-focus-within:opacity-100 motion-reduce:transition-none"
      />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se la sessione e' gia' attiva (persistSession), niente gateway.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) router.replace('/');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Credenziali non valide. Controlla email e password.'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    router.push('/');
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#050308] px-6 py-12">
      {/* Riverbero smeraldo di fondo */}
      <div
        aria-hidden="true"
        style={{ backgroundColor: EMERALD }}
        className="pointer-events-none absolute left-1/2 top-[18%] h-72 w-72 -translate-x-1/2 rounded-full opacity-[0.12] blur-[110px]"
      />

      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-12 flex flex-col items-center text-center">
          <motion.div
            animate={
              prefersReducedMotion
                ? undefined
                : { scale: [1, 1.04, 1], filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1)'] }
            }
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Logo size="lg" />
          </motion.div>
          <h1 className="mt-6 font-serif text-4xl tracking-tight text-[#F6EFE4]">
            Atelier LG
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#B8A9C9]">
            Boutique Olfattiva
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <GatewayField
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="email@esempio.com"
            value={email}
            onChange={setEmail}
          />
          <GatewayField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
          />

          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-[#FB7185]/25 bg-[#FB7185]/10 px-4 py-3 text-sm text-[#FB7185]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: EMERALD, boxShadow: `0 10px 40px -12px ${EMERALD}` }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full py-4 text-sm font-bold tracking-wide text-[#08060C] transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            <span>{loading ? 'Accesso in corso…' : 'Entra nell’Atelier'}</span>
          </button>
        </form>

        <p className="mt-10 text-center text-xs text-[#B8A9C9]">
          Prima volta qui?{' '}
          <Link
            href="/signup"
            style={{ color: EMERALD }}
            className="underline-offset-4 hover:underline"
          >
            Crea il tuo accesso
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
