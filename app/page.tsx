"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { ToastProvider, useToast } from "../components/Toaster";
import LoginForm from "../components/LoginForm";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import  ClientDetailModal  from "../components/ClientDetailModal";
import { TagInput } from "../components/TagInput";
import { StatisticsModal } from "../components/StatisticsModal";
import { useSupabaseSafe } from "../lib/supabase";
import { Client } from "../types";

// Util: costruisce un nome leggibile dal login
function getDisplayName(user: User | null): string {
  if (!user?.email) return "Cliente";
  const local = user.email.split("@")[0];
  if (!local) return "Cliente";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Client[]>([]);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  // Aggiorna il titolo della pagina in base all'utente
  useEffect(() => {
    const title = `Bitora CRM x ${getDisplayName(user)}`;
    document.title = title;
  }, [user]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    
    supabase.auth.getSession().then((response: { data: { session: { user: User } | null } | null }) => {
      setUser(response.data?.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event: unknown, newSession: { user: User } | null) => {
      setUser(newSession?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleLogout() { 
    if (!supabase) return;
    
    await supabase.auth.signOut();
    push("success", "Logout effettuato con successo!");
  }

  // Funzione export CSV
  const exportToCSV = () => {
    const headers = [
      'Nome',
      'Cognome', 
      'Telefono',
      'Email',
      'Indirizzo',
      'Note',
      'Latitudine',
      'Longitudine',
      'Data Creazione'
    ];

    const csvData = rows.map(client => [
      client.first_name || '',
      client.last_name || '',
      client.phone || '',
      client.email || '',
      client.address || '',
      client.notes || '',
      client.lat?.toString() || '',
      client.lon?.toString() || '',
      new Date(client.created_at).toLocaleDateString('it-IT')
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `clienti-bitora-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <LoginForm />
      ) : (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <header className="bg-neutral-900 border border-neutral-800 rounded-lg mb-6 shadow-lg">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-100 tracking-tight">
                  Bitora CRM
                </h1>
                <div className="flex items-center gap-3">
                  <Link href="/mappa" className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium text-neutral-200 transition-colors">Mappa</Link>
                  <UserMenuDropdown 
                    user={user}
                    onLogout={handleLogout}
                    onExportCSV={exportToCSV}
                    onStatsOpen={() => setIsStatsModalOpen(true)}
                    canExport={rows.length > 0}
                    canShowStats={rows.length > 0}
                  />
                </div>
              </div>
            </header>

            <ClientTable user={user} onLogout={handleLogout} />
          </div>

          <div className="py-8 text-center text-sm text-neutral-500 bg-neutral-950 border-t border-neutral-800">
            Powered by <span className="font-medium text-neutral-300">Bitora</span> · Un prodotto di <a href="https://bitora.it" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium">Denis Cazzulo</a> (bitora.it)
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}

/* ----------------------------- Tabella Clienti ----------------------------- */

function ClientTable({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [rows, setRows] = useState<Client[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, 'details' | 'edit' | null>>({});
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const supabase = useSupabaseSafe();

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingClient(null);
  };
  
  // Funzione export CSV
  const exportToCSV = () => {
    const headers = [
      'Nome',
      'Cognome', 
      'Telefono',
      'Email',
      'Indirizzo',
      'Note',
      'Latitudine',
      'Longitudine',
      'Data Creazione'
    ];

    const csvData = rows.map(client => [
      client.first_name || '',
      client.last_name || '',
      client.phone || '',
      client.email || '',
      client.address || '',
      client.notes || '',
      client.lat?.toString() || '',
      client.lon?.toString() || '',
      new Date(client.created_at).toLocaleDateString('it-IT')
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `clienti-bitora-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    let result = rows;

    // Filtro per tag
    if (activeTagFilter) {
      result = result.filter(r => r.tags?.includes(activeTagFilter));
    }

    // Filtro per testo
    const q = qDebounced.trim().toLowerCase();
    if (q) {
      result = result.filter((r) =>
        [r.first_name, r.last_name, r.address, r.notes, r.phone, r.email, ...(r.tags || [])]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      );
    }

    return result;
  }, [rows, qDebounced, activeTagFilter]);

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      setErr(null);
      const { data, error } = await supabase
        .from("clients")
        .select("id, owner_id, first_name, last_name, address, notes, phone, email, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      else setRows((data as Client[]) ?? []);
    };
    load();
  }, [user.id, supabase]);

  return (
    <section className="mt-4 sm:mt-8">
      {/* Barra azioni / ricerca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="relative flex-1 max-w-full sm:max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome, indirizzo o note…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs sm:text-sm">⌘K</span>
        </div>
        <div className="flex items-center gap-2">
          <NewClientButton onCreated={(c) => setRows((r) => [c, ...r])} />
        </div>
      </div>

      {/* Filtri rapidi Tags */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm text-neutral-400">Filtra per:</span>
          <button
            onClick={() => setActiveTagFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !activeTagFilter 
                ? 'bg-blue-600 text-white' 
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Tutti ({rows.length})
          </button>
          {['Cliente Caldo', 'Prospect', 'Fornitore', 'Partner', 'Lead'].map(tag => {
            const count = rows.filter(r => r.tags?.includes(tag)).length;
            if (count === 0) return null;
            
            return (
              <button
                key={tag}
                onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTagFilter === tag
                    ? 'bg-green-600 text-white' 
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {tag} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Stato errore/empty */}
      {err && (
        <div className="px-4 py-3 mb-3 text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl">{err}</div>
      )}

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center text-neutral-500 py-12">
            <p className="text-lg font-light">Nessun cliente trovato</p>
            <p className="text-sm text-neutral-600 mt-1">Prova a modificare i filtri o aggiungi un nuovo cliente</p>
          </div>
        ) : (
          filtered.map((c) => (
            <article key={c.id} className={`flip-card ${flippedCards[c.id] ? 'flipped' : ''} bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden shadow-sm h-80`}>
              {/* Card flip container */}
              <div className="flip-card-inner h-full">
                {/* Front Side - Informazioni Cliente */}
                <div className="flip-card-front w-full p-6 bg-neutral-900 flex flex-col justify-between h-full">
                  {/* Header con nome */}
                  <div className="mb-4">
                    <h3 className="text-xl font-medium text-neutral-100 leading-tight mb-2">
                      {(c.first_name ?? "").trim()} {(c.last_name ?? "").trim() || ""}
                    </h3>
                    {/* Solo uno tra phone, email, note - per mantenere altezza uniforme */}
                    {c.phone ? (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-sm text-neutral-400">{c.phone}</span>
                      </div>
                    ) : c.email ? (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-neutral-400 truncate">{c.email}</span>
                      </div>
                    ) : c.notes ? (
                      <p className="text-sm text-neutral-400 line-clamp-1">{c.notes}</p>
                    ) : null}
                  </div>

                  {/* Tags compatti */}
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {c.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-neutral-800 text-neutral-300 text-sm font-medium rounded-lg">
                          {tag}
                        </span>
                      ))}
                      {c.tags.length > 2 && (
                        <span className="text-sm text-neutral-500">+{c.tags.length - 2}</span>
                      )}
                    </div>
                  )}

                  {/* Tre bottoni sottili impilati */}
                  <div className="space-y-2 mt-auto">
                    <button
                      onClick={() => setFlippedCards(prev => ({ ...prev, [c.id]: 'details' }))}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Dettagli
                    </button>
                    
                    <button
                      onClick={() => setFlippedCards(prev => ({ ...prev, [c.id]: 'edit' }))}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Modifica
                    </button>
                    
                    <button
                      onClick={() => {
                        if (confirm(`Elimina ${c.first_name} ${c.last_name}?`)) {
                          (document.querySelector(`[data-delete-client="${c.id}"]`) as HTMLButtonElement)?.click();
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Elimina
                    </button>
                  </div>
                </div>

                {/* Back Side - Vista dettagli/modifica */}
                <div className="flip-card-back w-full p-6 bg-neutral-900 flex flex-col h-full">
                  {flippedCards[c.id] === 'details' ? (
                    /* Vista dettagli completa - ottimizzata per card */
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-neutral-100">Dettagli</h3>
                        <button
                          onClick={() => setFlippedCards(prev => ({ ...prev, [c.id]: null }))}
                          className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 text-sm">
                        <div>
                          <span className="text-xs text-neutral-500 uppercase block">Nome</span>
                          <p className="text-neutral-100 font-medium text-sm">{c.first_name} {c.last_name}</p>
                        </div>
                        
                        {c.phone && (
                          <div>
                            <span className="text-xs text-neutral-500 uppercase block">Telefono</span>
                            <a href={`tel:${c.phone}`} className="text-blue-400 hover:text-blue-300 text-sm">{c.phone}</a>
                          </div>
                        )}
                        
                        {c.email && (
                          <div>
                            <span className="text-xs text-neutral-500 uppercase block">Email</span>
                            <a href={`mailto:${c.email}`} className="text-blue-400 hover:text-blue-300 break-all text-sm">{c.email}</a>
                          </div>
                        )}
                        
                        {c.address && (
                          <div>
                            <span className="text-xs text-neutral-500 uppercase block">Indirizzo</span>
                            <p className="text-neutral-100 text-sm">{c.address}</p>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 inline-block mt-1"
                            >
                              📍 Maps
                            </a>
                          </div>
                        )}
                        
                        {c.notes && (
                          <div>
                            <span className="text-xs text-neutral-500 uppercase block">Note</span>
                            <p className="text-neutral-100 text-sm">{c.notes}</p>
                          </div>
                        )}
                        
                        {c.tags && c.tags.length > 0 && (
                          <div>
                            <span className="text-xs text-neutral-500 uppercase block mb-1">Tags</span>
                            <div className="flex flex-wrap gap-1">
                              {c.tags.map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-xs rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : flippedCards[c.id] === 'edit' ? (
                    /* Vista modifica - ottimizzata per card */
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-neutral-100">Modifica</h3>
                        <button
                          onClick={() => setFlippedCards(prev => ({ ...prev, [c.id]: null }))}
                          className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <svg className="w-12 h-12 text-amber-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <button
                          onClick={() => {
                            setFlippedCards(prev => ({ ...prev, [c.id]: null }));
                            handleEditClient(c);
                          }}
                          className="w-full p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
                        >
                          Apri Modifica
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Desktop: tabella */}
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  <p className="font-medium">Nessun cliente trovato</p>
                  <p className="text-sm text-neutral-600 mt-1">Prova a modificare i filtri o aggiungi un nuovo cliente</p>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-neutral-200">{c.first_name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-neutral-200">{c.last_name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      <a 
                        href={`tel:${c.phone}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                        title={`Chiama ${c.phone}`}
                      >
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.email ? (
                      <a 
                        href={`mailto:${c.email}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors font-medium max-w-[200px] truncate inline-block"
                        title={`Email ${c.email}`}
                      >
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedClient(c);
                          setIsDetailModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
                        title="Vedi dettagli"
                      >
                        Dettagli
                      </button>
                      <button
                        onClick={() => handleEditClient(c)}
                        className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
                        title="Modifica cliente"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <DeleteClientButton clientId={c.id} onDeleted={() => setRows((rows) => rows.filter((r) => r.id !== c.id))} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tablet: tabella compatta */}
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  <p className="font-medium">Nessun cliente trovato</p>
                  <p className="text-sm text-neutral-600 mt-1">Prova a modificare i filtri</p>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-neutral-200">{(c.first_name ?? "").trim()} {(c.last_name ?? "").trim() || ""}</div>
                      {c.notes && <div className="text-sm text-neutral-400 truncate mt-1">{c.notes}</div>}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-medium">
                              {tag}
                            </span>
                          ))}
                          {c.tags.length > 2 && (
                            <span className="text-xs text-neutral-500">+{c.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="block text-blue-400 hover:text-blue-300 text-sm font-medium">
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="block text-blue-400 hover:text-blue-300 text-sm font-medium truncate">
                          {c.email}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-300 truncate max-w-[15ch]" title={c.address ?? undefined}>
                        {c.address ?? "—"}
                      </span>
                      {c.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
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
                        onClick={() => handleEditClient(c)}
                        className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
                        title="Modifica cliente"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <DeleteClientButton clientId={c.id} onDeleted={() => setRows((rows) => rows.filter((r) => r.id !== c.id))} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ClientEditModal
        client={editingClient}
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onUpdated={(updated) => {
          setRows((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
          setEditingClient(updated);
        }}
      />

      {/* Modal Dettagli Cliente */}
      <ClientDetailModal
        client={selectedClient}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedClient(null);
        }}
        onEdit={() => {
          if (selectedClient) {
            setIsDetailModalOpen(false);
            handleEditClient(selectedClient);
          }
        }}
      />

      {/* Modal Statistiche */}
      <StatisticsModal
        clients={rows}
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />
    </section>
  );
}

function UserMenuDropdown({ user, onLogout, onStatsOpen, onExportCSV, canExport, canShowStats }: {
  user: User;
  onLogout: () => Promise<void>;
  onStatsOpen: () => void;
  onExportCSV: () => void;
  canExport: boolean;
  canShowStats: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium text-neutral-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
        Menu
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-56 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20">
            <div className="p-2">
              <button
                onClick={() => {
                  onStatsOpen();
                  setIsOpen(false);
                }}
                disabled={!canShowStats}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 rounded-md disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistiche
              </button>
              
              <button
                onClick={() => {
                  onExportCSV();
                  setIsOpen(false);
                }}
                disabled={!canExport}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 rounded-md disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Esporta CSV
              </button>

              <div className="border-t border-neutral-700 my-2"></div>
              
              <button
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Esci
              </button>
            </div>
            
            <div className="border-t border-neutral-700 px-3 py-3 bg-neutral-950 rounded-b-lg">
              <p className="text-xs text-neutral-400 truncate">{user.email}</p>
              <p className="text-xs text-neutral-500 mt-1">Utente connesso</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NewClientButton({ onCreated }: { onCreated: (c: Client) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", address: "", notes: "", phone: "", email: "", tags: [] as string[] });
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setErr(null);
    try {
      const { data: who } = await supabase.auth.getUser();
      const uid = who?.user?.id;
      if (!uid) throw new Error("Utente non autenticato");

      const insert = {
        owner_id: uid,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        address: form.address || null,
        notes: form.notes || null,
        phone: form.phone || null,
        email: form.email || null,
      };

      const { data, error } = await supabase
        .from("clients")
        .insert(insert)
        .select("id, owner_id, first_name, last_name, address, notes, phone, email, created_at")
        .single();

      if (error) throw error;

      // Geocode (server route) se c'è indirizzo
      if (data?.address) {
        await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id, address: data.address, owner_id: data.owner_id }),
        });
      }

      onCreated(data as Client);
      push("success", "Cliente creato con successo!");
      setOpen(false);
      setForm({ first_name: "", last_name: "", address: "", notes: "", phone: "", email: "", tags: [] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors">
        + Nuovo cliente
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">Nuovo cliente</h3>
            <form onSubmit={createClient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Nome</label>
                  <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Cognome</label>
                  <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Indirizzo</label>
                <AddressAutocomplete
                  value={form.address}
                  onChange={(value) => setForm((f) => ({ ...f, address: value }))}
                  placeholder="Inserisci l'indirizzo..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Telefono</label>
                  <input 
                    type="tel" 
                    value={form.phone} 
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600" 
                    placeholder="+39 123 456 7890"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={form.email} 
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600" 
                    placeholder="cliente@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Note</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Tags</label>
                <TagInput
                  tags={form.tags}
                  onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                  placeholder="Aggiungi tag per categorizzare il cliente..."
                />
              </div>

              {err && <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-3 py-2">{err}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700">Annulla</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-white/90 text-black hover:bg-white font-medium">
                  {saving ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ClientEditModal({
  client,
  isOpen,
  onClose,
  onUpdated,
}: {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (c: Client) => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    address: "",
    notes: "",
    phone: "",
    email: "",
    tags: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  useEffect(() => {
    if (client && isOpen) {
      setForm({
        first_name: client.first_name ?? "",
        last_name: client.last_name ?? "",
        address: client.address ?? "",
        notes: client.notes ?? "",
        phone: client.phone ?? "",
        email: client.email ?? "",
        tags: client.tags ?? [],
      });
      setErr(null);
    }
  }, [client, isOpen]);

  if (!client || !isOpen) return null;

  async function updateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setSaving(true);
    setErr(null);
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("clients")
        .update({
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          address: form.address || null,
          notes: form.notes || null,
          phone: form.phone || null,
          email: form.email || null,
        })
        .eq("id", client.id)
        .select("id, owner_id, first_name, last_name, address, notes, phone, email, tags, created_at")
        .single();
      if (error) throw error;

      if (data && data.address !== client.address) {
        await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id, address: data.address, owner_id: data.owner_id }),
        });
      }

      onUpdated(data as Client);
      push("success", "Cliente aggiornato con successo!");
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50" onClick={onClose}>
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-4">Modifica cliente</h3>
        <form onSubmit={updateClient} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Nome</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Cognome</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-neutral-300 mb-1">Indirizzo</label>
            <AddressAutocomplete
              value={form.address}
              onChange={(value) => setForm((f) => ({ ...f, address: value }))}
              placeholder="Inserisci l'indirizzo..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Telefono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
                placeholder="+39 123 456 7890"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
                placeholder="cliente@email.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-neutral-300 mb-1">Note</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-300 mb-1">Tags</label>
            <TagInput
              tags={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              placeholder="Aggiungi tag per categorizzare il cliente..."
            />
          </div>
          {err && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-white/90 text-black hover:bg-white font-medium disabled:opacity-70"
            >
              {saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteClientButton({ clientId, onDeleted }: { clientId: string; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  async function doDelete() {
    // conferma nativa: perfetta su mobile
    if (!confirm("Sei sicuro di voler eliminare questo cliente?")) return;
    setBusy(true);
    setErr(null);
    if (!supabase) return;
    try {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
      onDeleted();
      push("success", "Cliente eliminato con successo!");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        data-delete-client={clientId}
        onClick={doDelete}
        disabled={busy}
        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
        title="Elimina cliente"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      {err && <span className="text-xs text-red-400 px-2">{err}</span>}
    </div>
  );
}
