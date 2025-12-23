'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useSupabase } from '@/lib/supabase';
import { ToastProvider, useToast } from '@/components/Toaster';

function ResetPasswordInner() {
  const supabase = useSupabase();
  const router = useRouter();
  const { push } = useToast();

  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    if (!sessionReady) return false;
    if (!password || password.length < 8) return false;
    if (password !== confirmPassword) return false;
    return true;
  }, [sessionReady, password, confirmPassword]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Support both legacy implicit-flow hashes and PKCE code flow.
        const url = new URL(window.location.href);

        const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          if (!cancelled) {
            setSessionReady(true);
          }
          return;
        }

        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) {
            setSessionReady(true);
          }
          return;
        }

        // If already signed in, allow password update.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          if (!cancelled) {
            setSessionReady(true);
          }
          return;
        }

        throw new Error('Link di recupero non valido o scaduto. Richiedi un nuovo reset.');
      } catch (e: unknown) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setErr(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      push('success', 'Password aggiornata. Puoi accedere.');
      router.push('/');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      push('error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md relative z-20">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Reimposta password</h1>
          <p className="text-muted text-sm">Inserisci una nuova password per il tuo account.</p>
        </div>

        <div className="card-elevated p-6 sm:p-8 space-y-4">
          {loading ? (
            <div className="text-sm text-muted">Verifico il link…</div>
          ) : err ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
                {err}
              </div>
              <Link href="/" className="btn btn-secondary w-full">
                Torna al login
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Nuova password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Minimo 8 caratteri"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Conferma password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Ripeti la password"
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" disabled={!canSubmit || saving} className="btn btn-primary w-full py-3 disabled:opacity-70">
                {saving ? 'Salvataggio…' : 'Salva nuova password'}
              </button>

              <Link href="/" className="btn btn-secondary w-full">
                Annulla
              </Link>

              {!sessionReady ? (
                <p className="text-xs text-muted">Attendi la verifica del link prima di salvare.</p>
              ) : null}
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-muted">Se il link è scaduto, richiedi un nuovo reset.</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <ToastProvider>
      <ResetPasswordInner />
    </ToastProvider>
  );
}
