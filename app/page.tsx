"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ToastProvider, useToast } from "../components/Toaster";
import LoginForm from "../components/LoginForm";
import { Client, License, AppSettings } from "../types";
import { ClientDashboard } from "../components/clients/ClientDashboard";
import { NewClientButton, NewClientButtonRef } from "../components/clients/NewClientButton";
import { ClientOverview } from "../components/clients/ClientOverview";
import { NewsletterModal } from "../components/NewsletterModal";
import { normalizeClient } from "../lib/normalizeClient";
import { AppLayout } from "../components/layout/AppLayout";
import { getCachedBrand, setCachedBrand } from "../lib/brandCache";
import { verifySession, signOut as authSignOut, getStoredSession, getStoredUser } from "../lib/authClient";
import type { User } from "../lib/auth";

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
  const meta = ((user?.user_metadata ?? {}) as Record<string, unknown>) || {};
  
  // Prova first_name da metadata
  const firstName = typeof meta.first_name === 'string' ? meta.first_name.trim() : '';
  if (firstName) return firstName;
  
  // Prova first_name diretto (nuovo schema)
  if (user && 'first_name' in user && typeof user.first_name === 'string' && user.first_name) {
    return user.first_name;
  }
  
  if (!user?.email) return "Cliente";
  const localPart = user.email.split("@")[0] ?? "";
  if (!localPart) return "Cliente";
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function MainApp() {
  const router = useRouter();
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
  const newClientButtonRef = useRef<NewClientButtonRef>(null);

  const handleRowsChange = useCallback((next: Client[]) => {
    setRows(next.map((client) => normalizeClient(client)));
  }, []);

  const openStatsModal = useCallback(() => setIsStatsModalOpen(true), []);
  const closeStatsModal = useCallback(() => setIsStatsModalOpen(false), []);

  const openNewsletterModal = useCallback(() => setIsNewsletterModalOpen(true), []);
  const closeNewsletterModal = useCallback(() => setIsNewsletterModalOpen(false), []);

  const handleSendNewsletter = useCallback(async (templateId: string) => {
    const session = getStoredSession();
    if (!session) {
      push("error", "Sessione scaduta. Ricarica la pagina.");
      return;
    }
    
    setSendingNewsletter(true);
    try {
      const res = await fetch("/api/email/newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
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
    } catch (_err) {
      push("error", "Errore di connessione. Riprova più tardi.");
    } finally {
      setSendingNewsletter(false);
    }
  }, [push]);

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
    if (!user) return;

    // Load from cache first to avoid a call every time
    const cached = getCachedBrand(user.id);
    if (cached) {
      setBrandSettings({ brand_name: cached.brand_name, logo_url: cached.logo_url });
      return;
    }

    const fetchSettings = async () => {
      const session = getStoredSession();
      if (!session) return;

      try {
        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          console.error("/api/settings failed", { status: res.status, json });
          return;
        }

        if (json?.settings) {
          setBrandSettings({ brand_name: json.settings.brand_name, logo_url: json.settings.logo_url });
          setCachedBrand(user.id, json.settings.brand_name ?? null, json.settings.logo_url ?? null);
        }
      } catch (e) {
        console.error("/api/settings failed (network/parse)", e);
      }
    };

    fetchSettings();
  }, [user]);

  // Verifica autenticazione al mount
  useEffect(() => {
    const checkAuth = async () => {
      const result = await verifySession();
      if (result) {
        setUser(result.user);
      } else {
        // Prova a ottenere user dal localStorage (per evitare flicker)
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Verifica licenza
  useEffect(() => {
    if (!user) {
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
      if (cancelled) return;
      const session = getStoredSession();
      if (!session) {
        setLicenseState({ status: "inactive", reason: "Sessione scaduta. Effettua di nuovo l'accesso." });
        return;
      }

      const res = await fetch("/api/licenses/me", { headers: { Authorization: `Bearer ${session.token}` } });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setLicenseState({ status: "error", message: json?.error || "Errore durante la verifica licenza" });
        return;
      }

      const data = json?.license as License | null;
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
  }, [user]);

  const isLicenseActive = useMemo(() => licenseState.status === "active", [licenseState]);

  const handleLogout = useCallback(async () => {
    await authSignOut();
    setUser(null);
    push("success", "Logout effettuato con successo!");
    router.push("/");
  }, [push, router]);

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

  const overview = useMemo(() => {
    const clientsCount = rows.length;
    const withPhone = rows.reduce((acc, r) => (r.phone ? acc + 1 : acc), 0);
    const withEmail = rows.reduce((acc, r) => (r.email ? acc + 1 : acc), 0);
    const latestClient = clientsCount > 0 ? rows[0] : null;
    const latestCreatedAt = latestClient?.created_at
      ? new Date(latestClient.created_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })
      : null;

    return { clientsCount, withPhone, withEmail, latestClient, latestCreatedAt };
  }, [rows]);

  const openNewClient = useCallback(() => {
    newClientButtonRef.current?.openModal?.();
  }, []);

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
    <AppLayout
      user={user}
      brandName={brandName}
      logoUrl={logoUrl}
      onLogout={handleLogout}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Hero */}
        <div className="card-gradient p-5 sm:p-6">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="badge badge-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-soft" />
                  Dashboard
                </span>
                <span className="badge badge-accent hidden sm:inline-flex">
                  {brandName}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Ciao {getDisplayName(user)}
              </h2>
              <p className="text-sm text-muted max-w-xl">
                Aggiungi clienti, trova subito le informazioni e invia comunicazioni in pochi click.
              </p>
            </div>

            {isLicenseActive && (
              <div className="w-full lg:w-auto flex-shrink-0 space-y-3">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={openStatsModal}
                    disabled={rows.length === 0}
                    className="btn btn-outline-secondary"
                  >
                    Statistiche
                  </button>
                  <button
                    type="button"
                    onClick={exportToCSV}
                    disabled={rows.length === 0}
                    className="btn btn-outline-secondary"
                  >
                    Esporta CSV
                  </button>
                  <button
                    type="button"
                    onClick={openNewsletterModal}
                    disabled={sendingNewsletter}
                    className="btn btn-outline-secondary"
                  >
                    Newsletter
                  </button>
                  <button type="button" onClick={openNewClient} className="btn btn-primary">
                    + Nuovo
                  </button>
                </div>

                <div className="hidden">
                  <NewClientButton ref={newClientButtonRef} onCreated={handleClientCreated} fullWidth />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KPI overview */}
        {isLicenseActive && (
          <ClientOverview
            clientsCount={overview.clientsCount}
            withPhone={overview.withPhone}
            withEmail={overview.withEmail}
            latestClient={overview.latestClient}
            latestCreatedAt={overview.latestCreatedAt}
          />
        )}

        {/* Email sections */}
        {isLicenseActive && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card-elevated p-4 sm:p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Newsletter</h3>
                <p className="text-sm text-muted">Invio massivo in BCC usando un template email.</p>
              </div>
              <div className="flex items-center justify-end">
                <Link href="/email/newsletter" className="btn btn-primary">
                  Apri Newsletter
                </Link>
              </div>
            </div>

            <div className="card-elevated p-4 sm:p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Contatti</h3>
                <p className="text-sm text-muted">Invio singolo o multiplo a uno o più contatti selezionati.</p>
              </div>
              <div className="flex items-center justify-end">
                <Link href="/email/contatti" className="btn btn-primary">
                  Apri Contatti
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        {isLicenseActive && (
          <ClientDashboard
            user={user}
            onRowsChange={handleRowsChange}
            onAddClient={openNewClient}
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
    </AppLayout>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
