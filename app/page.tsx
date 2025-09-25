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
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <header className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60 border-b border-neutral-800 mb-4 sm:mb-6">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-0 py-3">
                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight truncate">
                  {`Bitora CRM x ${getDisplayName(user)}`}
                </h1>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="hidden sm:block text-sm text-neutral-400 truncate max-w-[30ch]">{user.email}</span>
                  <Link href="/mappa" className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs sm:text-sm">Mappa</Link>
                  <button onClick={handleLogout} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs sm:text-sm">Esci</button>
                </div>
              </div>
            </header>

            <ClientTable user={user} />
          </div>

          <div className="py-6 text-center text-xs sm:text-sm text-neutral-500">
            Powered by <span className="font-semibold">Bitora</span> · Un prodotto di <a href="https://bitora.it" target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-400">Denis Cazzulo</a> (bitora.it)
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

function ClientTable({ user }: { user: User }) {
  const [rows, setRows] = useState<Client[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const supabase = useSupabaseSafe();
  
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
            className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs sm:text-sm">⌘K</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStatsModalOpen(true)}
            disabled={rows.length === 0}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-700 disabled:text-neutral-400 text-white rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2"
            title="Mostra statistiche e KPI"
          >
            <span>📊</span>
            Statistiche
          </button>
          <button
            onClick={exportToCSV}
            disabled={rows.length === 0}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-700 disabled:text-neutral-400 text-white rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2"
            title="Esporta tutti i clienti in CSV"
          >
            <span>📊</span>
            Esporta CSV
          </button>
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
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-neutral-400 py-8">Nessun cliente</div>
        ) : (
          filtered.map((c) => (
            <article key={c.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-base font-medium leading-tight">
                    {(c.first_name ?? "").trim()} {(c.last_name ?? "").trim() || ""}
                  </h3>
                  <div className="space-y-1 mt-2">
                    {c.phone && (
                      <a 
                        href={`tel:${c.phone}`}
                        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a 
                        href={`mailto:${c.email}`}
                        className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 transition-colors"
                      >
                        {c.email}
                      </a>
                    )}
                    {c.address && (
                      <p className="text-xs text-neutral-400 break-words">
                        {c.address}
                      </p>
                    )}
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-lg">
                            {tag}
                          </span>
                        ))}
                        {c.tags.length > 3 && (
                          <span className="text-xs text-neutral-400">+{c.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <EditClientButton client={c} onUpdated={(nuovo) => setRows((rows) => rows.map((r) => (r.id === nuovo.id ? nuovo : r)))} />
                  <DeleteClientButton clientId={c.id} onDeleted={() => setRows((rows) => rows.filter((r) => r.id !== c.id))} />
                </div>
              </div>
              {c.address && (
                <div className="mt-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-neutral-300 hover:text-white"
                  >
                    Apri in Maps
                  </a>
                </div>
              )}
              {c.notes && (
                <p className="text-sm text-neutral-300 mt-2 break-words">{c.notes}</p>
              )}
            </article>
          ))
        )}
      </div>

      {/* Desktop: tabella */}
      <div className="hidden lg:block overflow-x-auto no-scrollbar rounded-2xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left px-3 py-3 font-medium">Nome</th>
              <th className="text-left px-3 py-3 font-medium">Cognome</th>
              <th className="text-left px-3 py-3 font-medium">📞 Telefono</th>
              <th className="text-left px-3 py-3 font-medium">✉️ Email</th>
              <th className="text-right px-3 py-3 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">Nessun cliente</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/60">
                  <td className="px-3 py-3">
                    <span className="font-medium">{c.first_name ?? "—"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium">{c.last_name ?? "—"}</span>
                  </td>
                  <td className="px-3 py-3">
                    {c.phone ? (
                      <a 
                        href={`tel:${c.phone}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                        title={`Chiama ${c.phone}`}
                      >
                        <span className="text-xs">📞</span>
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {c.email ? (
                      <a 
                        href={`mailto:${c.email}`}
                        className="text-green-400 hover:text-green-300 transition-colors inline-flex items-center gap-1 max-w-[200px] truncate"
                        title={`Email ${c.email}`}
                      >
                        <span className="text-xs">✉️</span>
                        <span className="truncate">{c.email}</span>
                      </a>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedClient(c);
                          setIsDetailModalOpen(true);
                        }}
                        className="px-2 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                        title="Vedi dettagli"
                      >
                        Dettagli
                      </button>
                      <EditClientButton client={c} onUpdated={(nuovo) => setRows((rows) => rows.map((r) => (r.id === nuovo.id ? nuovo : r)))} />
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
      <div className="hidden sm:block lg:hidden overflow-x-auto no-scrollbar rounded-2xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left px-3 py-3 font-medium">Cliente</th>
              <th className="text-left px-3 py-3 font-medium">Contatti</th>
              <th className="text-left px-3 py-3 font-medium">Indirizzo</th>
              <th className="text-right px-3 py-3 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">Nessun cliente</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/60">
                  <td className="px-3 py-3">
                    <div>
                      <div className="font-medium">{(c.first_name ?? "").trim()} {(c.last_name ?? "").trim() || ""}</div>
                      {c.notes && <div className="text-xs text-neutral-400 truncate mt-1">{c.notes}</div>}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                          {c.tags.length > 2 && (
                            <span className="text-xs text-neutral-400">+{c.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="block text-blue-400 hover:text-blue-300 text-xs">
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="block text-green-400 hover:text-green-300 text-xs">
                          {c.email}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs truncate max-w-[15ch]" title={c.address ?? undefined}>
                        {c.address ?? "—"}
                      </span>
                      {c.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-neutral-400 hover:text-white"
                          title="Maps"
                        >
                          🗺️
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <EditClientButton client={c} onUpdated={(nuovo) => setRows((rows) => rows.map((r) => (r.id === nuovo.id ? nuovo : r)))} />
                      <DeleteClientButton clientId={c.id} onDeleted={() => setRows((rows) => rows.filter((r) => r.id !== c.id))} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dettagli Cliente */}
      <ClientDetailModal
        client={selectedClient}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedClient(null);
        }}
        onEdit={() => {
          // Trova e clicca il bottone modifica per questo cliente
          const editButton = document.querySelector(`[data-edit-client="${selectedClient?.id}"]`) as HTMLButtonElement;
          if (editButton) {
            editButton.click();
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
      <button onClick={() => setOpen(true)} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/90 text-black hover:bg-white text-sm font-medium">
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

function EditClientButton({ client, onUpdated }: { client: Client; onUpdated: (c: Client) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: client.first_name ?? "",
    last_name: client.last_name ?? "",
    address: client.address ?? "",
    notes: client.notes ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    tags: client.tags ?? [],
  });
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  async function updateClient(e: React.FormEvent) {
    e.preventDefault();
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
        .select("id, owner_id, first_name, last_name, address, notes, phone, email, created_at")
        .single();
      if (error) throw error;

      // Geocode se l'indirizzo è cambiato
      if (data && data.address !== client.address) {
        await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id, address: data.address, owner_id: data.owner_id }),
        });
      }

      onUpdated(data as Client);
      push("success", "Cliente aggiornato con successo!");
      setOpen(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button 
        data-edit-client={client.id}
        onClick={() => setOpen(true)} 
        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs"
      >
        Modifica
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">Modifica cliente</h3>
            <form onSubmit={updateClient} className="space-y-3">
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
        onClick={doDelete}
        disabled={busy}
        className="px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-900 text-red-200 hover:bg-red-900/40 text-xs"
      >
        {busy ? "Eliminazione…" : "Elimina"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
