"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, User } from "@supabase/supabase-js";

// Supabase client (browser)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Util: costruisce un nome leggibile dal login
function getDisplayName(user: User | null): string {
  if (!user?.email) return "Cliente";
  const local = user.email.split("@")[0];
  if (!local) return "Cliente";
  // Capitalizza la prima lettera del local-part
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);

  // Aggiorna il titolo della pagina in base all'utente
  useEffect(() => {
    const title = `Bitora CRM x ${getDisplayName(user)}`;
    document.title = title;
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setUser(newSession?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (authMode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleLogout() { await supabase.auth.signOut(); }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-center justify-between gap-4 pb-6 border-b border-neutral-800">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Bitora CRM - Powered by Denis Cazzulo
          </h1>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-400 hidden sm:block">{user.email}</span>
              <Link href="/mappa" className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm">Mappa</Link>
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm">Esci</button>
            </div>
          ) : null}
        </header>

        {!user ? (
          <div className="mt-10 grid place-items-center">
            <form onSubmit={handleAuth} className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-medium mb-4">{authMode === "signin" ? "Accedi" : "Crea un account"}</h2>

              <label className="block text-sm text-neutral-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-neutral-600"
                placeholder="you@example.com"
              />

              <label className="block text-sm text-neutral-300 mb-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-neutral-600"
                placeholder="••••••••"
              />

              {error && (
                <div className="mb-4 text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-3 py-2">{error}</div>
              )}

              <div className="flex items-center justify-between gap-3">
                <button type="submit" className="w-full px-4 py-2 rounded-xl bg-white/90 text-black hover:bg-white font-medium">
                  {authMode === "signin" ? "Accedi" : "Registrati"}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode((m) => (m === "signin" ? "signup" : "signin"))}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm"
                >
                  {authMode === "signin" ? "Crea account" : "Ho già un account"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <ClientTable user={user} />
        )}
      </div>

      <div className="py-8 text-center text-sm text-neutral-500">Bitora · Minimal CRM</div>
    </div>
  );
}

/* ----------------------------- Tabella Clienti ----------------------------- */

type Client = {
  id: string;
  owner_id: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

function ClientTable({ user }: { user: User }) {
  const [rows, setRows] = useState<Client[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.first_name, r.last_name, r.address, r.notes]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [rows, query]);

  useEffect(() => {
    const load = async () => {
      setErr(null);
      const { data, error } = await supabase
        .from("clients")
        .select("id, owner_id, first_name, last_name, address, notes, created_at")
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      else setRows((data as Client[]) ?? []);
    };
    load();
  }, [user.id]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome, indirizzo o note…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-4 pr-10 py-2 outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">⌘K</span>
        </div>
        <NewClientButton onCreated={(c) => setRows((r) => [c, ...r])} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left px-4 py-3 font-medium">Cognome</th>
              <th className="text-left px-4 py-3 font-medium">Indirizzo</th>
              <th className="text-left px-4 py-3 font-medium">Note</th>
              <th className="text-right px-4 py-3 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {err ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-red-400">{err}</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">Nessun cliente</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/60">
                  <td className="px-4 py-3">{c.first_name ?? "—"}</td>
                  <td className="px-4 py-3">{c.last_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[28ch]" title={c.address ?? undefined}>{c.address ?? "—"}</span>
                      {c.address ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline text-neutral-300 hover:text-white"
                        >
                          Apri in Maps
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="line-clamp-2 max-w-[45ch] text-neutral-300">{c.notes ?? ""}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EditClientButton client={c} onUpdated={(nuovo) => setRows((rows) => rows.map((r) => (r.id === nuovo.id ? nuovo : r)))} />
                      <DeleteClientButton
                        clientId={c.id}
                        onDeleted={() => setRows((rows) => rows.filter((r) => r.id !== c.id))}
                      />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewClientButton({ onCreated }: { onCreated: (c: Client) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", address: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
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
      };

      const { data, error } = await supabase
        .from("clients")
        .insert(insert)
        .select("id, owner_id, first_name, last_name, address, notes, created_at")
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
      setOpen(false);
      setForm({ first_name: "", last_name: "", address: "", notes: "" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-xl bg-white/90 text-black hover:bg-white text-sm font-medium">
        + Nuovo cliente
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">Nuovo cliente</h3>
            <form onSubmit={createClient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Nome</label>
                  <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Cognome</label>
                  <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Indirizzo</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Note</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={4} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
              </div>

              {err && <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-3 py-2">{err}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">Annulla</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-white/90 text-black hover:bg-white font-medium">
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

function DeleteClientButton({
  clientId,
  onDeleted,
}: {
  clientId: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doDelete() {
    if (!confirm("Sei sicuro di voler eliminare questo cliente?")) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
      onDeleted();
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
        className="ml-2 px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-900 text-red-200 hover:bg-red-900/40 text-xs"
      >
        {busy ? "Eliminazione…" : "Elimina"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
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
  });
  const [err, setErr] = useState<string | null>(null);

  async function updateClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("clients")
        .update({
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          address: form.address || null,
          notes: form.notes || null,
        })
        .eq("id", client.id)
        .select("id, owner_id, first_name, last_name, address, notes, created_at")
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
      setOpen(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs">Modifica</button>
      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">Modifica cliente</h3>
            <form onSubmit={updateClient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Nome</label>
                  <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-1">Cognome</label>
                  <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Indirizzo</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Note</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={4} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600" />
              </div>
              {err && <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-3 py-2">{err}</div>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">Annulla</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-white/90 text-black hover:bg-white font-medium">
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
