'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ToastProvider, useToast } from '@/components/Toaster';
import { resetPassword } from '@/lib/authClient';

function ResetPasswordInner() {
  const router = useRouter();
  const { push } = useToast();

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    if (!tokenValid) return false;
    if (!password || password.length < 8) return false;
    if (password !== confirmPassword) return false;
    return true;
  }, [tokenValid, password, confirmPassword]);

  useEffect(() => {
    // Verifica se c'è un token nell'URL
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');

    if (!token) {
      setErr('Link di recupero non valido. Il token è mancante.');
      setLoading(false);
      return;
    }

    // Il token viene verificato quando l'utente invia il form
    // Per ora, assumiamo che sia valido se presente
    setTokenValid(true);
    setLoading(false);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');

    if (!token) {
      setErr('Token non trovato nell\'URL.');
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const result = await resetPassword(token, password);
      
      if (!result.success) {
        throw new Error(result.error || 'Errore durante il reset della password');
      }

      push('success', 'Password aggiornata con successo! Ora puoi accedere.');
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
                  required
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
                  required
                />
              </div>

              <button type="submit" disabled={!canSubmit || saving} className="btn btn-primary w-full py-3 disabled:opacity-70">
                {saving ? 'Salvataggio…' : 'Salva nuova password'}
              </button>

              <Link href="/" className="btn btn-secondary w-full">
                Annulla
              </Link>
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
