'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastProvider, useToast } from '../../components/Toaster';
import LoginForm from '../../components/LoginForm';
import { useAuth } from '../../lib/useAuth';
import { signOut, getStoredSession } from '../../lib/authClient';
import { AppLayout } from '../../components/layout/AppLayout';
import { useLicense, type LicenseState } from '../../lib/useLicense';
import type { User } from '../../lib/auth';

interface Deadline {
  id: string;
  owner_id: string;
  client_id: string | null;
  document_id: string | null;
  title: string;
  description: string | null;
  due_at: string;
  priority: string;
  status: string;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client_first_name?: string | null;
  client_last_name?: string | null;
  document_title?: string | null;
}

interface Client { id: string; first_name: string | null; last_name: string | null; email: string | null; }
interface Document { id: string; title: string; }

const PRIORITIES = [
  { value: 'low', label: 'Bassa', color: 'text-muted' },
  { value: 'normal', label: 'Normale', color: 'text-blue-400' },
  { value: 'high', label: 'Alta', color: 'text-amber-400' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-400' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Aperta', badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  { value: 'done', label: 'Completata', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  { value: 'overdue', label: 'Scaduta', badge: 'bg-red-500/10 border-red-500/20 text-red-400' },
  { value: 'cancelled', label: 'Annullata', badge: 'bg-surface-hover border-border text-muted' },
];

function getStatusBadge(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.badge ?? 'bg-surface-hover border-border text-muted';
}
function getStatusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}
function getPriorityColor(priority: string): string {
  return PRIORITIES.find((p) => p.value === priority)?.color ?? 'text-muted';
}
function getPriorityLabel(priority: string): string {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

function isOverdue(dl: Deadline): boolean {
  return dl.status === 'open' && new Date(dl.due_at).getTime() < Date.now();
}

function isDueToday(dl: Deadline): boolean {
  if (dl.status !== 'open') return false;
  const due = new Date(dl.due_at);
  const today = new Date();
  return due.toDateString() === today.toDateString();
}

function isDueThisWeek(dl: Deadline): boolean {
  if (dl.status !== 'open') return false;
  const due = new Date(dl.due_at).getTime();
  const now = Date.now();
  return due > now && due < now + 7 * 24 * 60 * 60 * 1000;
}

const emptyForm = {
  title: '',
  description: '',
  due_at: '',
  priority: 'normal',
  client_id: '',
  document_id: '',
  reminder_at: '',
};

function DeadlinesApp() {
  const router = useRouter();
  const { push } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const licenseState: LicenseState = useLicense(user);

  useEffect(() => { setUser(authUser); setLoading(authLoading); }, [authUser, authLoading]);
  useEffect(() => { document.title = 'Scadenze · Bitora CRM'; }, []);

  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterQuery, setFilterQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canUse = licenseState.status === 'active';

  const loadData = useCallback(async () => {
    if (!user) return;
    const session = getStoredSession();
    const token = session?.token;
    if (!token) return;

    setLoadingData(true);
    try {
      const statusParam = filterStatus === 'all' ? '' : `?status=${filterStatus}`;
      const [dlRes, clientsRes, docsRes] = await Promise.all([
        fetch(`/api/deadlines${statusParam}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clients', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/documents', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dlJson = (await dlRes.json()) as { deadlines?: Deadline[] };
      const clientsJson = (await clientsRes.json()) as { clients?: Client[] };
      const docsJson = (await docsRes.json()) as { documents?: Document[] };
      setDeadlines(dlJson.deadlines ?? []);
      setClients(clientsJson.clients ?? []);
      setDocuments(docsJson.documents ?? []);
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingData(false);
    }
  }, [user, filterStatus, push]);

  useEffect(() => {
    if (canUse) void loadData();
  }, [canUse, loadData]);

  const kpis = useMemo(() => {
    const all = deadlines;
    return {
      today: all.filter(isDueToday).length,
      thisWeek: all.filter(isDueThisWeek).length,
      overdue: all.filter(isOverdue).length,
      done: all.filter((d) => d.status === 'done').length,
    };
  }, [deadlines]);

  const filtered = useMemo(() => {
    let dl = deadlines;
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      dl = dl.filter((d) =>
        d.title.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        (d.client_first_name ?? '').toLowerCase().includes(q) ||
        (d.client_last_name ?? '').toLowerCase().includes(q)
      );
    }
    return dl;
  }, [deadlines, filterQuery]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim() || !form.due_at) {
      push('error', 'Titolo e scadenza sono obbligatori.');
      return;
    }
    const session = getStoredSession();
    const token = session?.token;
    if (!token) { push('error', 'Sessione non valida.'); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_at: form.due_at,
        priority: form.priority,
        client_id: form.client_id || null,
        document_id: form.document_id || null,
        reminder_at: form.reminder_at || null,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/deadlines/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/deadlines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Errore salvataggio');

      push('success', editingId ? 'Scadenza aggiornata.' : 'Scadenza creata.');
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadData();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, push, loadData]);

  const handleStatusChange = useCallback(async (dl: Deadline, newStatus: string) => {
    const session = getStoredSession();
    const token = session?.token;
    if (!token) return;

    try {
      const res = await fetch(`/api/deadlines/${dl.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Errore');
      push('success', newStatus === 'done' ? 'Scadenza completata!' : 'Stato aggiornato.');
      await loadData();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    }
  }, [push, loadData]);

  const handleDelete = useCallback(async (dl: Deadline) => {
    if (!confirm(`Eliminare la scadenza "${dl.title}"?`)) return;
    const session = getStoredSession();
    const token = session?.token;
    if (!token) return;

    try {
      await fetch(`/api/deadlines/${dl.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      push('success', 'Scadenza eliminata.');
      await loadData();
    } catch {
      push('error', 'Errore eliminazione.');
    }
  }, [push, loadData]);

  const openEdit = useCallback((dl: Deadline) => {
    setEditingId(dl.id);
    setForm({
      title: dl.title,
      description: dl.description ?? '',
      due_at: dl.due_at ? dl.due_at.slice(0, 16) : '',
      priority: dl.priority,
      client_id: dl.client_id ?? '',
      document_id: dl.document_id ?? '',
      reminder_at: dl.reminder_at ? dl.reminder_at.slice(0, 16) : '',
    });
    setShowForm(true);
  }, []);

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted">Verifica della licenza…</p>
      </div>
    );
  }

  if (licenseState.status === 'inactive' || licenseState.status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 px-6 py-8 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Licenza richiesta</h2>
          <p className="text-sm text-muted">
            {licenseState.status === 'error' ? licenseState.message : licenseState.reason}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout user={user} onLogout={async () => { await signOut(); router.push('/'); }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Scadenze</h1>
            <p className="text-sm text-muted mt-1">Gestisci le scadenze e i reminder per i tuoi clienti.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
          >
            + Nuova scadenza
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Oggi', value: kpis.today, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Questa settimana', value: kpis.thisWeek, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Scadute', value: kpis.overdue, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Completate', value: kpis.done, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-2xl border border-border p-4 space-y-1 ${kpi.bg}`}>
              <p className="text-xs text-muted uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Cerca scadenze…"
            className="input-field w-full"
          />
          <div className="flex gap-1 flex-wrap">
            {(['open', 'done', 'overdue', 'cancelled', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                  filterStatus === s
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted hover:border-border-hover hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'Tutte' : getStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loadingData ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mr-3" />
            Caricamento…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-12 text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-foreground">Nessuna scadenza trovata</p>
              <p className="text-sm text-muted mt-1">Crea una nuova scadenza con il pulsante in alto.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((dl) => {
              const overdue = isOverdue(dl);
              const today = isDueToday(dl);
              return (
                <div
                  key={dl.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    overdue
                      ? 'border-red-500/30 bg-red-500/5'
                      : today
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border bg-surface/60 hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Complete checkbox */}
                    {dl.status === 'open' || dl.status === 'done' ? (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(dl, dl.status === 'done' ? 'open' : 'done')}
                        className={`mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 transition-all ${
                          dl.status === 'done'
                            ? 'border-emerald-500 bg-emerald-500 text-white flex items-center justify-center'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        {dl.status === 'done' && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <div className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`font-semibold ${dl.status === 'done' ? 'line-through text-muted' : 'text-foreground'}`}>
                            {dl.title}
                          </p>
                          {dl.description && (
                            <p className="text-sm text-muted mt-0.5 truncate">{dl.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(dl.status)}`}>
                            {getStatusLabel(dl.status)}
                          </span>
                          <span className={`text-xs font-medium ${getPriorityColor(dl.priority)}`}>
                            ↑ {getPriorityLabel(dl.priority)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className={`text-xs font-medium ${overdue ? 'text-red-400' : today ? 'text-amber-400' : 'text-muted'}`}>
                          📅 {formatDateTime(dl.due_at)}
                          {overdue && ' · SCADUTA'}
                          {today && !overdue && ' · OGGI'}
                        </span>
                        {(dl.client_first_name || dl.client_last_name) && (
                          <span className="text-xs text-muted">
                            👤 {[dl.client_first_name, dl.client_last_name].filter(Boolean).join(' ')}
                          </span>
                        )}
                        {dl.document_title && (
                          <span className="text-xs text-muted">📄 {dl.document_title}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon text-muted hover:text-foreground"
                        onClick={() => openEdit(dl)}
                        title="Modifica"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon text-muted hover:text-danger"
                        onClick={() => void handleDelete(dl)}
                        title="Elimina"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {editingId ? 'Modifica scadenza' : 'Nuova scadenza'}
              </h3>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-130px)] px-6 py-5 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Titolo *</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="input-field"
                  placeholder="Es. Rinnovo contratto"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Scadenza *</span>
                  <input type="datetime-local" value={form.due_at} onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))} className="input-field" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Priorità</span>
                  <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className="input-field">
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cliente</span>
                  <select value={form.client_id} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))} className="input-field">
                    <option value="">Nessuno</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Documento</span>
                  <select value={form.document_id} onChange={(e) => setForm((p) => ({ ...p, document_id: e.target.value }))} className="input-field">
                    <option value="">Nessuno</option>
                    {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Reminder</span>
                <input type="datetime-local" value={form.reminder_at} onChange={(e) => setForm((p) => ({ ...p, reminder_at: e.target.value }))} className="input-field" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Descrizione</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Note opzionali…"
                />
              </label>
            </div>
            <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annulla</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Salvataggio…' : editingId ? 'Aggiorna' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function ScadenzeePage() {
  return (
    <ToastProvider>
      <DeadlinesApp />
    </ToastProvider>
  );
}
