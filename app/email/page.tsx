'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';

import { ToastProvider, useToast } from '../../components/Toaster';
import LoginForm from '../../components/LoginForm';
import { useSupabaseSafe } from '../../lib/supabase';
import type { Client, EmailSend, EmailTemplate, License } from '../../types';
import { normalizeClient } from '../../lib/normalizeClient';

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

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

function EmailApp() {
  const supabase = useSupabaseSafe();
  const { push } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseState, setLicenseState] = useState<LicenseState>({ status: 'idle' });

  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [sends, setSends] = useState<EmailSend[]>([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = 'Invio email · Bitora CRM';
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

  const loadData = useCallback(async () => {
    if (!supabase || !user || !canUse) return;

    const [clientsRes, templatesRes, sendsRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, owner_id, first_name, last_name, email, phone, status, first_contacted_at, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('email_templates').select('*').order('updated_at', { ascending: false }),
      supabase.from('email_sends').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (templatesRes.error) throw templatesRes.error;
    if (sendsRes.error) throw sendsRes.error;

    setClients(((clientsRes.data ?? []) as Client[]).map(normalizeClient));
    setTemplates((templatesRes.data ?? []) as EmailTemplate[]);
    setSends((sendsRes.data ?? []) as EmailSend[]);
  }, [supabase, user, canUse]);

  useEffect(() => {
    if (!supabase || !user || !canUse) return;
    let cancelled = false;

    (async () => {
      try {
        await loadData();
      } catch (e: unknown) {
        if (cancelled) return;
        push('error', e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, user, canUse, loadData, push]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const preview = useMemo(() => {
    if (!selectedClient || !selectedTemplate) return null;

    const vars: Record<string, string> = {
      first_name: selectedClient.first_name ?? '',
      last_name: selectedClient.last_name ?? '',
      full_name: [selectedClient.first_name ?? '', selectedClient.last_name ?? ''].join(' ').trim(),
      email: selectedClient.email ?? '',
      phone: selectedClient.phone ?? '',
    };

    return {
      subject: renderTemplate(selectedTemplate.subject, vars),
      html: renderTemplate(selectedTemplate.body_html, vars),
    };
  }, [selectedClient, selectedTemplate]);

  const handleSend = useCallback(async () => {
    if (!supabase) return;
    if (!selectedClientId || !selectedTemplateId) {
      push('error', 'Seleziona cliente e template.');
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      push('error', 'Sessione non valida.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: selectedClientId, template_id: selectedTemplateId }),
      });

      const json = (await res.json()) as { ok?: boolean; send_id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Invio fallito');

      push('success', 'Email inviata.');
      await loadData();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
      await loadData();
    } finally {
      setSending(false);
    }
  }, [supabase, selectedClientId, selectedTemplateId, loadData, push]);

  if (loading) {
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

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Invio email</h1>
            <p className="text-sm text-muted">Scegli un cliente e un template, poi invia via SMTP.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-hover"
            >
              Dashboard
            </Link>
            <Link
              href="/impostazioni"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-hover"
            >
              Impostazioni
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cliente</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              >
                <option value="">Seleziona…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                    {c.status === 'new' ? ' (nuovo)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Template</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              >
                <option value="">Seleziona…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">L&apos;invio viene tracciato in Supabase (tabella email_sends).</p>
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSend()}
              className="btn btn-primary disabled:opacity-70"
            >
              {sending ? 'Invio…' : 'Invia email'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Anteprima</h2>
          {!preview ? (
            <p className="text-sm text-muted">Seleziona cliente e template per vedere l&apos;anteprima.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Subject</div>
                <div className="mt-1 text-sm text-foreground">{preview.subject}</div>
              </div>
              <div className="rounded-xl border border-border bg-surface/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">HTML</div>
                <div
                  className="mt-3 prose prose-neutral dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Invii recenti</h2>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-hover"
            >
              Aggiorna
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-left font-semibold">A</th>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sends.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-muted" colSpan={4}>
                      Nessun invio ancora.
                    </td>
                  </tr>
                ) : (
                  sends.map((s) => (
                    <tr key={s.id} className="bg-surface/40">
                      <td className="px-4 py-3 text-muted">{new Date(s.created_at).toLocaleString('it-IT')}</td>
                      <td className="px-4 py-3 text-foreground">{s.to_email}</td>
                      <td className="px-4 py-3 text-muted truncate max-w-[420px]">{s.subject}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            s.status === 'sent'
                              ? 'inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400'
                              : s.status === 'failed'
                                ? 'inline-flex rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400'
                                : 'inline-flex rounded-full bg-neutral-500/15 px-2.5 py-1 text-xs font-semibold text-muted'
                          }
                          title={s.error ?? undefined}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function EmailPage() {
  return (
    <ToastProvider>
      <EmailApp />
    </ToastProvider>
  );
}
