'use client';
import React from 'react';
import { Client } from '../types';

interface StatisticsModalProps {
  clients: Client[];
  isOpen: boolean;
  onClose: () => void;
}

export function StatisticsModal({ clients, isOpen, onClose }: StatisticsModalProps) {
  if (!isOpen) return null;

  // Calcoli KPI
  const totalClients = clients.length;
  const clientsWithPhone = clients.filter(c => c.phone).length;
  const clientsWithEmail = clients.filter(c => c.email).length;
  const clientsWithBoth = clients.filter(c => c.phone && c.email).length;
  const mappedClients = clients.filter(c => c.lat && c.lon).length;
  const clientsWithNotes = clients.filter(c => c.notes).length;
  
  // Statistiche per tags
  const allTags = clients.flatMap(c => c.tags || []);
  const tagStats = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Clienti per mese (ultimi 6 mesi)
  const monthlyStats = clients.reduce((acc, client) => {
    const month = new Date(client.created_at).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedMonths = Object.entries(monthlyStats)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .slice(-6);

  const maxMonthlyCount = Math.max(...Object.values(monthlyStats), 1);

  const percentageWithPhone = totalClients > 0 ? Math.round((clientsWithPhone / totalClients) * 100) : 0;
  const percentageWithEmail = totalClients > 0 ? Math.round((clientsWithEmail / totalClients) * 100) : 0;
  const percentageMapped = totalClients > 0 ? Math.round((mappedClients / totalClients) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border px-6 py-4 flex items-center justify-between bg-surface-elevated">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Statistiche CRM</h2>
                <p className="text-sm text-muted">Dashboard completa del tuo business</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-icon"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="stat-value">{totalClients}</div>
                  <div className="text-sm text-muted">Clienti Totali</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <div className="stat-value">{clientsWithPhone}</div>
                  <div className="text-sm text-muted">Con Telefono ({percentageWithPhone}%)</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="stat-value">{clientsWithEmail}</div>
                  <div className="text-sm text-muted">Con Email ({percentageWithEmail}%)</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="stat-value">{mappedClients}</div>
                  <div className="text-sm text-muted">Mappati ({percentageMapped}%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grafico Clienti per Mese */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Clienti Acquisiti (Ultimi 6 Mesi)
            </h3>
            <div className="flex items-end gap-2 h-40">
              {sortedMonths.map(([month, count]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs font-semibold text-foreground">{count}</div>
                  <div 
                    className="w-full bg-gradient-to-t from-primary to-accent rounded-t transition-all duration-500"
                    style={{ height: `${Math.max((count / maxMonthlyCount) * 120, 8)}px` }}
                  />
                  <div className="text-xs text-muted text-center">{month}</div>
                </div>
              ))}
              {sortedMonths.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-muted text-sm">
                  Nessun dato disponibile
                </div>
              )}
            </div>
          </div>

          {/* Statistiche Tags */}
          {Object.keys(tagStats).length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Distribuzione Tags
              </h3>
              <div className="space-y-3">
                {Object.entries(tagStats)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([tag, count]) => {
                    const percentage = Math.round((count / totalClients) * 100);
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{tag}</span>
                            <span className="text-sm text-muted">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Statistiche Dettagliate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Completezza Dati */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Completezza Dati
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated">
                  <span className="text-sm text-foreground">Clienti completi (Tel + Email)</span>
                  <span className="font-semibold text-foreground">{clientsWithBoth} / {totalClients}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated">
                  <span className="text-sm text-foreground">Con note</span>
                  <span className="font-semibold text-foreground">{clientsWithNotes} / {totalClients}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated">
                  <span className="text-sm text-foreground">Con indirizzo mappato</span>
                  <span className="font-semibold text-foreground">{mappedClients} / {totalClients}</span>
                </div>
              </div>
            </div>

            {/* Azioni Rapide */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Azioni Suggerite
              </h3>
              <div className="space-y-3">
                {percentageWithPhone < 80 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm text-foreground">Aggiungi numeri di telefono mancanti ({totalClients - clientsWithPhone} clienti)</span>
                  </div>
                )}
                {percentageWithEmail < 70 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm text-foreground">Completa indirizzi email ({totalClients - clientsWithEmail} clienti)</span>
                  </div>
                )}
                {percentageMapped < 60 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm text-foreground">Mappa indirizzi rimanenti ({totalClients - mappedClients} clienti)</span>
                  </div>
                )}
                {percentageWithPhone >= 80 && percentageWithEmail >= 70 && percentageMapped >= 60 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <svg className="w-5 h-5 text-success flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-foreground">Database ben strutturato! Continua così.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 flex justify-end bg-surface">
          <button onClick={onClose} className="btn btn-secondary">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}