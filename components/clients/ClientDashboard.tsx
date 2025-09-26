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

type FlipState = 'details' | 'edit' | null;

interface ClientDashboardProps {
  user: User;
  onRowsChange?: (rows: Client[]) => void;
  isStatsModalOpen: boolean;
  onStatsClose: () => void;
  refreshKey: number;
}

export function ClientDashboard({ user, onRowsChange, isStatsModalOpen, onStatsClose, refreshKey }: ClientDashboardProps) {
  const [rows, setRows] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, FlipState>>({});
  const supabase = useSupabaseSafe();

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const loadClients = async () => {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('clients')
        .select('id, owner_id, first_name, last_name, address, notes, phone, email, tags, lat, lon, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setRows([]);
      } else {
        setRows((data as Client[]) ?? []);
      }
    };

    loadClients();

    return () => {
      cancelled = true;
    };
  }, [user.id, supabase, refreshKey]);

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsEditModalOpen(true);
  };

  const handleClientUpdated = (updated: Client) => {
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setEditingClient(updated);
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

  return (
    <section className="mt-4 sm:mt-8 space-y-6">
      {error && (
        <div className="px-4 py-3 mb-3 text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl">{error}</div>
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
