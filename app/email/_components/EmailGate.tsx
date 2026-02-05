'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import LoginForm from '../../../components/LoginForm';
import { useSupabaseSafe } from '../../../lib/supabase';
import type { License } from '../../../types';
import { verifySession, getStoredUser, getStoredSession } from '../../../lib/authClient';
import type { User } from '../../../lib/auth';

const ADMIN_EMAILS: string[] = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const envAdmin = Boolean(user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const metadataAdmin = userMetadata['is_admin'] === true || appMetadata['role'] === 'admin';
  return envAdmin || metadataAdmin;
}

function adminBypassLicense(user: User): License {
  return {
    id: 'admin-bypass',
    user_id: user.id,
    status: 'active',
    expires_at: null,
    plan: 'admin',
    created_at: new Date().toISOString(),
  } as License;
}

type LicenseState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'active'; license: License }
  | { status: 'inactive'; reason: string }
  | { status: 'error'; message: string };

function isLicenseValid(data: License | null): { ok: true } | { ok: false; reason: string } {
  if (!data) {
    return { ok: false, reason: "Non è stata trovata alcuna licenza attiva associata a questo account." };
  }

  const now = Date.now();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const isExpired = typeof expiresAt === 'number' && !Number.isNaN(expiresAt) && expiresAt < now;
  const isDisabled = data.status === 'inactive' || data.status === 'expired';

  if (isExpired || isDisabled) {
    return {
      ok: false,
      reason: isExpired ? 'La licenza è scaduta.' : 'La licenza risulta inattiva.',
    };
  }

  return { ok: true };
}

type EmailGateProps = {
  title?: string;
  children: (ctx: { user: User; canUse: boolean }) => React.ReactNode;
};

export function EmailGate({ title, children }: EmailGateProps) {
  const supabase = useSupabaseSafe();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [licenseState, setLicenseState] = useState<LicenseState>({ status: 'idle' });

  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  // Verifica autenticazione con nuovo sistema
  useEffect(() => {
    const checkAuth = async () => {
      // Prova prima a verificare la sessione
      const result = await verifySession();
      if (result) {
        setUser(result.user);
      } else {
        // Fallback: prova a ottenere user dal localStorage
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      }
      setLoadingUser(false);
    };

    checkAuth();

    // Verifica periodicamente la sessione (ogni 30 secondi)
    const interval = setInterval(async () => {
      const session = getStoredSession();
      if (session) {
        const result = await verifySession();
        if (result) {
          setUser(result.user);
        } else {
          setUser(null);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setLicenseState((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }));
      return;
    }

    if (isAdminUser(user)) {
      setLicenseState({ status: 'active', license: adminBypassLicense(user) });
      return;
    }

    let cancelled = false;
    setLicenseState({ status: 'checking' });

    supabase
      .from('licenses')
      .select('*')
      .eq('user_id', user.id)
      .order('expires_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLicenseState({ status: 'error', message: error.message });
          return;
        }

        const verdict = isLicenseValid((data ?? null) as License | null);
        if (!verdict.ok) {
          setLicenseState({ status: 'inactive', reason: verdict.reason });
          return;
        }

        setLicenseState({ status: 'active', license: data as License });
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const canUse = useMemo(() => licenseState.status === 'active', [licenseState.status]);

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (licenseState.status === 'checking' || licenseState.status === 'idle') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted">Verifica della licenza in corso…</p>
      </div>
    );
  }

  if (licenseState.status === 'error') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center text-foreground">
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-6 py-8 max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Impossibile verificare la licenza</h2>
          <p className="text-sm text-red-600/80 dark:text-red-300/80">{licenseState.message}</p>
        </div>
      </div>
    );
  }

  if (licenseState.status === 'inactive') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center text-foreground">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 px-6 py-8 max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Licenza richiesta</h2>
          <p className="text-sm text-muted">{licenseState.reason}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-hover"
          >
            Torna alla dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children({ user, canUse })}</>;
}
