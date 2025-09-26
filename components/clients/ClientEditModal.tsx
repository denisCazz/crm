'use client';

import React, { useEffect, useState } from 'react';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { TagInput } from '../TagInput';
import { useToast } from '../Toaster';
import { useSupabaseSafe } from '../../lib/supabase';
import { Client } from '../../types';

interface ClientEditModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (client: Client) => void;
}

export function ClientEditModal({ client, isOpen, onClose, onUpdated }: ClientEditModalProps) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    address: '',
    notes: '',
    phone: '',
    email: '',
    tags: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  useEffect(() => {
    if (client && isOpen) {
      setForm({
        first_name: client.first_name ?? '',
        last_name: client.last_name ?? '',
        address: client.address ?? '',
        notes: client.notes ?? '',
        phone: client.phone ?? '',
        email: client.email ?? '',
        tags: client.tags ?? [],
      });
      setErr(null);
    }
  }, [client, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, [isOpen]);

  if (!client || !isOpen) return null;

  async function updateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    if (!supabase) return;
    setSaving(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          address: form.address || null,
          notes: form.notes || null,
          phone: form.phone || null,
          email: form.email || null,
          tags: form.tags.length > 0 ? form.tags : null,
        })
        .eq('id', client.id)
        .select('id, owner_id, first_name, last_name, address, notes, phone, email, tags, lat, lon, created_at')
        .single();

      if (error) throw error;

      if (data && data.address !== client.address) {
        await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.id, address: data.address, owner_id: data.owner_id }),
        });
      }

      onUpdated(data as Client);
      push('success', 'Cliente aggiornato con successo!');
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[calc(100vh-2rem)] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-100">Modifica cliente</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:text-neutral-200"
            aria-label="Chiudi modale modifica cliente"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={updateClient} className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-3 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Nome</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Cognome</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Indirizzo</label>
            <AddressAutocomplete
              value={form.address}
              onChange={(value) => setForm((f) => ({ ...f, address: value }))}
              placeholder="Inserisci l'indirizzo..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Telefono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
                placeholder="+39 123 456 7890"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Note</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Tag</label>
            <TagInput
              tags={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              placeholder="Aggiungi tag per categorizzare il cliente..."
            />
          </div>

          {err && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-white/90 text-black hover:bg-white font-medium disabled:opacity-70"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
