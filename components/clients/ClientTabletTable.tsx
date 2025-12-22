'use client';

import React from 'react';
import { Client } from '../../types';
import { DeleteClientButton } from './DeleteClientButton';

interface ClientTabletTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDeleted: (clientId: string) => void;
}

export function ClientTabletTable({ clients, onEdit, onDeleted }: ClientTabletTableProps) {
  return (
    <div className="hidden sm:block lg:hidden table-container">
      <table className="w-full text-sm">
        <thead className="table-header">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-foreground">Cliente</th>
            <th className="text-left px-4 py-3 font-semibold text-foreground">Contatti</th>
            <th className="text-left px-4 py-3 font-semibold text-foreground">Indirizzo</th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="font-medium text-foreground">Nessun cliente trovato</p>
                <p className="text-sm text-muted mt-1">Aggiungi un nuovo cliente per visualizzarlo qui</p>
              </td>
            </tr>
          ) : (
            clients.map((client, index) => (
              <tr 
                key={client.id} 
                className="table-row animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="px-4 py-3">
                  <div>
                    <div className="font-semibold text-foreground">
                      {(client.first_name ?? '').trim()} {(client.last_name ?? '').trim() || ''}
                    </div>
                    {client.notes && (
                      <div className="text-sm text-muted truncate mt-1 max-w-[20ch]">{client.notes}</div>
                    )}
                    {Array.isArray(client.tags) && client.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {client.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="badge badge-secondary text-[10px]">{tag}</span>
                        ))}
                        {client.tags.length > 2 && (
                          <span className="badge badge-accent text-[10px]">+{client.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {client.phone && (
                      <a href={`tel:${client.phone}`} className="block text-primary hover:text-primary-light text-sm font-medium">
                        {client.phone}
                      </a>
                    )}
                    {client.email && (
                      <a href={`mailto:${client.email}`} className="block text-primary hover:text-primary-light text-sm font-medium truncate max-w-[18ch]">
                        {client.email}
                      </a>
                    )}
                    {!client.phone && !client.email && (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground truncate max-w-[15ch]" title={client.address ?? undefined}>
                      {client.address ?? '—'}
                    </span>
                    {client.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost text-xs py-1 px-2"
                        title="Vedi su Maps"
                      >
                        Maps
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(client)}
                      className="btn btn-ghost btn-icon"
                      title="Modifica cliente"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <DeleteClientButton clientId={client.id} onDeleted={() => onDeleted(client.id)} />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
