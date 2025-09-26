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
      <div className="text-center text-neutral-500 py-12">
        <p className="text-lg font-light">Nessun cliente trovato</p>
        <p className="text-sm text-neutral-600 mt-1">Aggiungi un nuovo cliente per iniziare a popolare la lista</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clients.map((client) => {
        const fullName = `${(client.first_name ?? '').trim()} ${(client.last_name ?? '').trim()}`.trim() || 'Senza nome';
        const contactInfo = client.phone ?? client.email ?? client.notes ?? 'Nessuna informazione disponibile';
        const contactLabel = client.phone ? 'Telefono' : client.email ? 'Email' : client.notes ? 'Note' : 'Info';
        const tags = Array.isArray(client.tags)
          ? client.tags.filter((tag) => (tag ?? '').trim().length > 0)
          : [];
        const cardStyle = { '--flip-card-height': '420px' } as React.CSSProperties;
        const flipState = flippedCards[client.id] ?? null;

        return (
          <article
            key={client.id}
            className={`flip-card ${flipState ? 'flipped' : ''} group relative overflow-hidden rounded-3xl border border-neutral-800/70 bg-neutral-950/70 p-[1px] shadow-[0_25px_70px_-40px_rgba(15,118,255,0.75)] transition-transform`}
            style={cardStyle}
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/25 via-cyan-500/15 to-emerald-500/25 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="flip-card-inner relative h-full rounded-[22px] bg-neutral-950/90">
              {/* Front */}
              <div className="flip-card-front relative flex h-full flex-col overflow-hidden rounded-[22px] border border-neutral-800/70 bg-neutral-950/95 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-blue-200">
                      <span className="h-1 w-1 rounded-full bg-blue-300" />
                      Cliente
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-neutral-50">{fullName}</h3>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={`${client.id}-tag-${index}`}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-100"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-neutral-800/60 bg-neutral-900/70 p-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{contactLabel}</span>
                  {client.phone ? (
                    <a
                      href={`tel:${client.phone}`}
                      className="mt-1 block truncate text-sm font-semibold text-blue-200 transition hover:text-blue-100"
                    >
                      {client.phone}
                    </a>
                  ) : client.email ? (
                    <a
                      href={`mailto:${client.email}`}
                      className="mt-1 block truncate text-sm font-medium text-blue-200 hover:text-blue-100"
                    >
                      {client.email}
                    </a>
                  ) : (
                    <p className="mt-1 truncate text-sm font-medium text-neutral-100">{contactInfo}</p>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-sm text-neutral-300">
                  {client.address && (
                    <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/70 p-3">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Indirizzo</span>
                      <p className="mt-1 text-sm text-neutral-200 line-clamp-2">{client.address}</p>
                    </div>
                  )}
                  {client.notes && (
                    <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/70 p-3">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Note</span>
                      <p className="mt-1 text-sm text-neutral-200 line-clamp-2">{client.notes}</p>
                    </div>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2 pt-5 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => onFlip(client.id, 'details')}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600/90 to-cyan-500/80 text-white shadow-lg shadow-blue-600/25 transition hover:shadow-blue-500/40"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="hidden sm:inline">Dettagli</span>
                    <span className="sm:hidden">Info</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onFlip(client.id, 'edit')}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/90 to-orange-500/80 text-white shadow-lg shadow-amber-500/25 transition hover:shadow-amber-400/40"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Modifica</span>
                  </button>
                  <DeleteClientButton
                    clientId={client.id}
                    onDeleted={() => onDeleted(client.id)}
                    confirmMessage={`Elimina ${client.first_name ?? ''} ${client.last_name ?? ''}?`}
                    containerClassName="contents"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600/90 to-rose-600/80 text-white shadow-lg shadow-red-600/25 transition hover:shadow-red-500/40 w-full"
                  >
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>Elimina</span>
                    </>
                  </DeleteClientButton>
                </div>
              </div>

              {/* Back */}
              <div className="flip-card-back relative flex h-full flex-col overflow-hidden rounded-[22px] border border-neutral-800/70 bg-neutral-950/95 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-500">
                      {flipState === 'details' ? 'Dettagli completi' : 'Modifica rapida'}
                    </p>
                    <h3 className="text-lg font-semibold text-neutral-50">{fullName}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFlip(client.id, null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:text-neutral-200"
                    aria-label="Chiudi card cliente"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {flipState === 'details' ? (
                  <div className="mt-4 flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                    <InfoBlock label="Nome completo" value={fullName} />
                    {client.phone && (
                      <InfoBlock label="Telefono" value={client.phone} href={`tel:${client.phone}`} hrefLabel="Chiama" />
                    )}
                    {client.email && (
                      <InfoBlock label="Email" value={client.email} href={`mailto:${client.email}`} />
                    )}
                    {client.address && (
                      <InfoBlock
                        label="Indirizzo"
                        value={client.address}
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                        hrefLabel="Apri in Maps"
                      />
                    )}
                    {client.notes && <InfoBlock label="Note" value={client.notes} multiline />}
                    {tags.length > 0 && (
                      <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/70 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tags</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-4 text-center">
                    <div className="relative">
                      <span className="absolute -inset-3 rounded-full bg-amber-500/30 blur" />
                      <div className="relative grid h-16 w-16 place-items-center rounded-full bg-amber-500/20 text-amber-300">
                        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-100">Apri la scheda completa</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Passa al layout di modifica per aggiornare ogni informazione del cliente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onFlip(client.id, null);
                        onEdit(client);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/90 to-orange-500/80 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:shadow-amber-400/40"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Apri Modifica
                    </button>
                  </div>
                )}
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
  hrefLabel?: string;
  multiline?: boolean;
}

function InfoBlock({ label, value, href, hrefLabel, multiline }: InfoBlockProps) {
  const isExternal = href?.startsWith('http') ?? false;
  const content = (
    <p className={`mt-0.5 text-sm text-neutral-100 ${multiline ? 'whitespace-pre-line' : ''}`}>{value}</p>
  );

  return (
    <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/70 p-3">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      {href ? (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="mt-0.5 block text-sm font-medium text-blue-300 hover:text-blue-200 break-all"
        >
          {value}
        </a>
      ) : (
        content
      )}
      {href && hrefLabel && (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="mt-2 inline-block text-xs font-semibold text-blue-300 hover:text-blue-200"
        >
          <span>{hrefLabel}</span>
        </a>
      )}
    </div>
  );
}
