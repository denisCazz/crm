"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";

import { ToastProvider, useToast } from "../components/Toaster";
import LoginForm from "../components/LoginForm";
import { Client } from "../types";
import { useSupabaseSafe } from "../lib/supabase";
import { ClientDashboard } from "../components/clients/ClientDashboard";
import { NewClientButton } from "../components/clients/NewClientButton";
import { UserMenuDropdown } from "../components/clients/UserMenuDropdown";

function getDisplayName(user: User | null): string {
  if (!user?.email) return "Cliente";
  const localPart = user.email.split("@")[0] ?? "";
  if (!localPart) return "Cliente";
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Client[]>([]);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const { push } = useToast();
  const supabase = useSupabaseSafe();

  const handleRowsChange = useCallback((next: Client[]) => {
    setRows(next);
  }, []);

  const openStatsModal = useCallback(() => setIsStatsModalOpen(true), []);
  const closeStatsModal = useCallback(() => setIsStatsModalOpen(false), []);

  const handleClientCreated = useCallback((client: Client) => {
    setRows((prev) => [client, ...prev.filter((row) => row.id !== client.id)]);
    setTableRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    document.title = `Bitora CRM x ${getDisplayName(user)}`;
  }, [user]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then((response) => {
      setUser(response.data?.session?.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_, newSession) => {
      setUser(newSession?.user ?? null);
    });

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    push("success", "Logout effettuato con successo!");
  }, [supabase, push]);

  const exportToCSV = useCallback(() => {
    if (rows.length === 0) return;

    const headers = [
      "Nome",
      "Cognome",
      "Telefono",
      "Email",
      "Indirizzo",
      "Note",
      "Tags",
      "Latitudine",
      "Longitudine",
      "Data Creazione",
    ];

    const csvData = rows.map((client) => [
      client.first_name ?? "",
      client.last_name ?? "",
      client.phone ?? "",
      client.email ?? "",
      client.address ?? "",
      client.notes ?? "",
      (client.tags ?? []).join(" | "),
      client.lat?.toString() ?? "",
      client.lon?.toString() ?? "",
      new Date(client.created_at).toLocaleDateString("it-IT"),
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", `clienti-bitora-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header className="bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-950 border border-neutral-800/60 rounded-2xl shadow-xl">
          <div className="px-4 sm:px-6 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-blue-400/80">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Dashboard clienti
              </span>
              <UserMenuDropdown
                user={user}
                onLogout={handleLogout}
                onExportCSV={exportToCSV}
                onStatsOpen={openStatsModal}
                canExport={rows.length > 0}
                canShowStats={rows.length > 0}
              />
            </div>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3 max-w-2xl">
                <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-100 tracking-tight">Bitora CRM</h1>
                <p className="text-sm sm:text-base text-neutral-400 max-w-xl">
                  Gestisci i tuoi clienti, monitora le interazioni e mantieni la pipeline sempre aggiornata con un colpo d&apos;occhio.
                </p>
              </div>
              <div className="w-full lg:max-w-sm">
                <div className="grid gap-3">
                  <Link
                    href="/mappa"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800/90"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A2 2 0 013 15.447V4.553a2 2 0 011.553-1.947L9 1m0 19l6-3m-6 3V1m6 16l5.447 2.724A2 2 0 0021 18.553V7.447a2 2 0 00-1.553-1.947L15 3m0 14V3" />
                    </svg>
                    Mappa clienti
                  </Link>
                  <NewClientButton onCreated={handleClientCreated} fullWidth />
                </div>
              </div>
            </div>
          </div>
        </header>

        <ClientDashboard
          user={user}
          onRowsChange={handleRowsChange}
          isStatsModalOpen={isStatsModalOpen}
          onStatsClose={closeStatsModal}
          refreshKey={tableRefreshKey}
        />
      </div>

      <div className="py-8 text-center text-sm text-neutral-500 bg-neutral-950 border-t border-neutral-800">
        Powered by <span className="font-medium text-neutral-300">Bitora</span> · Un prodotto di{' '}
        <a
          href="https://bitora.it"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          Denis Cazzulo
        </a>{' '}
        (bitora.it)
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
