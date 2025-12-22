'use client';

import React from 'react';
import { Client } from '../../types';
import { DeleteClientButton } from './DeleteClientButton';

type FlipState = 'details' | 'edit' | null;

interface ClientMobileCardsProps {
  clients: Client[];
  flippedCards: Record<string, FlipState>;
  onFlip: (clientId: string, state: FlipState) => void;
  onEdit: (client: Client) => void;
  onDeleted: (clientId: string) => void;
}

export function ClientMobileCards({ clients, flippedCards, onFlip, onEdit, onDeleted }: ClientMobileCardsProps) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-foreground">Nessun cliente trovato</p>
        <p className="text-sm text-muted mt-1">Aggiungi un nuovo cliente per iniziare</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clients.map((client, index) => {
        const fullName = `${(client.first_name ?? '').trim()} ${(client.last_name ?? '').trim()}`.trim() || 'Senza nome';
        const contactInfo = client.phone ?? client.email ?? client.notes ?? 'Nessuna informazione';
        const contactLabel = client.phone ? 'Telefono' : client.email ? 'Email' : client.notes ? 'Note' : 'Info';
        const tags = Array.isArray(client.tags) ? client.tags.filter((tag) => (tag ?? '').trim().length > 0) : [];
        const cardStyle = { '--flip-card-height': '400px' } as React.CSSProperties;
        const flipState = flippedCards[client.id] ?? null;

        const createdAtDate = client.created_at ? new Date(client.created_at) : null;
        const formattedCreatedAt = createdAtDate && !Number.isNaN(createdAtDate.valueOf())
          ? createdAtDate.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
          : null;

        const detailsBlocks: React.ReactNode[] = [];

        if (client.email) {
          detailsBlocks.push(
            <InfoBlock key="email" label="Email" value={client.email} href={`mailto:${client.email}`} />
          );
        }
        if (client.phone) {
          detailsBlocks.push(
            <InfoBlock key="phone" label="Telefono" value={client.phone} href={`tel:${client.phone}`} />
          );
        }
        if (client.address) {
          detailsBlocks.push(
            <InfoBlock key="address" label="Indirizzo" value={client.address} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`} />
          );
        }
        if (client.notes) {
          detailsBlocks.push(<InfoBlock key="notes" label="Note" value={client.notes} multiline />);
        }
        if (formattedCreatedAt) {
          detailsBlocks.push(<InfoBlock key="created" label="Creato il" value={formattedCreatedAt} />);
        }

        return (
          <article
            key={client.id}
            className={`flip-card ${flipState ? 'flipped' : ''} group animate-fade-in`}
            style={{ ...cardStyle, animationDelay: `${index * 50}ms` }}
          >
            <div className="flip-card-inner">
              {/* Front */}
              <div className="flip-card-front card-gradient p-5 flex flex-col">
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="badge badge-primary text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Cliente
                    </span>
                    <h3 className="mt-2 text-lg font-bold text-foreground truncate">{fullName}</h3>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
                    {tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="badge badge-secondary text-[10px]">{tag}</span>
                    ))}
                    {tags.length > 3 && (
                      <span className="badge badge-accent text-[10px]">+{tags.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="relative z-10 mt-4 card p-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">{contactLabel}</span>
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="mt-1 block text-sm font-semibold text-primary hover:text-primary-light truncate">
                      {client.phone}
                    </a>
                  ) : client.email ? (
                    <a href={`mailto:${client.email}`} className="mt-1 block text-sm font-medium text-primary hover:text-primary-light truncate">
                      {client.email}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-foreground truncate">{contactInfo}</p>
                  )}
                </div>

                {(client.address || client.notes) && (
                  <div className="relative z-10 mt-3 space-y-2">
                    {client.address && (
                      <div className="card p-3">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">Indirizzo</span>
                        <p className="mt-1 text-sm text-foreground line-clamp-2">{client.address}</p>
                      </div>
                    )}
                    {client.notes && !client.address && (
                      <div className="card p-3">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">Note</span>
                        <p className="mt-1 text-sm text-foreground line-clamp-2">{client.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="relative z-10 mt-auto pt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onFlip(client.id, 'details')}
                    className="btn btn-primary py-2.5 text-xs"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Info
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(client)}
                    className="btn btn-secondary py-2.5 text-xs"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifica
                  </button>
                  <DeleteClientButton
                    clientId={client.id}
                    onDeleted={() => onDeleted(client.id)}
                    confirmMessage={`Elimina ${fullName}?`}
                    containerClassName="contents"
                    className="btn btn-danger py-2.5 text-xs w-full"
                  >
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Elimina
                    </>
                  </DeleteClientButton>
                </div>
              </div>

              {/* Back */}
              <div className="flip-card-back card-gradient p-5 flex flex-col">
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <span className="badge badge-accent text-[10px]">Dettagli</span>
                    <h3 className="mt-2 text-lg font-bold text-foreground">{fullName}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFlip(client.id, null)}
                    className="btn btn-ghost btn-icon"
                    aria-label="Chiudi"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="relative z-10 mt-4 flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                  {detailsBlocks.length > 0 ? detailsBlocks : (
                    <div className="card p-4 text-center">
                      <p className="text-sm text-muted">Nessuna informazione aggiuntiva</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

interface InfoBlockProps {
  label: string;
  value: string;
  href?: string;
  multiline?: boolean;
}

function InfoBlock({ label, value, href, multiline }: InfoBlockProps) {
  const isExternal = href?.startsWith('http') ?? false;

  return (
    <div className="card p-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {href ? (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="mt-1 block text-sm font-medium text-primary hover:text-primary-light break-all"
        >
          {value}
        </a>
      ) : (
        <p className={`mt-1 text-sm text-foreground ${multiline ? 'whitespace-pre-line' : ''}`}>{value}</p>
      )}
    </div>
  );
}
