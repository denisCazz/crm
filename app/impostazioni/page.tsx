'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';

import { ToastProvider, useToast } from '../../components/Toaster';
import LoginForm from '../../components/LoginForm';
import { useSupabaseSafe } from '../../lib/supabase';
import type { AppSettings, EmailTemplate, License } from '../../types';

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

function SettingsApp() {
  const supabase = useSupabaseSafe();
  const { push } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseState, setLicenseState] = useState<LicenseState>({ status: 'idle' });

  const [settings, setSettings] = useState<Partial<AppSettings>>({
    brand_name: '',
    logo_url: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_from_email: '',
    smtp_from_name: '',
    smtp_reply_to: '',
  });
  const [smtpPassword, setSmtpPassword] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState({
    id: '' as string | '',
    name: '',
    subject: '',
    body_html: '',
    body_text: '',
  });
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => {
    document.title = 'Impostazioni · Bitora CRM';
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

    return () => {
      subscription?.subscription.unsubscribe();
    };
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

  const fetchSettings = useCallback(async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    const res = await fetch('/api/settings', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = (await res.json()) as { settings: AppSettings | null; error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? 'Impossibile caricare le impostazioni');
    }

    if (json.settings) {
      setSettings({
        brand_name: json.settings.brand_name ?? '',
        logo_url: json.settings.logo_url ?? '',
        smtp_host: json.settings.smtp_host ?? '',
        smtp_port: json.settings.smtp_port ?? 587,
        smtp_secure: json.settings.smtp_secure ?? false,
        smtp_user: json.settings.smtp_user ?? '',
        smtp_from_email: json.settings.smtp_from_email ?? '',
        smtp_from_name: json.settings.smtp_from_name ?? '',
        smtp_reply_to: json.settings.smtp_reply_to ?? '',
      });
    }
  }, [supabase]);

  const fetchTemplates = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    setTemplates((data ?? []) as EmailTemplate[]);
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user || !canUse) return;

    let cancelled = false;
    (async () => {
      try {
        await Promise.all([fetchSettings(), fetchTemplates()]);
      } catch (e: unknown) {
        if (cancelled) return;
        push('error', e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, user, canUse, fetchSettings, fetchTemplates, push]);

  const handleSaveSettings = useCallback(async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    setSettingsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...settings,
          smtp_port: typeof settings.smtp_port === 'number' ? settings.smtp_port : Number(settings.smtp_port ?? 587),
          smtp_secure: Boolean(settings.smtp_secure),
          smtp_password: smtpPassword.trim().length > 0 ? smtpPassword : null,
        }),
      });

      const json = (await res.json()) as { settings?: AppSettings; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Salvataggio fallito');

      push('success', 'Impostazioni salvate.');
      setSmtpPassword('');
      await fetchSettings();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setSettingsSaving(false);
    }
  }, [supabase, settings, smtpPassword, fetchSettings, push]);

  const handleSaveTemplate = useCallback(async () => {
    if (!supabase) return;

    if (!templateForm.name.trim() || !templateForm.subject.trim() || !templateForm.body_html.trim()) {
      push('error', 'Compila nome, subject e body HTML.');
      return;
    }

    setTemplateSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: templateForm.name.trim(),
        subject: templateForm.subject,
        body_html: templateForm.body_html,
        body_text: templateForm.body_text.trim() ? templateForm.body_text : null,
      };

      const q = templateForm.id
        ? supabase.from('email_templates').update(payload).eq('id', templateForm.id)
        : supabase.from('email_templates').insert(payload);

      const { error } = await q;
      if (error) throw error;

      push('success', templateForm.id ? 'Template aggiornato.' : 'Template creato.');
      setTemplateForm({ id: '', name: '', subject: '', body_html: '', body_text: '' });
      await fetchTemplates();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setTemplateSaving(false);
    }
  }, [supabase, templateForm, fetchTemplates, push]);

  const handleEditTemplate = useCallback((tpl: EmailTemplate) => {
    setTemplateForm({
      id: tpl.id,
      name: tpl.name,
      subject: tpl.subject,
      body_html: tpl.body_html,
      body_text: tpl.body_text ?? '',
    });
  }, []);

  const handleDeleteTemplate = useCallback(
    async (tpl: EmailTemplate) => {
      if (!supabase) return;
      if (!confirm(`Eliminare il template "${tpl.name}"?`)) return;

      const { error } = await supabase.from('email_templates').delete().eq('id', tpl.id);
      if (error) {
        push('error', error.message);
        return;
      }

      push('success', 'Template eliminato.');
      await fetchTemplates();
    },
    [supabase, fetchTemplates, push]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (licenseState.status === 'checking' || licenseState.status === 'idle') {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4 text-neutral-300">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm text-neutral-400">Verifica della licenza in corso…</p>
      </div>
    );
  }

  if (licenseState.status === 'error') {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6 text-center text-neutral-200">
        <div className="rounded-3xl border border-red-900/80 bg-red-950/40 px-6 py-8 max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-red-100">Impossibile verificare la licenza</h2>
          <p className="text-sm text-red-200/80">{licenseState.message}</p>
        </div>
      </div>
    );
  }

  if (licenseState.status === 'inactive') {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6 text-center text-neutral-200">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 px-6 py-8 max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-neutral-50">Licenza richiesta</h2>
          <p className="text-sm text-neutral-300">{licenseState.reason}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-neutral-700/60 bg-neutral-900/70 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800"
          >
            Torna alla dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Impostazioni</h1>
            <p className="text-sm text-neutral-400">Brand, SMTP e template email marketing.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800/90"
            >
              Dashboard
            </Link>
            <Link
              href="/email"
              className="inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800/90"
            >
              Invia email
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-neutral-800/60 bg-neutral-950/60 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Brand</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Nome brand</span>
              <input
                value={String(settings.brand_name ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, brand_name: e.target.value }))}
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Logo URL</span>
              <input
                value={String(settings.logo_url ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, logo_url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800/60 bg-neutral-950/60 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">SMTP (invio email)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Host</span>
              <input
                value={String(settings.smtp_host ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_host: e.target.value }))}
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Porta</span>
              <input
                type="number"
                value={Number(settings.smtp_port ?? 587)}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_port: Number(e.target.value) }))}
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Username</span>
              <input
                value={String(settings.smtp_user ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_user: e.target.value }))}
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Password (solo per aggiornare)</span>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-neutral-900/50 px-3.5 py-2.5 text-sm text-neutral-200">
              <input
                type="checkbox"
                checked={Boolean(settings.smtp_secure)}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_secure: e.target.checked }))}
              />
              Connessione sicura (TLS)
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">From email</span>
              <input
                value={String(settings.smtp_from_email ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_from_email: e.target.value }))}
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">From name</span>
              <input
                value={String(settings.smtp_from_name ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_from_name: e.target.value }))}
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Reply-To</span>
              <input
                value={String(settings.smtp_reply_to ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_reply_to: e.target.value }))}
                className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
              />
            </label>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={settingsSaving}
              onClick={handleSaveSettings}
              className="inline-flex items-center justify-center rounded-xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-black hover:bg-white disabled:opacity-70"
            >
              {settingsSaving ? 'Salvataggio…' : 'Salva impostazioni'}
            </button>
          </div>

          <p className="text-xs text-neutral-500">
            Placeholder supportati nei template: {'{{first_name}}'}, {'{{last_name}}'}, {'{{full_name}}'}, {'{{email}}'}, {'{{phone}}'}.
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-800/60 bg-neutral-950/60 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Template email</h2>
            <button
              type="button"
              onClick={() => setTemplateForm({ id: '', name: '', subject: '', body_html: '', body_text: '' })}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800/90"
            >
              Nuovo template
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-800/60">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-900/70 text-neutral-300">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {templates.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-neutral-400" colSpan={3}>
                      Nessun template ancora.
                    </td>
                  </tr>
                ) : (
                  templates.map((tpl) => (
                    <tr key={tpl.id} className="bg-neutral-950/40">
                      <td className="px-4 py-3 text-neutral-100">{tpl.name}</td>
                      <td className="px-4 py-3 text-neutral-300 truncate max-w-[420px]">{tpl.subject}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditTemplate(tpl)}
                            className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTemplate(tpl)}
                            className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-200 hover:bg-red-950/50"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-neutral-800/60 bg-neutral-950/40 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Nome</span>
                <input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Subject</span>
                <input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-neutral-100"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Body HTML</span>
              <textarea
                value={templateForm.body_html}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body_html: e.target.value }))}
                rows={8}
                className="w-full rounded-2xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-3 text-sm text-neutral-100"
                placeholder="<h1>Ciao {{first_name}}</h1>"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Body testo (opzionale)</span>
              <textarea
                value={templateForm.body_text}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body_text: e.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-3 text-sm text-neutral-100"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={templateSaving}
                onClick={() => setTemplateForm({ id: '', name: '', subject: '', body_html: '', body_text: '' })}
                className="inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800/90 disabled:opacity-70"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={templateSaving}
                onClick={() => void handleSaveTemplate()}
                className="inline-flex items-center justify-center rounded-xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-black hover:bg-white disabled:opacity-70"
              >
                {templateSaving ? 'Salvataggio…' : templateForm.id ? 'Aggiorna template' : 'Crea template'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsApp />
    </ToastProvider>
  );
}
