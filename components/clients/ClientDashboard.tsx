'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '../../lib/auth';
import { Client } from '../../types';
import ClientDetailModal from '../ClientDetailModal';
import { StatisticsModal } from '../StatisticsModal';
import { ClientEditModal } from './ClientEditModal';
import { ClientMobileCards } from './ClientMobileCards';
import { ClientDesktopTable } from './ClientDesktopTable';
import { ClientTabletTable } from './ClientTabletTable';
import { normalizeClient } from '../../lib/normalizeClient';
import { getStoredSession } from '../../lib/authClient';

type FlipState = 'details' | 'edit' | null;

interface ClientDashboardProps {
  user: User;
  onRowsChange?: (rows: Client[]) => void;
  onAddClient?: () => void;
  isStatsModalOpen: boolean;
  onStatsClose: () => void;
  refreshKey: number;
  isEnabled?: boolean;
}

export function ClientDashboard({ user, onRowsChange, onAddClient, isStatsModalOpen, onStatsClose, refreshKey, isEnabled = true }: ClientDashboardProps) {
  const [rows, setRows] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [quickFilters, setQuickFilters] = useState<{ withEmail: boolean; withPhone: boolean; withTags: boolean }>({
    withEmail: false,
    withPhone: false,
    withTags: false,
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, FlipState>>({});

  useEffect(() => {
    if (!isEnabled) return;
    let cancelled = false;

    const loadClients = async () => {
      setError(null);
      const session = getStoredSession();
      if (!session) {
        setError('Sessione scaduta. Ricarica la pagina.');
        setRows([]);
        return;
      }

      const res = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const json = await res.json().catch(() => null);

      if (cancelled) return;

      if (!res.ok) {
        setError(json?.error || 'Errore nel caricamento clienti');
        setRows([]);
      } else {
        const normalized = (((json?.clients ?? []) as Client[]) ?? []).map(normalizeClient);
        setRows(normalized);
      }
    };

    loadClients();

    return () => {
      cancelled = true;
    };
  }, [user.id, refreshKey, isEnabled]);

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 120);
    return () => window.clearTimeout(t);
  }, [query]);

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.toLowerCase();

    return rows.filter((c) => {
      if (quickFilters.withEmail && !c.email) return false;
      if (quickFilters.withPhone && !c.phone) return false;
      if (quickFilters.withTags) {
        const tags = Array.isArray(c.tags) ? c.tags.filter((t) => (t ?? '').trim().length > 0) : [];
        if (tags.length === 0) return false;
      }

      if (!q) return true;

      const tags = Array.isArray(c.tags) ? c.tags.join(' ') : '';
      const hay = `${c.first_name ?? ''} ${c.last_name ?? ''} ${c.email ?? ''} ${c.phone ?? ''} ${c.address ?? ''} ${tags}`
        .toLowerCase()
        .trim();

      return hay.includes(q);
    });
  }, [rows, debouncedQuery, quickFilters.withEmail, quickFilters.withPhone, quickFilters.withTags]);

  const resetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setQuickFilters({ withEmail: false, withPhone: false, withTags: false });
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(normalizeClient(client));
    setIsEditModalOpen(true);
  };

  const handleClientUpdated = (updated: Client) => {
    const normalized = normalizeClient(updated);
    setRows((prev) => prev.map((row) => (row.id === normalized.id ? normalized : row)));
    setEditingClient(normalized);
  };

  const handleClientDeleted = (clientId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== clientId));
    setFlippedCards((prev) => {
      if (!prev[clientId]) return prev;
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
  };

  const handleFlip = (clientId: string, state: FlipState) => {
    setFlippedCards((prev) => ({ ...prev, [clientId]: state }));
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <section className="mt-4 sm:mt-8 space-y-6">
      {error && (
        <div className="card px-4 py-3 mb-3 text-sm text-danger bg-danger/10 border border-danger/20 flex items-center gap-3 animate-slide-down">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="card-glass p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Clienti</p>
                <p className="text-xs text-muted">
                  Mostrati <span className="font-semibold text-foreground">{filteredRows.length}</span> su{' '}
                  <span className="font-semibold text-foreground">{rows.length}</span>
                </p>
              </div>
              {(query.length > 0 || quickFilters.withEmail || quickFilters.withPhone || quickFilters.withTags) && (
                <button type="button" onClick={resetFilters} className="btn btn-ghost text-xs">
                  Reset
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <svg className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Cerca per nome, email, telefono, indirizzo, tag…"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setQuickFilters((p) => ({ ...p, withEmail: !p.withEmail }))}
                  className={quickFilters.withEmail ? 'btn btn-primary text-xs py-2' : 'btn btn-outline-secondary text-xs py-2'}
                >
                  Con email
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilters((p) => ({ ...p, withPhone: !p.withPhone }))}
                  className={quickFilters.withPhone ? 'btn btn-primary text-xs py-2' : 'btn btn-outline-secondary text-xs py-2'}
                >
                  Con telefono
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilters((p) => ({ ...p, withTags: !p.withTags }))}
                  className={quickFilters.withTags ? 'btn btn-primary text-xs py-2' : 'btn btn-outline-secondary text-xs py-2'}
                >
                  Con tag
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden">
        <ClientMobileCards
          clients={filteredRows}
          onAddClient={onAddClient}
          flippedCards={flippedCards}
          onFlip={handleFlip}
          onEdit={handleEditClient}
          onDeleted={handleClientDeleted}
        />
      </div>

      <ClientDesktopTable
        clients={filteredRows}
        onAddClient={onAddClient}
        onSelect={(client) => {
          setSelectedClient(client);
          setIsDetailModalOpen(true);
        }}
        onEdit={handleEditClient}
        onDeleted={handleClientDeleted}
      />

      <ClientTabletTable clients={filteredRows} onAddClient={onAddClient} onEdit={handleEditClient} onDeleted={handleClientDeleted} />

      <ClientEditModal
        client={editingClient}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={handleClientUpdated}
      />

      <ClientDetailModal
        client={selectedClient}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedClient(null);
        }}
        onEdit={() => {
          if (selectedClient) {
            setIsDetailModalOpen(false);
            handleEditClient(selectedClient);
          }
        }}
      />

      <StatisticsModal clients={rows} isOpen={isStatsModalOpen} onClose={onStatsClose} />
    </section>
  );
}
