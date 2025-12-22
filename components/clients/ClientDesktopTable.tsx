'use client';

import React from 'react';
import { Client } from '../../types';
import { DeleteClientButton } from './DeleteClientButton';

interface ClientDesktopTableProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDeleted: (clientId: string) => void;
}

export function ClientDesktopTable({ clients, onSelect, onEdit, onDeleted }: ClientDesktopTableProps) {
  return (
    <div className="hidden lg:block table-container overflow-hidden">
      <table className="min-w-full">
        <thead className="table-header">
          <tr>
            <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Nome</th>
            <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Cognome</th>
            <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Telefono</th>
            <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Email</th>
            <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Tags</th>
            <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Nessun cliente trovato</p>
                    <p className="text-sm text-muted mt-1">Aggiungi un nuovo cliente per iniziare</p>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            clients.map((client, index) => {
              const tags = Array.isArray(client.tags) ? client.tags.filter(t => t?.trim()) : [];
              return (
                <tr
                  key={client.id}
                  className="table-row group animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="px-5 py-4">
                    <span className="font-medium text-foreground">{client.first_name ?? '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-foreground">{client.last_name ?? '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    {client.phone ? (
                      <a
                        href={`tel:${client.phone}`}
                        className="inline-flex items-center gap-2 text-primary hover:text-primary-light transition-colors font-medium group/link"
                      >
                        <svg className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {client.phone}
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {client.email ? (
                      <a
                        href={`mailto:${client.email}`}
                        className="text-primary hover:text-primary-light transition-colors font-medium max-w-[200px] truncate inline-block"
                      >
                        {client.email}
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="badge badge-primary text-[10px] py-0.5">
                            {tag}
                          </span>
                        ))}
                        {tags.length > 2 && (
                          <span className="badge badge-secondary text-[10px] py-0.5">
                            +{tags.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onSelect(client)}
                        className="btn btn-primary py-1.5 px-3 text-xs"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Dettagli
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(client)}
                        className="btn btn-ghost btn-icon"
                        title="Modifica"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <DeleteClientButton clientId={client.id} onDeleted={() => onDeleted(client.id)} />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
