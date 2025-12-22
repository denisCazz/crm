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
  const tags = Array.isArray(client.tags) ? client.tags.filter(t => t?.trim()) : [];

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="modal-content w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
              {client.first_name} {client.last_name}
            </h2>
            <p className="text-sm text-muted">Dettagli cliente</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {onEdit && (
              <button
                onClick={onEdit}
                className="btn btn-primary py-2 px-3 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifica
              </button>
            )}
            <button 
              onClick={onClose}
              className="btn btn-ghost btn-icon"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, idx) => (
                <span key={idx} className="badge badge-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Informazioni Base */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Nome</h3>
              <p className="text-foreground font-medium">
                {client.first_name || 'Non specificato'}
              </p>
            </div>
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Cognome</h3>
              <p className="text-foreground font-medium">
                {client.last_name || 'Non specificato'}
              </p>
            </div>
          </div>

          {/* Contatti */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Telefono</h3>
              {client.phone ? (
                <a 
                  href={`tel:${client.phone}`}
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-light transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {client.phone}
                </a>
              ) : (
                <p className="text-muted">Non specificato</p>
              )}
            </div>
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Email</h3>
              {client.email ? (
                <a 
                  href={`mailto:${client.email}`}
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-light transition-colors font-medium truncate"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate">{client.email}</span>
                </a>
              ) : (
                <p className="text-muted">Non specificato</p>
              )}
            </div>
          </div>

          {/* Indirizzo */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Indirizzo</h3>
            {client.address ? (
              <div className="space-y-3">
                <p className="text-foreground">{client.address}</p>
                {hasCoordinates && (
                  <p className="text-xs text-muted">
                    📍 {client.lat?.toFixed(6)}, {client.lon?.toFixed(6)}
                  </p>
                )}
                <button
                  onClick={() => {
                    if (hasCoordinates) {
                      window.open(`https://www.google.com/maps?q=${client.lat},${client.lon}`, '_blank');
                    } else if (client.address) {
                      window.open(`https://www.google.com/maps/search/${encodeURIComponent(client.address)}`, '_blank');
                    }
                  }}
                  className="btn btn-outline py-1.5 px-3 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Apri in Maps
                </button>
              </div>
            ) : (
              <p className="text-muted">Non specificato</p>
            )}
          </div>

          {/* Note */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Note</h3>
            {client.notes ? (
              <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
            ) : (
              <p className="text-muted">Nessuna nota</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-4 sm:px-6 py-4 flex justify-end">
          <button 
            onClick={onClose}
            className="btn btn-secondary"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}