"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { User } from "@supabase/supabase-js";

import { ToastProvider, useToast } from "../components/Toaster";
import LoginForm from "../components/LoginForm";
import { Client, License, AppSettings } from "../types";
import { useSupabaseSafe } from "../lib/supabase";
import { ClientDashboard } from "../components/clients/ClientDashboard";
import { NewClientButton, NewClientButtonRef } from "../components/clients/NewClientButton";
import { Navbar } from "../components/Navbar";
import { NewsletterModal } from "../components/NewsletterModal";
import { normalizeClient } from "../lib/normalizeClient";

const ADMIN_EMAILS: string[] = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const envAdmin = Boolean(user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const metadataAdmin = userMetadata["is_admin"] === true || appMetadata["role"] === "admin";
  return envAdmin || metadataAdmin;
}

function adminBypassLicense(user: User): License {
  return {
    id: "admin-bypass",
    user_id: user.id,
    status: "active",
    expires_at: null,
    plan: "admin",
    created_at: new Date().toISOString(),
  } as License;
}

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
  const [isNewsletterModalOpen, setIsNewsletterModalOpen] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [brandSettings, setBrandSettings] = useState<Pick<AppSettings, 'brand_name' | 'logo_url'> | null>(null);
  const [licenseState, setLicenseState] = useState<
    | { status: "idle" }
    | { status: "checking" }
    | { status: "active"; license: License }
    | { status: "inactive"; reason: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const { push } = useToast();
  const supabase = useSupabaseSafe();
  const newClientButtonRef = useRef<NewClientButtonRef>(null);

  const handleRowsChange = useCallback((next: Client[]) => {
    setRows(next.map((client) => normalizeClient(client)));
  }, []);

  const openStatsModal = useCallback(() => setIsStatsModalOpen(true), []);
  const closeStatsModal = useCallback(() => setIsStatsModalOpen(false), []);

  const openNewsletterModal = useCallback(() => setIsNewsletterModalOpen(true), []);
  const closeNewsletterModal = useCallback(() => setIsNewsletterModalOpen(false), []);

  const handleNewClient = useCallback(() => {
    newClientButtonRef.current?.openModal();
  }, []);

  const handleSendNewsletter = useCallback(async (templateId: string) => {
    if (!supabase) return;
    
    setSendingNewsletter(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        push("error", "Sessione scaduta. Ricarica la pagina.");
        return;
      }

      const res = await fetch("/api/email/newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ template_id: templateId }),
      });

      const data = await res.json();

      if (!res.ok) {
        push("error", data.error || "Errore nell'invio della newsletter");
        return;
      }

      push("success", data.message || `Newsletter inviata a ${data.recipients_count} destinatari!`);
      setIsNewsletterModalOpen(false);
    } catch (err) {
      push("error", "Errore di connessione. Riprova più tardi.");
    } finally {
      setSendingNewsletter(false);
    }
  }, [supabase, push]);

  const handleClientCreated = useCallback((client: Client) => {
    const normalized = normalizeClient(client);
    setRows((prev) => [normalized, ...prev.filter((row) => row.id !== normalized.id)]);
    setTableRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const brandName = brandSettings?.brand_name || "Bitora CRM";
    document.title = `${brandName} x ${getDisplayName(user)}`;
  }, [user, brandSettings]);

  // Fetch brand settings
  useEffect(() => {
    if (!supabase || !user) return;

    const fetchSettings = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      try {
        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.settings) {
            setBrandSettings({
              brand_name: json.settings.brand_name,
              logo_url: json.settings.logo_url,
            });
          }
        }
      } catch {
        // Ignore errors
      }
    };

    fetchSettings();
  }, [supabase, user]);

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

  useEffect(() => {
    if (!supabase || !user) {
      setLicenseState((prev) => (prev.status === "idle" ? prev : { status: "idle" }));
      return;
    }

    if (isAdminUser(user)) {
      setLicenseState({ status: "active", license: adminBypassLicense(user) });
      return;
    }

    let cancelled = false;
    setLicenseState({ status: "checking" });

    const evaluateLicense = async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expires_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to fetch license", error);
        setLicenseState({ status: "error", message: error.message });
        return;
      }

      if (!data) {
        setLicenseState({
          status: "inactive",
          reason:
            "Non è stata trovata alcuna licenza attiva associata a questo account. Contatta l'amministratore per abilitarla.",
        });
        return;
      }

      const now = Date.now();
      const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
      const isExpired = typeof expiresAt === "number" && !Number.isNaN(expiresAt) && expiresAt < now;
      const isDisabled = data.status === "inactive" || data.status === "expired";

      if (isExpired || isDisabled) {
        setLicenseState({
          status: "inactive",
          reason:
            isExpired
              ? "La licenza è scaduta. Contatta il supporto per rinnovarla."
              : "La licenza risulta inattiva. Contatta l'amministratore per verificarla.",
        });
        return;
      }

      setLicenseState({ status: "active", license: data as License });
    };

    evaluateLicense();

    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const isLicenseActive = useMemo(() => licenseState.status === "active", [licenseState]);

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

  const brandName = brandSettings?.brand_name || "Bitora CRM";
  const logoUrl = brandSettings?.logo_url;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm brandName={brandName} logoUrl={logoUrl} />;
  }

  if (licenseState.status === "checking" || licenseState.status === "idle") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted">Verifica della licenza in corso…</p>
      </div>
    );
  }

  if (licenseState.status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="card-elevated px-6 py-8 max-w-md space-y-4 border-danger/40">
          <div className="flex justify-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Impossibile verificare la licenza</h2>
          <p className="text-sm text-muted">
            Si è verificato un errore durante la verifica della licenza: {licenseState.message}
          </p>
          <button type="button" onClick={handleLogout} className="btn btn-danger w-full">
            Esci
          </button>
        </div>
      </div>
    );
  }

  if (licenseState.status === "inactive") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="card-elevated px-6 py-8 max-w-md space-y-5 border-warning/40">
          <div className="flex items-center justify-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Licenza richiesta</h2>
            <p className="text-sm text-muted">{licenseState.reason}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Se ritieni si tratti di un errore, contatta il supporto indicando l&apos;email utilizzata per l&apos;accesso.
          </p>
          <button type="button" onClick={handleLogout} className="btn btn-secondary w-full">
            Esci
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      {/* Navbar */}
      <Navbar
        user={user}
        brandName={brandName}
        logoUrl={logoUrl}
        isAdmin={isAdminUser(user)}
        onLogout={handleLogout}
        onNewClient={handleNewClient}
        onNewsletter={openNewsletterModal}
        onExportCSV={exportToCSV}
        onStatsOpen={openStatsModal}
        clientCount={rows.length}
        newClientCount={rows.filter(r => r.status === 'new').length}
        canExport={rows.length > 0}
        canShowStats={rows.length > 0}
        sendingNewsletter={sendingNewsletter}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Welcome Card */}
        <div className="card-elevated p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 max-w-2xl">
              <h2 className="text-lg font-semibold text-foreground">
                Bentornato, {getDisplayName(user)}! 👋
              </h2>
              <p className="text-sm text-muted">
                Gestisci i tuoi clienti, monitora le interazioni e mantieni la pipeline sempre aggiornata.
              </p>
            </div>
            <div className="w-full lg:w-auto flex-shrink-0">
              {isLicenseActive && (
                <NewClientButton 
                  ref={newClientButtonRef}
                  onCreated={handleClientCreated} 
                  fullWidth 
                />
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        {isLicenseActive && (
          <ClientDashboard
            user={user}
            onRowsChange={handleRowsChange}
            isStatsModalOpen={isStatsModalOpen}
            onStatsClose={closeStatsModal}
            refreshKey={tableRefreshKey}
            isEnabled={isLicenseActive}
          />
        )}
      </div>

      {/* Newsletter Modal */}
      <NewsletterModal
        isOpen={isNewsletterModalOpen}
        onClose={closeNewsletterModal}
        onSend={handleSendNewsletter}
        clientCount={rows.filter(r => r.email).length}
        sending={sendingNewsletter}
      />

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted border-t border-border mt-8">
        <p>
          Powered by <span className="font-medium text-foreground">Cazzulo Denis</span>
          {' · '}
          <a
            href="https://bitora.it"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Bitora.it
          </a>
        </p>
      </footer>
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
