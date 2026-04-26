'use client';

import { useEffect, useState } from 'react';
import { getStoredSession } from './authClient';
import type { User } from './auth';
import type { License } from '../types';

const ADMIN_EMAILS: string[] = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const envAdmin = Boolean(user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const app = (user.app_metadata ?? {}) as Record<string, unknown>;
  return envAdmin || meta['is_admin'] === true || app['role'] === 'admin';
}

export function adminBypassLicense(user: User): License {
  return {
    id: 'admin-bypass',
    user_id: user.id,
    status: 'active',
    expires_at: null,
    plan: 'admin',
    created_at: new Date().toISOString(),
  } as License;
}

export type LicenseState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'active'; license: License }
  | { status: 'inactive'; reason: string }
  | { status: 'error'; message: string };

function isLicenseValid(data: License | null): { ok: true } | { ok: false; reason: string } {
  if (!data) return { ok: false, reason: 'Non è stata trovata alcuna licenza attiva associata a questo account.' };
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const isExpired = typeof expiresAt === 'number' && !Number.isNaN(expiresAt) && expiresAt < Date.now();
  const isDisabled = data.status === 'inactive' || data.status === 'expired';
  if (isExpired || isDisabled) return { ok: false, reason: isExpired ? 'La licenza è scaduta.' : 'La licenza risulta inattiva.' };
  return { ok: true };
}

export function useLicense(user: User | null): LicenseState {
  const [state, setState] = useState<LicenseState>({ status: 'idle' });

  useEffect(() => {
    if (!user) {
      setState({ status: 'idle' });
      return;
    }
    if (isAdminUser(user)) {
      setState({ status: 'active', license: adminBypassLicense(user) });
      return;
    }

    let cancelled = false;
    setState({ status: 'checking' });

    const session = getStoredSession();
    const token = session?.token;
    if (!token) {
      setState({ status: 'error', message: 'Sessione non trovata.' });
      return;
    }

    fetch('/api/licenses/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json: { license?: License; error?: string }) => {
        if (cancelled) return;
        if (json.error) { setState({ status: 'error', message: json.error }); return; }
        const verdict = isLicenseValid(json.license ?? null);
        if (!verdict.ok) { setState({ status: 'inactive', reason: verdict.reason }); return; }
        setState({ status: 'active', license: json.license! });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });

    return () => { cancelled = true; };
  }, [user]);

  return state;
}
