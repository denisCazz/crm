'use client';
import React from 'react';
import { Client } from '../types';

interface ClientDetailModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export default function ClientDetailModal({ client, isOpen, onClose, onEdit }: ClientDetailModalProps) {
  if (!isOpen || !client) return null;

  const hasCoordinates = client.lat && client.lon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-none sm:rounded-2xl w-full h-full sm:h-auto max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-semibold truncate">
              {client.first_name} {client.last_name}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">Dettagli cliente</p>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg sm:rounded-xl hover:bg-blue-700 transition-colors"
              >
                Modifica
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-lg sm:rounded-xl transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* Informazioni Base */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Nome</h3>
              <p className="text-white bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm">
                {client.first_name || 'Non specificato'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Cognome</h3>
              <p className="text-white bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
                {client.last_name || 'Non specificato'}
              </p>
            </div>
          </div>

          {/* Contatti */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Telefono</h3>
              {client.phone ? (
                <a 
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 transition-colors"
                >
                  {client.phone}
                </a>
              ) : (
                <p className="text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
                  Non specificato
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Email</h3>
              {client.email ? (
                <a 
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 transition-colors truncate"
                >
                  <span className="truncate">{client.email}</span>
                </a>
              ) : (
                <p className="text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
                  Non specificato
                </p>
              )}
            </div>
          </div>

          {/* Indirizzo */}
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">
              Indirizzo
            </h3>
            {client.address ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                <p className="text-white mb-2">{client.address}</p>
                {hasCoordinates && (
                  <p className="text-xs text-neutral-400 mb-2">
                    Coordinate: {client.lat?.toFixed(6)}, {client.lon?.toFixed(6)}
                  </p>
                )}
                {/* Bottone Maps */}
                <button
                  onClick={() => {
                    if (hasCoordinates) {
                      window.open(`https://www.google.com/maps?q=${client.lat},${client.lon}`, '_blank');
                    } else if (client.address) {
                      window.open(`https://www.google.com/maps/search/${encodeURIComponent(client.address)}`, '_blank');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Apri in Google Maps
                </button>
              </div>
            ) : (
              <p className="text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
                Non specificato
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-2">
              Note
            </h3>
            {client.notes ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                <p className="text-white whitespace-pre-wrap">{client.notes}</p>
              </div>
            ) : (
              <p className="text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
                Nessuna nota
              </p>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-neutral-950 border-t border-neutral-800 px-6 py-4 flex justify-end gap-3">
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