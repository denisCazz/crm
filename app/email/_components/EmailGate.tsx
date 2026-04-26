'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import LoginForm from '../../../components/LoginForm';
import { verifySession, getStoredUser, getStoredSession } from '../../../lib/authClient';
import type { User } from '../../../lib/auth';
import { useLicense, type LicenseState } from '../../../lib/useLicense';

type EmailGateProps = {
  title?: string;
  children: (ctx: { user: User; canUse: boolean }) => React.ReactNode;
};

export function EmailGate({ title, children }: EmailGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const licenseState: LicenseState = useLicense(user);

  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  useEffect(() => {
    const checkAuth = async () => {
      const result = await verifySession();
      if (result) {
        setUser(result.user);
      } else {
        const storedUser = getStoredUser();
        if (storedUser) setUser(storedUser);
      }
      setLoadingUser(false);
    };

    checkAuth();

    const interval = setInterval(async () => {
      const session = getStoredSession();
      if (session) {
        const result = await verifySession();
        setUser(result?.user ?? null);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const canUse = licenseState.status === 'active';

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <LoginForm />;

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
