'use client';

import React from 'react';
import { Client } from '../../types';

interface ClientOverviewProps {
  clientsCount: number;
  withPhone: number;
  withEmail: number;
  latestClient: Client | null;
  latestCreatedAt: string | null;
}

export function ClientOverview({ clientsCount, withPhone, withEmail, latestClient, latestCreatedAt }: ClientOverviewProps) {
  return (
    <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800/70 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
            Overview
          </span>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-neutral-50">Clienti attivi</h2>
            <p className="text-sm text-neutral-400">
              Attualmente gestisci <span className="font-semibold text-neutral-200">{clientsCount}</span> contatti nel CRM.
            </p>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/80 p-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Telefono disponibile</p>
            <p className="mt-1 text-lg font-semibold text-neutral-50">{withPhone}</p>
            <p className="text-xs text-neutral-500">Numeri pronti al contatto diretto</p>
          </div>
          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/80 p-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Email archiviate</p>
            <p className="mt-1 text-lg font-semibold text-neutral-50">{withEmail}</p>
            <p className="text-xs text-neutral-500">Clienti raggiungibili via mail</p>
          </div>
        </div>
      </div>
      {latestClient && latestCreatedAt && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-neutral-800/60 bg-neutral-900/60 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Ultimo inserimento</p>
            <p className="text-sm font-medium text-neutral-100">
              {(latestClient.first_name ?? '').trim()} {(latestClient.last_name ?? '').trim()}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-800/50 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{latestCreatedAt}</span>
          </div>
        </div>
      )}
    </div>
  );
}
