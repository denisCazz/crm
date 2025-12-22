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
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[calc(100vh-2rem)] modal-content flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-foreground">Modifica cliente</h3>
            <p className="text-sm text-muted">Aggiorna le informazioni del contatto</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            aria-label="Chiudi"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={updateClient} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 no-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Nome</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                className="input-field"
                placeholder="Mario"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Cognome</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className="input-field"
                placeholder="Rossi"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Indirizzo</label>
            <AddressAutocomplete
              value={form.address}
              onChange={(value) => setForm((f) => ({ ...f, address: value }))}
              placeholder="Via, numero civico, città…"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Telefono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="input-field"
                placeholder="+39 123 456 7890"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Note</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="input-field resize-none"
              placeholder="Aggiungi note..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">Tag</label>
            <TagInput
              tags={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              placeholder="Aggiungi tag..."
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
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Annulla
          </button>
          <button
            type="submit"
            onClick={updateClient}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Salva modifiche
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
