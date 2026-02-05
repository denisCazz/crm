'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ToastProvider, useToast } from '../../../components/Toaster';
import { EmailGate } from '../_components/EmailGate';
import { useSupabaseSafe } from '../../../lib/supabase';
import { normalizeClient } from '../../../lib/normalizeClient';
import type { Client, EmailTemplate } from '../../../types';
import { AppLayout } from '../../../components/layout/AppLayout';
import { getStoredSession } from '../../../lib/authClient';
import { signOut } from '../../../lib/authClient';

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

function ContattiInner({ userId }: { userId: string }) {
  const supabase = useSupabaseSafe();
  const { push } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});

  const [detailClientId, setDetailClientId] = useState<string | null>(null);

  const [filterQuery, setFilterQuery] = useState('');

  const filteredClients = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((c) => {
      const fullName = [c.first_name ?? '', c.last_name ?? ''].join(' ').trim();
      const tags = Array.isArray(c.tags) ? c.tags.join(' ') : '';
      const haystack = [fullName, c.email ?? '', c.phone ?? '', tags].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, filterQuery]);

  const eligibleClientIds = useMemo(
    () => filteredClients.filter((c) => (c.email ?? '').trim().length > 0).map((c) => c.id),
    [filteredClients]
  );

  const allSelected = useMemo(() => {
    if (eligibleClientIds.length === 0) return false;
    const selected = new Set(selectedClientIds);
    return eligibleClientIds.every((id) => selected.has(id));
  }, [eligibleClientIds, selectedClientIds]);

  const selectedCount = selectedClientIds.length;

  const loadData = useCallback(async () => {
    if (!supabase || !userId) return;

    const [clientsRes, templatesRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, owner_id, first_name, last_name, email, phone, notes, tags, status, first_contacted_at, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('email_templates').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (templatesRes.error) throw templatesRes.error;

    setClients(((clientsRes.data ?? []) as Client[]).map(normalizeClient));
    setTemplates((templatesRes.data ?? []) as EmailTemplate[]);
  }, [supabase, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
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
  }, [supabase, userId, loadData, push]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const previewClient = useMemo(() => {
    if (selectedClientIds.length === 0) return null;
    const first = selectedClientIds[0];
    return clients.find((c) => c.id === first) ?? null;
  }, [selectedClientIds, clients]);

  const preview = useMemo(() => {
    if (!previewClient || !selectedTemplate) return null;

    const vars: Record<string, string> = {
      first_name: previewClient.first_name ?? '',
      last_name: previewClient.last_name ?? '',
      full_name: [previewClient.first_name ?? '', previewClient.last_name ?? ''].join(' ').trim(),
      email: previewClient.email ?? '',
      phone: previewClient.phone ?? '',
    };

    return {
      subject: renderTemplate(selectedTemplate.subject, vars),
      html: renderTemplate(selectedTemplate.body_html, vars),
    };
  }, [previewClient, selectedTemplate]);

  const toggleClient = useCallback((clientId: string, checked: boolean) => {
    setSelectedClientIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(clientId);
      else set.delete(clientId);
      return Array.from(set);
    });
  }, []);

  const toggleSelectAll = useCallback((checked: boolean) => {
    setSelectedClientIds(checked ? eligibleClientIds : []);
  }, [eligibleClientIds]);

  const handleSendSelected = useCallback(async () => {
    if (!supabase) return;
    if (!selectedTemplateId) {
      push('error', 'Seleziona un template.');
      return;
    }
    if (selectedClientIds.length === 0) {
      push('error', 'Seleziona almeno un contatto.');
      return;
    }

      const session = getStoredSession();
      const token = session?.token;
    if (!token) {
      push('error', 'Sessione non valida.');
      return;
    }

    setSending(true);
    setSendProgress({ current: 0, total: selectedClientIds.length });

    let okCount = 0;
    const errors: Array<{ clientId: string; error: string }> = [];

    try {
      for (let i = 0; i < selectedClientIds.length; i++) {
        const clientId = selectedClientIds[i];
        setSendProgress({ current: i + 1, total: selectedClientIds.length });

        try {
          const res = await fetch('/api/email/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ client_id: clientId, template_id: selectedTemplateId }),
          });

          const json = (await res.json()) as { ok?: boolean; send_id?: string; error?: string };
          if (!res.ok) throw new Error(json.error ?? 'Invio fallito');
          okCount += 1;
        } catch (e: unknown) {
          errors.push({ clientId, error: e instanceof Error ? e.message : String(e) });
        }
      }

      if (errors.length === 0) {
        push('success', `Email inviate: ${okCount}`);
      } else {
        push('info', `Email inviate: ${okCount} · Errori: ${errors.length}`);
      }

      await loadData();
    } finally {
      setSending(false);
      setSendProgress(null);
    }
  }, [supabase, selectedTemplateId, selectedClientIds, push, loadData]);

  const handleSaveNotes = useCallback(
    async (clientId: string) => {
      if (!supabase) return;

      const client = clients.find((c) => c.id === clientId);
      if (!client) return;

      const nextValue = (notesDraft[clientId] ?? client.notes ?? '').trim();
      const currentValue = (client.notes ?? '').trim();
      if (nextValue === currentValue) return;

      setSavingNotes((prev) => ({ ...prev, [clientId]: true }));
      try {
        const { error } = await supabase
          .from('clients')
          .update({ notes: nextValue.length ? nextValue : null })
          .eq('id', clientId)
          .eq('owner_id', userId);

        if (error) throw error;

        setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, notes: nextValue.length ? nextValue : null } : c)));
        setNotesDraft((prev) => {
          const copy = { ...prev };
          delete copy[clientId];
          return copy;
        });
        push('success', 'Note salvate.');
      } catch (e: unknown) {
        push('error', e instanceof Error ? e.message : String(e));
      } finally {
        setSavingNotes((prev) => ({ ...prev, [clientId]: false }));
      }
    },
    [supabase, clients, notesDraft, userId, push]
  );

  const detailClient = useMemo(() => {
    if (!detailClientId) return null;
    return clients.find((c) => c.id === detailClientId) ?? null;
  }, [detailClientId, clients]);

  const detailNotesValue = useMemo(() => {
    if (!detailClient) return '';
    const draft = notesDraft[detailClient.id];
    return typeof draft === 'string' ? draft : detailClient.notes ?? '';
  }, [detailClient, notesDraft]);

  const detailIsDirty = useMemo(() => {
    if (!detailClient) return false;
    const draft = notesDraft[detailClient.id];
    if (typeof draft !== 'string') return false;
    return draft.trim() !== (detailClient.notes ?? '').trim();
  }, [detailClient, notesDraft]);

  const openDetails = useCallback(
    (clientId: string) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      setNotesDraft((prev) => {
        if (typeof prev[clientId] === 'string') return prev;
        return { ...prev, [clientId]: client.notes ?? '' };
      });
      setDetailClientId(clientId);
    },
    [clients]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="space-y-2">
        <Link
          href="/email"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <span aria-hidden>←</span>
          Email
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Contatti</h1>
          <p className="text-sm text-muted">Seleziona uno o più contatti e invia un template (uno per volta, in ciclo).</p>
        </div>
      </header>

      {/* Composer */}
      <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Componi invio</h2>
            <p className="text-sm text-muted">1) scegli template · 2) seleziona contatti · 3) invia</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/email/templates" className="btn btn-secondary">
              Template
            </Link>
            <button
              type="button"
              onClick={() => void loadData()}
              className="btn btn-secondary"
            >
              Aggiorna
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px] items-end">
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
            {templates.length === 0 ? (
              <span className="text-xs text-muted">Nessun template trovato.</span>
            ) : null}
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Destinatari</span>
              <span className="text-xs text-muted">{eligibleClientIds.length} con email</span>
            </div>
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSendSelected()}
              className="btn btn-primary w-full disabled:opacity-70"
            >
              {sending
                ? sendProgress
                  ? `Invio… (${sendProgress.current}/${sendProgress.total})`
                  : 'Invio…'
                : `Invia a selezionati (${selectedCount})`}
            </button>
            <p className="text-xs text-muted">Invio singolo in ciclo (uno per volta).</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Selezionati: {selectedCount}
          </span>
          <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold text-muted">
            Contatti: {filteredClients.length}
          </span>
          <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold text-muted">
            Con email: {eligibleClientIds.length}
          </span>
        </div>
      </section>

      {/* Contacts + Preview */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start">
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Contatti</h2>
              <p className="text-sm text-muted">Seleziona i contatti. Le note sono in “Dettagli”.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label className="sr-only" htmlFor="contacts-filter">Cerca contatti</label>
              <div className="relative">
                <input
                  id="contacts-filter"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 pr-10 text-sm text-foreground"
                  placeholder="Cerca per nome, email, telefono, tag…"
                />
                {filterQuery.trim().length ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground"
                    onClick={() => setFilterQuery('')}
                    aria-label="Pulisci filtro"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredClients.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted">Nessun contatto.</div>
            ) : (
              filteredClients.map((c) => {
                const hasEmail = (c.email ?? '').trim().length > 0;
                const checked = selectedClientIds.includes(c.id);

                return (
                  <div
                    key={c.id}
                    className={`rounded-2xl border border-border p-4 ${hasEmail ? 'bg-surface/40' : 'bg-surface/20 opacity-80'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="inline-flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!hasEmail}
                          onChange={(e) => toggleClient(c.id, e.target.checked)}
                          className="mt-1 h-4 w-4 disabled:opacity-50"
                          aria-label={`Seleziona ${c.email ?? c.id}`}
                        />
                        <div className="min-w-0">
                          <div className="text-foreground font-medium truncate">
                            {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                            {c.status === 'new' ? (
                              <span className="ml-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                nuovo
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted break-words">
                            {c.email ? c.email : 'Nessuna email'}
                            {c.phone ? <span className="text-muted"> · {c.phone}</span> : null}
                          </div>
                          {!hasEmail ? <div className="mt-2 text-xs text-muted">Email mancante</div> : null}
                        </div>
                      </label>
                      <button type="button" className="btn btn-secondary" onClick={() => openDetails(c.id)}>
                        Dettagli
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold w-[70px]">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="h-4 w-4"
                        aria-label="Seleziona tutti"
                      />
                      <span className="text-xs">Tutti</span>
                    </label>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Contatto</th>
                  <th className="px-4 py-3 text-left font-semibold w-[140px]">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={3}>
                      Nessun contatto.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    const hasEmail = (c.email ?? '').trim().length > 0;
                    const checked = selectedClientIds.includes(c.id);

                    return (
                      <tr key={c.id} className={`align-top ${hasEmail ? 'bg-surface/40' : 'bg-surface/20 opacity-80'}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!hasEmail}
                            onChange={(e) => toggleClient(c.id, e.target.checked)}
                            className="h-4 w-4 disabled:opacity-50"
                            aria-label={`Seleziona ${c.email ?? c.id}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="text-foreground font-medium">
                              {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                              {c.status === 'new' ? (
                                <span className="ml-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                  nuovo
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted break-words">
                              {c.email ? c.email : 'Nessuna email'}
                              {c.phone ? <span className="text-muted"> · {c.phone}</span> : null}
                            </div>
                            {!hasEmail ? <div className="text-xs text-muted">Email mancante</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" className="btn btn-secondary w-full" onClick={() => openDetails(c.id)}>
                            Dettagli
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4 lg:sticky lg:top-24">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Anteprima</h2>
            <p className="text-sm text-muted">Basata sul primo contatto selezionato.</p>
          </div>

          {!preview ? (
            <div className="rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted">
              Seleziona almeno un contatto e un template.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Subject</div>
                <div className="mt-1 text-sm text-foreground break-words">{preview.subject}</div>
              </div>
              <div className="rounded-xl border border-border bg-surface/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">HTML</div>
                <div className="mt-3 max-h-[420px] overflow-auto">
                  <div
                    className="prose prose-neutral dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                  />
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Details modal (Notes only here) */}
      {detailClient ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailClientId(null)}
        >
          <div
            className="modal-content w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface border-b border-border px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {[detailClient.first_name, detailClient.last_name].filter(Boolean).join(' ') || 'Dettagli'}
                </h3>
                <p className="text-sm text-muted truncate">
                  {detailClient.email ? detailClient.email : 'Nessuna email'}
                  {detailClient.phone ? ` · ${detailClient.phone}` : ''}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setDetailClientId(null)} aria-label="Chiudi">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
              <div className="card p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Note</div>
                <textarea
                  value={detailNotesValue}
                  onChange={(e) =>
                    setNotesDraft((prev) => ({
                      ...prev,
                      [detailClient.id]: e.target.value,
                    }))
                  }
                  rows={6}
                  className="input-field resize-none"
                  placeholder="Aggiungi note…"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-surface border-t border-border px-4 sm:px-6 py-4 flex items-center justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setDetailClientId(null)}>
                Chiudi
              </button>
              <button
                type="button"
                className="btn btn-primary disabled:opacity-60"
                disabled={!detailIsDirty || Boolean(savingNotes[detailClient.id])}
                onClick={() => void handleSaveNotes(detailClient.id)}
              >
                {savingNotes[detailClient.id] ? 'Salvo…' : 'Salva note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function ContattiPageInner() {
  const supabase = useSupabaseSafe();
  const router = useRouter();
  return (
    <EmailGate title="Contatti · Bitora CRM">
      {({ user }) => (
        <AppLayout
          user={user}
          onLogout={async () => {
            if (supabase) {
              await signOut();
            }
            router.push('/');
          }}
        >
          <ContattiInner userId={user.id} />
        </AppLayout>
      )}
    </EmailGate>
  );
}

export default function ContattiPage() {
  return (
    <ToastProvider>
      <ContattiPageInner />
    </ToastProvider>
  );
}
