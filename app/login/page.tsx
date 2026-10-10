'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Credenziali non valide. Controlla email e password.'
        : error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Link
        href="/"
        className="absolute top-6 left-6 text-muted-foreground hover:text-gold transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>

      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl font-semibold gold-gradient-text mb-2">
            Accedi
          </h1>
          <p className="tracking-wide-luxury text-[10px] text-muted-foreground uppercase">
            Boutique Olfattiva
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="tracking-wide-luxury text-[10px] text-gold uppercase block">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
              placeholder="email@esempio.com"
            />
          </div>

          <div className="space-y-2">
            <label className="tracking-wide-luxury text-[10px] text-gold uppercase block">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl gold-gradient-bg text-black font-medium text-sm tracking-wide-luxury uppercase text-center transition-transform active:scale-95 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Non hai un account?{' '}
          <Link href="/signup" className="text-gold hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
