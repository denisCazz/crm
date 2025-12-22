'use client';

import React, { useState } from 'react';
import { useToast } from '../Toaster';
import { useSupabaseSafe } from '../../lib/supabase';

interface DeleteClientButtonProps {
  clientId: string;
  onDeleted: () => void;
  className?: string;
  children?: React.ReactNode;
  confirmMessage?: string;
  disabled?: boolean;
  title?: string;
  containerClassName?: string;
}

export function DeleteClientButton({
  clientId,
  onDeleted,
  className,
  children,
  confirmMessage = 'Sei sicuro di voler eliminare questo cliente?',
  disabled,
  title = 'Elimina cliente',
  containerClassName,
}: DeleteClientButtonProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  async function doDelete() {
    if (disabled || busy) return;
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    setErr(null);
    if (!supabase) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      onDeleted();
      push('success', 'Cliente eliminato con successo!');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={containerClassName ?? 'inline-flex flex-col items-end gap-1'}>
      <button
        type="button"
        data-delete-client={clientId}
        onClick={doDelete}
        disabled={busy || disabled}
        className={
          className ??
          'btn btn-ghost btn-icon text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50'
        }
        title={title}
      >
        {children ?? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        )}
      </button>
      {err && <span className="text-xs text-danger px-2">{err}</span>}
    </div>
  );
}
