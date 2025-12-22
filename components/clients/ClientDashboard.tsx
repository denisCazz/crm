'use client';

import React, { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Client } from '../../types';
import { useSupabaseSafe } from '../../lib/supabase';
import ClientDetailModal from '../ClientDetailModal';
import { StatisticsModal } from '../StatisticsModal';
import { ClientEditModal } from './ClientEditModal';
import { ClientMobileCards } from './ClientMobileCards';
import { ClientDesktopTable } from './ClientDesktopTable';
import { ClientTabletTable } from './ClientTabletTable';
import { normalizeClient } from '../../lib/normalizeClient';

type FlipState = 'details' | 'edit' | null;

interface ClientDashboardProps {
  user: User;
  onRowsChange?: (rows: Client[]) => void;
  isStatsModalOpen: boolean;
  onStatsClose: () => void;
  refreshKey: number;
  isEnabled?: boolean;
}

export function ClientDashboard({ user, onRowsChange, isStatsModalOpen, onStatsClose, refreshKey, isEnabled = true }: ClientDashboardProps) {
  const [rows, setRows] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, FlipState>>({});
  const supabase = useSupabaseSafe();

  useEffect(() => {
    if (!supabase || !isEnabled) return;
    let cancelled = false;

    const loadClients = async () => {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('clients')
        .select('id, owner_id, first_name, last_name, address, notes, phone, email, tags, status, first_contacted_at, lat, lon, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setRows([]);
      } else {
        const normalized = ((data ?? []) as Client[]).map(normalizeClient);
        setRows(normalized);
      }
    };

    loadClients();

    return () => {
      cancelled = true;
    };
  }, [user.id, supabase, refreshKey, isEnabled]);

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

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

      <div className="sm:hidden">
        <ClientMobileCards
          clients={rows}
          flippedCards={flippedCards}
          onFlip={handleFlip}
          onEdit={handleEditClient}
          onDeleted={handleClientDeleted}
        />
      </div>

      <ClientDesktopTable
        clients={rows}
        onSelect={(client) => {
          setSelectedClient(client);
          setIsDetailModalOpen(true);
        }}
        onEdit={handleEditClient}
        onDeleted={handleClientDeleted}
      />

      <ClientTabletTable clients={rows} onEdit={handleEditClient} onDeleted={handleClientDeleted} />

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
