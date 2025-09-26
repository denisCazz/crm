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
    <div className="hidden sm:block lg:hidden overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-800 text-neutral-300">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Cliente</th>
            <th className="text-left px-4 py-3 font-medium">Contatti</th>
            <th className="text-left px-4 py-3 font-medium">Indirizzo</th>
            <th className="text-right px-4 py-3 font-medium">Azioni</th>
          </tr>
        </thead>
        <tbody className="bg-neutral-900">
          {clients.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                <p className="font-medium">Nessun cliente trovato</p>
                <p className="text-sm text-neutral-600 mt-1">Aggiungi un nuovo cliente per visualizzarlo qui</p>
              </td>
            </tr>
          ) : (
            clients.map((client) => (
              <tr key={client.id} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-neutral-200">
                      {(client.first_name ?? '').trim()} {(client.last_name ?? '').trim() || ''}
                    </div>
                    {client.notes && <div className="text-sm text-neutral-400 truncate mt-1">{client.notes}</div>}
                    {Array.isArray(client.tags) && client.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {client.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-medium">
                            {tag}
                          </span>
                        ))}
                        {client.tags.length > 2 && (
                          <span className="text-xs text-neutral-500">+{client.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {client.phone && (
                      <a href={`tel:${client.phone}`} className="block text-blue-400 hover:text-blue-300 text-sm font-medium">
                        {client.phone}
                      </a>
                    )}
                    {client.email && (
                      <a
                        href={`mailto:${client.email}`}
                        className="block text-blue-400 hover:text-blue-300 text-sm font-medium truncate"
                      >
                        {client.email}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-300 truncate max-w-[15ch]" title={client.address ?? undefined}>
                      {client.address ?? '—'}
                    </span>
                    {client.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 font-medium"
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
                      className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
                      title="Modifica cliente"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
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
