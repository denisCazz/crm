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
    <div className="card-gradient p-5 sm:p-6 animate-fade-in">
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Header Section */}
        <div className="space-y-3">
          <span className="badge badge-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-soft" />
            Overview
          </span>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Clienti attivi</h2>
            <p className="text-muted max-w-md">
              Gestisci <span className="font-semibold text-foreground">{clientsCount}</span> contatti nel tuo CRM
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Totale</span>
            </div>
            <p className="stat-value">{clientsCount}</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Telefono</span>
            </div>
            <p className="stat-value">{withPhone}</p>
          </div>

          <div className="stat-card col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
            </div>
            <p className="stat-value">{withEmail}</p>
          </div>
        </div>
      </div>

      {/* Latest Client */}
      {latestClient && latestCreatedAt && (
        <div className="relative z-10 mt-5 pt-5 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Ultimo inserimento</p>
                <p className="font-semibold text-foreground">
                  {(latestClient.first_name ?? '').trim()} {(latestClient.last_name ?? '').trim()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted bg-surface px-3 py-2 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{latestCreatedAt}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
