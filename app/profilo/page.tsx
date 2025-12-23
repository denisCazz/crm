'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

import { ToastProvider, useToast } from '../../components/Toaster';
import LoginForm from '../../components/LoginForm';
import { useSupabaseSafe } from '../../lib/supabase';
import { useTheme } from '../../components/ThemeProvider';
import { AppLayout } from '../../components/layout/AppLayout';
import type { AppSettings, License } from '../../types';
import { getCachedBrand, setCachedBrand } from '../../lib/brandCache';

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
    return { ok: false, reason: isExpired ? 'La licenza è scaduta.' : 'La licenza risulta inattiva.' };
  }
  return { ok: true };
}

function ThemeSection() {
  const { theme, setTheme } = useTheme();
  
  const themes = [
    { value: 'light', label: 'Chiaro', icon: '☀️' },
    { value: 'dark', label: 'Scuro', icon: '🌙' },
    { value: 'system', label: 'Sistema', icon: '💻' },
  ] as const;

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          🎨 Tema
        </h2>
        <p className="text-sm text-muted mt-1">Scegli la modalità di visualizzazione preferita</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {themes.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
              theme === t.value
                ? 'border-primary bg-primary/20 text-foreground'
                : 'border-border bg-surface-hover text-muted hover:border-border-hover hover:bg-surface-active'
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="font-medium">{t.label}</span>
            {theme === t.value && (
              <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function ProfileApp() {
  const supabase = useSupabaseSafe();
  const router = useRouter();
  const { push } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseState, setLicenseState] = useState<LicenseState>({ status: 'idle' });

  const [settings, setSettings] = useState<Partial<AppSettings>>({
    brand_name: '',
    logo_url: '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [profileSaving, setProfileSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    document.title = 'Profilo · Bitora CRM';
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then((response) => {
      setUser(response.data?.session?.user ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_, newSession) => {
      setUser(newSession?.user ?? null);
    });
    return () => { subscription?.subscription.unsubscribe(); };
  }, [supabase]);

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
        if (error) { setLicenseState({ status: 'error', message: error.message }); return; }
        const verdict = isLicenseValid((data ?? null) as License | null);
        if (!verdict.ok) { setLicenseState({ status: 'inactive', reason: verdict.reason }); return; }
        setLicenseState({ status: 'active', license: data as License });
      });
    return () => { cancelled = true; };
  }, [supabase, user]);

  const canUse = useMemo(() => licenseState.status === 'active', [licenseState.status]);

  const fetchSettings = useCallback(async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    const res = await fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as { settings: AppSettings | null; error?: string };
    if (!res.ok) throw new Error(json.error ?? 'Impossibile caricare');
    if (json.settings) {
      setSettings({
        brand_name: json.settings.brand_name ?? '',
        logo_url: json.settings.logo_url ?? '',
      });

      if (user?.id) {
        setCachedBrand(user.id, json.settings.brand_name ?? null, json.settings.logo_url ?? null);
      }
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!canUse || !user?.id) return;

    // Warm from cache to avoid extra call
    const cached = getCachedBrand(user.id);
    if (cached) {
      setSettings({ brand_name: cached.brand_name ?? '', logo_url: cached.logo_url ?? '' });
      return;
    }

    fetchSettings().catch(console.error);
  }, [canUse, fetchSettings]);

  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    setFirstName(typeof meta.first_name === 'string' ? meta.first_name : '');
    setLastName(typeof meta.last_name === 'string' ? meta.last_name : '');
  }, [user]);

  const handleSaveSettings = useCallback(async () => {
    if (!supabase) return;
    setSettingsSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sessione non valida');

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brand_name: settings.brand_name,
          logo_url: settings.logo_url,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Errore salvataggio');

      if (user?.id) {
        setCachedBrand(
          user.id,
          (settings.brand_name ?? '').trim() || null,
          (settings.logo_url ?? '').trim() || null
        );
      }

      push('success', 'Profilo salvato!');
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : 'Errore');
    } finally {
      setSettingsSaving(false);
    }
  }, [supabase, settings, push, user?.id]);

  const handleSavePersonal = useCallback(async () => {
    if (!supabase) return;
    setProfileSaving(true);
    try {
      const nextFirst = firstName.trim();
      const nextLast = lastName.trim();
      const { data, error } = await supabase.auth.updateUser({
        data: {
          first_name: nextFirst || null,
          last_name: nextLast || null,
        },
      });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
      }
      push('success', 'Dati personali salvati.');
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : 'Errore');
    } finally {
      setProfileSaving(false);
    }
  }, [supabase, firstName, lastName, push]);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/');
  }, [supabase, router]);

  if (loading) {
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
        <p className="text-sm text-muted">Verifica della licenza…</p>
      </div>
    );
  }

  if (licenseState.status === 'error') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center text-foreground">
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-6 py-8 max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Errore licenza</h2>
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
        </div>
      </div>
    );
  }

  return (
    <AppLayout 
      user={user} 
      brandName={settings.brand_name || 'Bitora CRM'} 
      logoUrl={settings.logo_url} 
      onLogout={handleLogout}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Profilo Utente</h1>
          <p className="text-sm text-muted">Personalizza il brand e le preferenze del tuo account.</p>
        </header>

        {/* Account info */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              👤 Account
            </h2>
            <p className="text-sm text-muted mt-1">Informazioni del tuo account</p>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-hover border border-border">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl">
              {(user.email?.[0] ?? 'U').toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted">
                {isAdminUser(user) ? '🛡️ Amministratore' : `📋 Piano: ${licenseState.license?.plan ?? 'standard'}`}
              </p>
            </div>
          </div>
        </section>

        {/* Personal data */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              ✍️ Dati personali
            </h2>
            <p className="text-sm text-muted mt-1">Servono per il saluto nella dashboard (es: “Ciao Mario”).</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Nome</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary"
                placeholder="Mario"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cognome</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary"
                placeholder="Rossi"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Anteprima: <span className="font-medium text-foreground">Ciao {firstName.trim() || '…'}</span>
            </p>
            <button type="button" onClick={() => void handleSavePersonal()} disabled={profileSaving} className="btn btn-primary">
              {profileSaving ? 'Salvataggio…' : 'Salva dati'}
            </button>
          </div>
        </section>

        {/* Brand */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              🏷️ Brand
            </h2>
            <p className="text-sm text-muted mt-1">Personalizza il nome e il logo della tua dashboard.</p>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Nome brand</span>
              <input
                value={String(settings.brand_name ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, brand_name: e.target.value }))}
                placeholder="Bitora CRM"
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <span className="text-xs text-muted">Mostrato nella navbar e nel titolo</span>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Logo URL</span>
              <input
                value={String(settings.logo_url ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, logo_url: e.target.value }))}
                placeholder="https://esempio.com/logo.png"
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <span className="text-xs text-muted">URL di un&apos;immagine (PNG, JPG, SVG)</span>
            </label>
          </div>

          {/* Preview */}
          {settings.logo_url && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-hover border border-border">
              <div className="h-16 w-16 rounded-xl bg-surface flex items-center justify-center overflow-hidden border border-border">
                <img 
                  src={settings.logo_url} 
                  alt="Logo preview" 
                  className="max-h-14 max-w-14 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{settings.brand_name || 'Bitora CRM'}</p>
                <p className="text-xs text-muted">Anteprima del brand</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={settingsSaving}
              onClick={handleSaveSettings}
              className="btn btn-primary"
            >
              {settingsSaving ? 'Salvataggio…' : 'Salva profilo'}
            </button>
          </div>
        </section>

        {/* Theme */}
        <ThemeSection />

        {/* Licenza info */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              📜 Licenza
            </h2>
            <p className="text-sm text-muted mt-1">Dettagli della tua licenza</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl bg-surface-hover border border-border">
              <p className="text-xs text-muted uppercase tracking-wide">Stato</p>
              <p className="text-lg font-semibold text-emerald-500 mt-1">
                {licenseState.license?.status === 'active' ? '✅ Attiva' : licenseState.license?.status ?? '-'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface-hover border border-border">
              <p className="text-xs text-muted uppercase tracking-wide">Piano</p>
              <p className="text-lg font-semibold text-foreground mt-1 capitalize">
                {licenseState.license?.plan ?? 'standard'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface-hover border border-border">
              <p className="text-xs text-muted uppercase tracking-wide">Scadenza</p>
              <p className="text-lg font-semibold text-foreground mt-1">
                {licenseState.license?.expires_at 
                  ? new Date(licenseState.license.expires_at).toLocaleDateString('it-IT') 
                  : '♾️ Illimitata'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

export default function ProfilePage() {
  return (
    <ToastProvider>
      <ProfileApp />
    </ToastProvider>
  );
}
