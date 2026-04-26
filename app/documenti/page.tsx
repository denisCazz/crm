'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastProvider, useToast } from '../../components/Toaster';
import LoginForm from '../../components/LoginForm';
import { useAuth } from '../../lib/useAuth';
import { signOut, getStoredSession } from '../../lib/authClient';
import { AppLayout } from '../../components/layout/AppLayout';
import { useLicense, type LicenseState } from '../../lib/useLicense';
import type { User } from '../../lib/auth';

interface Document {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  doc_type: string | null;
  status: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  s3_key: string;
  doc_date: string | null;
  expires_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  client_first_name?: string | null;
  client_last_name?: string | null;
}

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const DOC_TYPES = [
  { value: '', label: 'Tutti i tipi' },
  { value: 'contratto', label: 'Contratto' },
  { value: 'fattura', label: 'Fattura' },
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'documento_identita', label: 'Documento identità' },
  { value: 'altro', label: 'Altro' },
];

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT');
}

function isExpiringSoon(expires: string | null): boolean {
  if (!expires) return false;
  const diff = new Date(expires).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(expires: string | null): boolean {
  if (!expires) return false;
  return new Date(expires).getTime() < Date.now();
}

function DocumentsApp() {
  const router = useRouter();
  const { push } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const licenseState: LicenseState = useLicense(user);

  useEffect(() => { setUser(authUser); setLoading(authLoading); }, [authUser, authLoading]);
  useEffect(() => { document.title = 'Documenti · Bitora CRM'; }, []);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    doc_type: '',
    description: '',
    client_id: '',
    doc_date: '',
    expires_at: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Detail/edit panel
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const canUse = licenseState.status === 'active';

  const loadData = useCallback(async () => {
    if (!user) return;
    const session = getStoredSession();
    const token = session?.token;
    if (!token) return;

    setLoadingDocs(true);
    try {
      const [docsRes, clientsRes] = await Promise.all([
        fetch(`/api/documents?status=${filterStatus || 'active'}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clients', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const docsJson = (await docsRes.json()) as { documents?: Document[]; error?: string };
      const clientsJson = (await clientsRes.json()) as { clients?: Client[]; error?: string };
      setDocuments(docsJson.documents ?? []);
      setClients(clientsJson.clients ?? []);
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDocs(false);
    }
  }, [user, filterStatus, push]);

  useEffect(() => {
    if (canUse) void loadData();
  }, [canUse, loadData]);

  const filteredDocs = useMemo(() => {
    let docs = documents;
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      docs = docs.filter((d) =>
        d.title.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        (d.file_name ?? '').toLowerCase().includes(q) ||
        (d.client_first_name ?? '').toLowerCase().includes(q) ||
        (d.client_last_name ?? '').toLowerCase().includes(q)
      );
    }
    if (filterType) docs = docs.filter((d) => d.doc_type === filterType);
    if (filterClient) docs = docs.filter((d) => d.client_id === filterClient);
    return docs;
  }, [documents, filterQuery, filterType, filterClient]);

  const handleUpload = useCallback(async () => {
    if (!uploadFile || !uploadForm.title.trim()) {
      push('error', 'Seleziona un file e inserisci un titolo.');
      return;
    }
    const session = getStoredSession();
    const token = session?.token;
    if (!token) { push('error', 'Sessione non valida.'); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('title', uploadForm.title.trim());
      if (uploadForm.doc_type) fd.append('doc_type', uploadForm.doc_type);
      if (uploadForm.description) fd.append('description', uploadForm.description);
      if (uploadForm.client_id) fd.append('client_id', uploadForm.client_id);
      if (uploadForm.doc_date) fd.append('doc_date', uploadForm.doc_date);
      if (uploadForm.expires_at) fd.append('expires_at', uploadForm.expires_at);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = (await res.json()) as { document?: Document; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Errore upload');

      push('success', 'Documento caricato con successo!');
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ title: '', doc_type: '', description: '', client_id: '', doc_date: '', expires_at: '' });
      await loadData();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploadForm, push, loadData]);

  const handleDownload = useCallback(async (doc: Document) => {
    const session = getStoredSession();
    const token = session?.token;
    if (!token) { push('error', 'Sessione non valida.'); return; }

    try {
      const res = await fetch(`/api/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as { url?: string; file_name?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Errore download');
      if (json.url) {
        const a = document.createElement('a');
        a.href = json.url;
        a.download = json.file_name ?? doc.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    }
  }, [push]);

  const handleDelete = useCallback(async (doc: Document) => {
    if (!confirm(`Archiviare il documento "${doc.title}"?`)) return;
    const session = getStoredSession();
    const token = session?.token;
    if (!token) return;

    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Errore eliminazione');
      push('success', 'Documento archiviato.');
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
      await loadData();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    }
  }, [push, selectedDoc, loadData]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Documenti</h1>
            <p className="text-sm text-muted mt-1">Gestisci e archivia i documenti dei tuoi clienti.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUpload(true)}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Carica documento
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Cerca documenti…"
            className="input-field w-full"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field flex-1 min-w-[140px]"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="input-field flex-1 min-w-[140px]"
            >
              <option value="">Tutti i clienti</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                </option>
              ))}
            </select>
            <div className="flex gap-1 flex-shrink-0">
              {(['active', 'archived', 'all'] as const).map((s) => (
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
                  {s === 'active' ? 'Attivi' : s === 'archived' ? 'Archiviati' : 'Tutti'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className={`grid gap-6 ${selectedDoc ? 'lg:grid-cols-[1fr_380px]' : ''}`}>
          {/* Document list */}
          <div className="space-y-3">
            {loadingDocs ? (
              <div className="flex items-center justify-center py-16 text-muted">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mr-3" />
                Caricamento…
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface/60 p-12 text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Nessun documento trovato</p>
                  <p className="text-sm text-muted mt-1">Carica il tuo primo documento cliccando il pulsante in alto.</p>
                </div>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const expired = isExpired(doc.expires_at);
                const expiringSoon = !expired && isExpiringSoon(doc.expires_at);
                const isSelected = selectedDoc?.id === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(isSelected ? null : doc)}
                    className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-surface/60 hover:bg-surface-hover hover:border-border-hover'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{doc.title}</p>
                            <p className="text-xs text-muted truncate">{doc.file_name} · {formatBytes(doc.file_size)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doc.doc_type && (
                              <span className="hidden sm:inline-flex items-center rounded-full bg-surface-hover border border-border px-2.5 py-0.5 text-xs font-medium text-muted capitalize">
                                {doc.doc_type.replace('_', ' ')}
                              </span>
                            )}
                            {expired && (
                              <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
                                Scaduto
                              </span>
                            )}
                            {expiringSoon && (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                                In scadenza
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {(doc.client_first_name || doc.client_last_name) && (
                            <span className="text-xs text-muted">
                              👤 {[doc.client_first_name, doc.client_last_name].filter(Boolean).join(' ')}
                            </span>
                          )}
                          {doc.doc_date && (
                            <span className="text-xs text-muted">📅 {formatDate(doc.doc_date)}</span>
                          )}
                          {doc.expires_at && (
                            <span className={`text-xs ${expired ? 'text-red-400' : expiringSoon ? 'text-amber-400' : 'text-muted'}`}>
                              ⏳ Scad. {formatDate(doc.expires_at)}
                            </span>
                          )}
                          <span className="text-xs text-muted">Caricato {formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail panel */}
          {selectedDoc && (
            <aside className="rounded-2xl border border-border bg-surface/60 p-5 space-y-4 h-fit lg:sticky lg:top-24">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">{selectedDoc.title}</h2>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon flex-shrink-0"
                  onClick={() => setSelectedDoc(null)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-surface-hover border border-border">
                    <p className="text-xs text-muted uppercase tracking-wide">Tipo</p>
                    <p className="font-medium text-foreground mt-0.5 capitalize">
                      {selectedDoc.doc_type?.replace('_', ' ') || '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover border border-border">
                    <p className="text-xs text-muted uppercase tracking-wide">Dimensione</p>
                    <p className="font-medium text-foreground mt-0.5">{formatBytes(selectedDoc.file_size)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover border border-border">
                    <p className="text-xs text-muted uppercase tracking-wide">Data doc.</p>
                    <p className="font-medium text-foreground mt-0.5">{formatDate(selectedDoc.doc_date)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover border border-border">
                    <p className="text-xs text-muted uppercase tracking-wide">Scadenza</p>
                    <p className={`font-medium mt-0.5 ${isExpired(selectedDoc.expires_at) ? 'text-red-400' : isExpiringSoon(selectedDoc.expires_at) ? 'text-amber-400' : 'text-foreground'}`}>
                      {formatDate(selectedDoc.expires_at)}
                    </p>
                  </div>
                </div>

                {selectedDoc.description && (
                  <div className="p-3 rounded-xl bg-surface-hover border border-border">
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Descrizione</p>
                    <p className="text-foreground text-sm">{selectedDoc.description}</p>
                  </div>
                )}

                {(selectedDoc.client_first_name || selectedDoc.client_last_name) && (
                  <div className="p-3 rounded-xl bg-surface-hover border border-border">
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Cliente</p>
                    <p className="font-medium text-foreground">
                      {[selectedDoc.client_first_name, selectedDoc.client_last_name].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={() => void handleDownload(selectedDoc)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Scarica
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary w-full"
                  onClick={() => void handleDelete(selectedDoc)}
                >
                  Archivia
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-content w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Carica documento</h3>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowUpload(false)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-130px)] px-6 py-5 space-y-4">
              {/* File picker */}
              <div>
                {/* Drop / click zone */}
                <div
                  className="border-2 border-dashed border-border rounded-2xl p-5 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadForm.title) setUploadForm((prev) => ({ ...prev, title: f.name.replace(/\.[^.]+$/, '') }));
                    }
                  }}
                >
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-medium text-foreground truncate">{uploadFile.name}</p>
                        <p className="text-xs text-muted">{formatBytes(uploadFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        className="ml-auto flex-shrink-0 text-muted hover:text-danger transition-colors"
                        onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                        title="Rimuovi file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <svg className="w-8 h-8 text-muted mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p className="text-sm font-medium text-foreground">Trascina qui o clicca per scegliere</p>
                      <p className="text-xs text-muted">PDF, immagini, Office, ZIP…</p>
                    </div>
                  )}

                  {/* Hidden standard file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="*/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadFile(f);
                        if (!uploadForm.title) setUploadForm((prev) => ({ ...prev, title: f.name.replace(/\.[^.]+$/, '') }));
                      }
                    }}
                  />
                </div>

                {/* Camera capture button — visible on mobile, useful on desktop too */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted px-2">oppure</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <button
                  type="button"
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Scatta una foto
                  {/* Hidden camera input — capture="environment" uses the rear camera on mobile */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadFile(f);
                        if (!uploadForm.title) setUploadForm((prev) => ({ ...prev, title: f.name.replace(/\.[^.]+$/, '') }));
                      }
                    }}
                  />
                </button>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Titolo *</span>
                <input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                  className="input-field"
                  placeholder="Es. Contratto 2024 - Mario Rossi"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tipo documento</span>
                  <select
                    value={uploadForm.doc_type}
                    onChange={(e) => setUploadForm((p) => ({ ...p, doc_type: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">Seleziona…</option>
                    {DOC_TYPES.slice(1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cliente</span>
                  <select
                    value={uploadForm.client_id}
                    onChange={(e) => setUploadForm((p) => ({ ...p, client_id: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">Nessuno</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Data documento</span>
                  <input type="date" value={uploadForm.doc_date} onChange={(e) => setUploadForm((p) => ({ ...p, doc_date: e.target.value }))} className="input-field" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Scadenza</span>
                  <input type="date" value={uploadForm.expires_at} onChange={(e) => setUploadForm((p) => ({ ...p, expires_at: e.target.value }))} className="input-field" />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Descrizione</span>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Note opzionali sul documento…"
                />
              </label>
            </div>

            <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary disabled:opacity-60"
                disabled={uploading || !uploadFile}
                onClick={() => void handleUpload()}
              >
                {uploading ? 'Caricamento…' : 'Carica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function DocumentiPage() {
  return (
    <ToastProvider>
      <DocumentsApp />
    </ToastProvider>
  );
}
