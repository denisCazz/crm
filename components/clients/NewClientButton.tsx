'use client';

import React, { useEffect, useState } from 'react';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { TagInput } from '../TagInput';
import { useToast } from '../Toaster';
import { useSupabaseSafe } from '../../lib/supabase';
import { Client } from '../../types';

interface NewClientButtonProps {
  onCreated: (client: Client) => void;
  fullWidth?: boolean;
}

export function NewClientButton({ onCreated, fullWidth = false }: NewClientButtonProps) {
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
      const { data: who } = await supabase.auth.getUser();
      const uid = who?.user?.id;
      if (!uid) throw new Error('Utente non autenticato');

      const insert = {
        owner_id: uid,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        address: form.address || null,
        notes: form.notes || null,
        phone: form.phone || null,
        email: form.email || null,
      };

      const { data, error } = await supabase
        .from('clients')
        .insert(insert)
        .select('id, owner_id, first_name, last_name, address, notes, phone, email, tags, created_at, lat, lon')
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
        className={`inline-flex ${fullWidth ? 'w-full' : ''} items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 px-4 sm:px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-blue-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 focus-visible:ring-offset-neutral-950`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14m7-7H5" />
        </svg>
        Nuovo cliente
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl border border-neutral-800/70 bg-neutral-950/95 shadow-[0_25px_70px_-30px_rgba(0,0,0,0.8)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-500" />
            <button
              type="button"
              onClick={() => !saving && setOpen(false)}
              className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700/70 bg-neutral-900/70 text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
              aria-label="Chiudi modale nuovo cliente"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
              <div className="flex flex-col gap-6">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-blue-300">
                    Nuovo cliente
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-semibold text-neutral-50">Registra un nuovo contatto</h3>
                    <p className="text-sm text-neutral-400">
                      Inserisci le informazioni principali per aggiungere rapidamente il cliente alla tua pipeline.
                    </p>
                  </div>
                </div>

                <form onSubmit={createClient} className="space-y-5 pb-2 sm:pb-0">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Nome</span>
                    <input
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.75 text-sm text-neutral-100 placeholder-neutral-500 transition focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Cognome</span>
                    <input
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.75 text-sm text-neutral-100 placeholder-neutral-500 transition focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Indirizzo</span>
                    <span className="text-[11px] text-neutral-500">Suggerimenti automatici con OpenStreetMap</span>
                  </div>
                  <AddressAutocomplete
                    value={form.address}
                    onChange={(value) => setForm((f) => ({ ...f, address: value }))}
                    placeholder="Via, numero civico, città…"
                    className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.75 text-sm text-neutral-100 placeholder-neutral-500 transition focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Telefono</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.75 text-sm text-neutral-100 placeholder-neutral-500 transition focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      placeholder="+39 123 456 7890"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-2.75 text-sm text-neutral-100 placeholder-neutral-500 transition focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      placeholder="cliente@email.com"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Note</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-neutral-800/70 bg-neutral-900/70 px-3.5 py-3 text-sm text-neutral-100 placeholder-neutral-500 transition focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Dettagli utili, prossimi step, referenti..."
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tag</span>
                  <TagInput
                    tags={form.tags}
                    onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                    placeholder="Aggiungi tag per categorizzare il cliente…"
                    className="mt-1"
                  />
                </div>

                {err && (
                  <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                    {err}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-neutral-800/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-neutral-500">I dati potranno essere aggiornati in qualsiasi momento.</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      disabled={saving}
                      className="inline-flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saving ? (
                        <>
                          <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent"></span>
                          Salvataggio…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14m7-7H5" />
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
}
