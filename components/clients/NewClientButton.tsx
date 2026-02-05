'use client';

import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { TagInput } from '../TagInput';
import { useToast } from '../Toaster';
import { useSupabaseSafe } from '../../lib/supabase';
import { Client } from '../../types';
import { getStoredSession } from '../../lib/authClient';

interface NewClientButtonProps {
  onCreated: (client: Client) => void;
  fullWidth?: boolean;
}

export interface NewClientButtonRef {
  openModal: () => void;
}

export const NewClientButton = forwardRef<NewClientButtonRef, NewClientButtonProps>(
  function NewClientButton({ onCreated, fullWidth = false }, ref) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    address: '',
    notes: '',
    phone: '',
    email: '',
    tags: [] as string[],
  });
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  useImperativeHandle(ref, () => ({
    openModal: () => setOpen(true),
  }));

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, [open]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setErr(null);
    try {
      const session = getStoredSession();
      const uid = session?.user_id;
      if (!uid) throw new Error('Utente non autenticato');

      const insert = {
        owner_id: uid,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        address: form.address || null,
        notes: form.notes || null,
        phone: form.phone || null,
        email: form.email || null,
        tags: form.tags.length > 0 ? form.tags : null,
        status: 'new',
      };

      const { data, error } = await supabase
        .from('clients')
        .insert(insert)
        .select('id, owner_id, first_name, last_name, address, notes, phone, email, tags, status, first_contacted_at, created_at, lat, lon')
        .single();

      if (error) throw error;

      if (data?.address) {
        await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.id, address: data.address, owner_id: data.owner_id }),
        });
      }

      onCreated(data as Client);
      push('success', 'Cliente creato con successo!');
      setOpen(false);
      setForm({ first_name: '', last_name: '', address: '', notes: '', phone: '', email: '', tags: [] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn btn-primary ${fullWidth ? 'w-full' : ''}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nuovo cliente
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4 sm:p-6 animate-fade-in"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden modal-content flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Gradient top bar */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[rgb(var(--color-primary))] via-[rgb(var(--color-secondary))] to-[rgb(var(--color-accent))]" />
            
            {/* Close button */}
            <button
              type="button"
              onClick={() => !saving && setOpen(false)}
              className="absolute right-4 top-4 btn btn-ghost btn-icon z-10"
              aria-label="Chiudi modale nuovo cliente"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
              <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="space-y-3">
                  <span className="badge badge-primary">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Nuovo cliente
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-foreground">Registra un nuovo contatto</h3>
                    <p className="text-sm text-muted">
                      Inserisci le informazioni per aggiungere il cliente alla tua pipeline.
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={createClient} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Nome</span>
                      <input
                        value={form.first_name}
                        onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                        className="input-field"
                        placeholder="Mario"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cognome</span>
                      <input
                        value={form.last_name}
                        onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                        className="input-field"
                        placeholder="Rossi"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Indirizzo</span>
                      <span className="text-[11px] text-muted-foreground">Suggerimenti automatici</span>
                    </div>
                    <AddressAutocomplete
                      value={form.address}
                      onChange={(value) => setForm((f) => ({ ...f, address: value }))}
                      placeholder="Via, numero civico, città…"
                      className="input-field"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Telefono</span>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="input-field"
                        placeholder="+39 123 456 7890"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Email</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="input-field"
                        placeholder="cliente@email.com"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Note</span>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="input-field resize-none"
                      placeholder="Dettagli utili, prossimi step, referenti..."
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tag</span>
                    <TagInput
                      tags={form.tags}
                      onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                      placeholder="Aggiungi tag per categorizzare..."
                      className="mt-1"
                    />
                  </div>

                  {err && (
                    <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {err}
                    </div>
                  )}

                  <div className="divider" />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted">I dati potranno essere aggiornati in qualsiasi momento.</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        disabled={saving}
                        className="btn btn-secondary"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary"
                      >
                        {saving ? (
                          <>
                            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                            Salvataggio…
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Salva cliente
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
