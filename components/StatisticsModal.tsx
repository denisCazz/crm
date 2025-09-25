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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">📊 Statistiche CRM</h2>
            <p className="text-sm text-neutral-400">Dashboard completa del tuo business</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-xl">
                  👥
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalClients}</div>
                  <div className="text-sm text-neutral-400">Clienti Totali</div>
                </div>
              </div>
            </div>

            <div className="bg-green-950/30 border border-green-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-xl">
                  📞
                </div>
                <div>
                  <div className="text-2xl font-bold">{clientsWithPhone}</div>
                  <div className="text-sm text-neutral-400">Con Telefono ({percentageWithPhone}%)</div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-600 rounded-xl flex items-center justify-center text-xl">
                  ✉️
                </div>
                <div>
                  <div className="text-2xl font-bold">{clientsWithEmail}</div>
                  <div className="text-sm text-neutral-400">Con Email ({percentageWithEmail}%)</div>
                </div>
              </div>
            </div>

            <div className="bg-purple-950/30 border border-purple-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-xl">
                  🗺️
                </div>
                <div>
                  <div className="text-2xl font-bold">{mappedClients}</div>
                  <div className="text-sm text-neutral-400">Mappati ({percentageMapped}%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grafico Clienti per Mese */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>📈</span>
              Clienti Acquisiti (Ultimi 6 Mesi)
            </h3>
            <div className="flex items-end gap-2 h-40">
              {sortedMonths.map(([month, count]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs font-medium text-white">{count}</div>
                  <div 
                    className="w-full bg-blue-600 rounded-t transition-all duration-300"
                    style={{ 
                      height: `${Math.max((count / maxMonthlyCount) * 120, 8)}px` 
                    }}
                  />
                  <div className="text-xs text-neutral-400 text-center">{month}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Statistiche Tags */}
          {Object.keys(tagStats).length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>🏷️</span>
                Distribuzione Tags
              </h3>
              <div className="space-y-3">
                {Object.entries(tagStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([tag, count]) => {
                    const percentage = Math.round((count / totalClients) * 100);
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{tag}</span>
                            <span className="text-sm text-neutral-400">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-neutral-800 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>✅</span>
                Completezza Dati
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Clienti completi (Tel + Email):</span>
                  <span className="font-medium">{clientsWithBoth} / {totalClients}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Con note:</span>
                  <span className="font-medium">{clientsWithNotes} / {totalClients}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Con indirizzo mappato:</span>
                  <span className="font-medium">{mappedClients} / {totalClients}</span>
                </div>
              </div>
            </div>

            {/* Azioni Rapide */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>⚡</span>
                Azioni Suggerite
              </h3>
              <div className="space-y-2">
                {percentageWithPhone < 80 && (
                  <div className="text-sm text-yellow-400">
                    • Aggiungi numeri di telefono mancanti ({totalClients - clientsWithPhone} clienti)
                  </div>
                )}
                {percentageWithEmail < 70 && (
                  <div className="text-sm text-yellow-400">
                    • Completa indirizzi email ({totalClients - clientsWithEmail} clienti)
                  </div>
                )}
                {percentageMapped < 60 && (
                  <div className="text-sm text-yellow-400">
                    • Mappa indirizzi rimanenti ({totalClients - mappedClients} clienti)
                  </div>
                )}
                {percentageWithPhone >= 80 && percentageWithEmail >= 70 && percentageMapped >= 60 && (
                  <div className="text-sm text-green-400">
                    ✨ Database ben strutturato! Continua così.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-950 border-t border-neutral-800 px-6 py-4 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}