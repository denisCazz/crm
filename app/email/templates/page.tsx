'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ToastProvider, useToast } from '../../../components/Toaster';
import { EmailGate } from '../_components/EmailGate';
import { useSupabaseSafe } from '../../../lib/supabase';
import { AppLayout } from '../../../components/layout/AppLayout';
import type { EmailTemplate } from '../../../types';

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

const templateVars = [
  { key: 'first_name', label: 'Nome' },
  { key: 'last_name', label: 'Cognome' },
  { key: 'full_name', label: 'Nome completo' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefono' },
] as const;

function TemplatesInner({ ownerId }: { ownerId: string }) {
  const supabase = useSupabaseSafe();
  const { push } = useToast();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const [form, setForm] = useState({
    id: '' as string | '',
    name: '',
    subject: '',
    body_html: '',
    body_text: '' as string,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const loadTemplates = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setTemplates((data ?? []) as EmailTemplate[]);
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, ownerId, push]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setForm({
      id: selectedTemplate.id,
      name: selectedTemplate.name ?? '',
      subject: selectedTemplate.subject ?? '',
      body_html: selectedTemplate.body_html ?? '',
      body_text: selectedTemplate.body_text ?? '',
    });
  }, [selectedTemplate]);

  const startNew = useCallback(() => {
    setSelectedId(null);
    setForm({ id: '', name: '', subject: '', body_html: '', body_text: '' });
  }, []);

  const insertVar = useCallback((key: string) => {
    const token = `{{${key}}}`;
    setForm((f) => ({
      ...f,
      body_html: (f.body_html ?? '') + token,
    }));
  }, []);

  const previewVars = useMemo(
    () => ({
      first_name: 'Mario',
      last_name: 'Rossi',
      full_name: 'Mario Rossi',
      email: 'mario.rossi@example.com',
      phone: '+39 333 111 2222',
    }),
    []
  );

  const preview = useMemo(() => {
    const subject = renderTemplate(form.subject || '', previewVars);
    const html = renderTemplate(form.body_html || '', previewVars);
    return { subject, html };
  }, [form.subject, form.body_html, previewVars]);

  const handleSave = useCallback(async () => {
    if (!supabase) return;
    const name = form.name.trim();
    const subject = form.subject.trim();
    const bodyHtml = form.body_html.trim();

    if (!name) {
      push('error', 'Inserisci un nome template.');
      return;
    }
    if (!subject) {
      push('error', 'Inserisci un subject.');
      return;
    }
    if (!bodyHtml) {
      push('error', 'Inserisci il body HTML.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        owner_id: ownerId,
        name,
        subject,
        body_html: bodyHtml,
        body_text: form.body_text.trim().length ? form.body_text.trim() : null,
      };

      const res = form.id
        ? supabase.from('email_templates').update(payload).eq('id', form.id)
        : supabase.from('email_templates').insert(payload);

      const { error } = await res;
      if (error) throw error;

      push('success', form.id ? 'Template aggiornato.' : 'Template creato.');
      await loadTemplates();
      startNew();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [supabase, ownerId, form, push, loadTemplates, startNew]);

  const handleDelete = useCallback(
    async (tpl: EmailTemplate) => {
      if (!supabase) return;
      if (!confirm(`Eliminare il template "${tpl.name}"?`)) return;

      setDeleting((p) => ({ ...p, [tpl.id]: true }));
      try {
        const { error } = await supabase.from('email_templates').delete().eq('id', tpl.id);
        if (error) throw error;
        push('success', 'Template eliminato.');
        if (selectedId === tpl.id) startNew();
        await loadTemplates();
      } catch (e: unknown) {
        push('error', e instanceof Error ? e.message : String(e));
      } finally {
        setDeleting((p) => ({ ...p, [tpl.id]: false }));
      }
    },
    [supabase, push, selectedId, startNew, loadTemplates]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="space-y-2">
        <Link href="/email" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <span aria-hidden>←</span>
          Email
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Template Email</h1>
          <p className="text-sm text-muted">Crea template con variabili e anteprima rapida.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* List */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">I tuoi template</h2>
            <button type="button" className="btn btn-secondary" onClick={startNew}>
              Nuovo
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-muted">Caricamento…</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-muted">Nessun template. Clicca “Nuovo”.</div>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => {
                const active = tpl.id === selectedId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedId(tpl.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                      active ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">{tpl.name}</div>
                        <div className="text-xs text-muted truncate mt-0.5">{tpl.subject}</div>
                      </div>
                      <span className="text-[10px] text-muted whitespace-nowrap">
                        {new Date(tpl.updated_at).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {templates.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted">
                Variabili disponibili: {templateVars.map((v) => `{{${v.key}}}`).join(', ')}
              </p>
            </div>
          )}
        </section>

        {/* Editor */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Editor</h2>
              <p className="text-sm text-muted">Compila nome, subject e contenuto.</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedTemplate ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedTemplate)}
                  disabled={Boolean(deleting[selectedTemplate.id])}
                  className="btn btn-danger"
                >
                  {deleting[selectedTemplate.id] ? 'Elimino…' : 'Elimina'}
                </button>
              ) : null}
              <button type="button" onClick={() => void handleSave()} disabled={saving} className="btn btn-primary">
                {saving ? 'Salvataggio…' : form.id ? 'Aggiorna' : 'Crea'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Nome</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                placeholder="Benvenuto" 
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Subject</span>
              <input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                placeholder="Ciao {{first_name}}" 
              />
            </label>
          </div>

          <div className="rounded-xl border border-border bg-surface/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Variabili rapide</p>
                <p className="text-xs text-muted">Clicca per inserire nel body HTML</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {templateVars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Body HTML</span>
            <textarea
              value={form.body_html}
              onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))}
              rows={10}
              className="w-full rounded-2xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground"
              placeholder="<h1>Ciao {{first_name}}</h1>"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Body testo (opzionale)</span>
            <textarea
              value={form.body_text}
              onChange={(e) => setForm((f) => ({ ...f, body_text: e.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground"
              placeholder="Ciao {{first_name}}"
            />
          </label>

          <section className="rounded-2xl border border-border bg-surface/40 p-5 space-y-3">
            <h3 className="text-base font-semibold text-foreground">Anteprima</h3>
            <div className="text-xs text-muted">
              Preview con dati esempio: Mario Rossi · mario.rossi@example.com
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Subject</div>
              <div className="mt-1 text-sm text-foreground">{preview.subject || '—'}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">HTML</div>
              <div
                className="mt-3 prose prose-neutral dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.html || '<p>—</p>' }}
              />
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}

function TemplatesPageInner() {
  const supabase = useSupabaseSafe();
  const router = useRouter();

  return (
    <EmailGate title="Template · Bitora CRM">
      {({ user }) => (
        <AppLayout
          user={user}
          onLogout={async () => {
            if (supabase) {
              await supabase.auth.signOut();
            }
            router.push('/');
          }}
        >
          <TemplatesInner ownerId={user.id} />
        </AppLayout>
      )}
    </EmailGate>
  );
}

export default function TemplatesPage() {
  return (
    <ToastProvider>
      <TemplatesPageInner />
    </ToastProvider>
  );
}
