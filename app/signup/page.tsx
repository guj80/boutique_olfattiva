'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Loader2, MailCheck } from 'lucide-react';
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
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-white/15"
      />
      <span
        aria-hidden="true"
        style={{ backgroundColor: EMERALD, boxShadow: `0 0 14px 1px ${EMERALD}` }}
        className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 opacity-0 transition-[transform,opacity] duration-500 ease-out group-focus-within:scale-x-100 group-focus-within:opacity-100 motion-reduce:transition-none"
      />
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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

    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.');
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setError(
        signUpError.message.includes('already')
          ? 'Un account con questa email esiste già.'
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    // Con la conferma email attiva Supabase non apre subito la sessione.
    if (!data.session) {
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    router.push('/');
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#050308] px-6 py-12">
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
            Crea il tuo diario olfattivo
          </p>
        </div>

        {awaitingConfirmation ? (
          <div
            role="status"
            style={{ borderColor: `${EMERALD}40` }}
            className="space-y-4 rounded-3xl border bg-[#0E0A16]/70 p-6 text-center"
          >
            <MailCheck style={{ color: EMERALD }} className="mx-auto h-8 w-8" />
            <p className="font-serif text-xl text-[#F6EFE4]">Controlla la tua email</p>
            <p className="text-sm text-[#B8A9C9]">
              Abbiamo inviato un link di conferma a <span className="text-[#F6EFE4]">{email.trim()}</span>.
              Dopo la conferma potrai entrare nell’Atelier.
            </p>
            <Link
              href="/login"
              style={{ color: EMERALD }}
              className="inline-block text-sm underline-offset-4 hover:underline"
            >
              Vai all’accesso
            </Link>
          </div>
        ) : (
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
              autoComplete="new-password"
              placeholder="Minimo 6 caratteri"
              minLength={6}
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
              <span>{loading ? 'Creazione in corso…' : 'Entra nell’Atelier'}</span>
            </button>
          </form>
        )}

        {!awaitingConfirmation && (
          <p className="mt-10 text-center text-xs text-[#B8A9C9]">
            Hai già un accesso?{' '}
            <Link
              href="/login"
              style={{ color: EMERALD }}
              className="underline-offset-4 hover:underline"
            >
              Accedi
            </Link>
          </p>
        )}
      </motion.div>
    </main>
  );
}
