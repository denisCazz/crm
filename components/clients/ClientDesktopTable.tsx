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
    <div className="hidden lg:block overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-800 text-neutral-300">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-sm">Nome</th>
            <th className="text-left px-4 py-3 font-medium text-sm">Cognome</th>
            <th className="text-left px-4 py-3 font-medium text-sm">Telefono</th>
            <th className="text-left px-4 py-3 font-medium text-sm">Email</th>
            <th className="text-right px-4 py-3 font-medium text-sm">Azioni</th>
          </tr>
        </thead>
        <tbody className="bg-neutral-900">
          {clients.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                <p className="font-medium">Nessun cliente trovato</p>
                <p className="text-sm text-neutral-600 mt-1">Aggiungi un nuovo cliente per popolare la tabella</p>
              </td>
            </tr>
          ) : (
            clients.map((client) => (
              <tr key={client.id} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                <td className="px-4 py-3">
                  <span className="font-medium text-neutral-200">{client.first_name ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-neutral-200">{client.last_name ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  {client.phone ? (
                    <a
                      href={`tel:${client.phone}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                      title={`Chiama ${client.phone}`}
                    >
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {client.email ? (
                    <a
                      href={`mailto:${client.email}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors font-medium max-w-[200px] truncate inline-block"
                      title={`Email ${client.email}`}
                    >
                      {client.email}
                    </a>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(client)}
                      className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
                      title="Vedi dettagli"
                    >
                      Dettagli
                    </button>
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
