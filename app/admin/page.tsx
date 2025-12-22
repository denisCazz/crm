'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';

import { ToastProvider, useToast } from '../../components/Toaster';
import LoginForm from '../../components/LoginForm';
import { useSupabaseSafe } from '../../lib/supabase';
import { Client, License } from '../../types';
import { normalizeClient } from '../../lib/normalizeClient';

const ADMIN_EMAILS: string[] = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

const LICENSE_STATUSES: License['status'][] = ['active', 'trial', 'inactive', 'expired'];

interface LicenseFormState {
  id: string | null;
  userId: string;
  status: License['status'];
  plan: string;
  expiresAt: string;
  metadata: string;
}

const defaultFormState: LicenseFormState = {
  id: null,
  userId: '',
  status: 'active',
  plan: '',
  expiresAt: '',
  metadata: '',
};

function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const tzOffset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - tzOffset * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return date.toLocaleString('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isLicenseCurrentlyActive(license: License): boolean {
  if (license.status !== 'active' && license.status !== 'trial') return false;
  if (!license.expires_at) return true;
  const expires = new Date(license.expires_at).getTime();
  if (Number.isNaN(expires)) return false;
  return expires >= Date.now();
}

function AdminApp() {
  const supabase = useSupabaseSafe();
  const { push } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminStatus, setAdminStatus] = useState<'unknown' | 'checking' | 'granted' | 'denied'>('unknown');
  const [clients, setClients] = useState<Client[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [licenseForm, setLicenseForm] = useState<LicenseFormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [licenseSearch, setLicenseSearch] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then((response) => {
      setUser(response.data?.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, newSession) => {
      setUser(newSession?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setAdminStatus('unknown');
      return;
    }

    const envAdmin = Boolean(user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
    const metadataAdmin = Boolean(user.user_metadata?.is_admin || user.app_metadata?.role === 'admin');

    if (!supabase) {
      setAdminStatus(envAdmin || metadataAdmin ? 'granted' : 'denied');
      return;
    }

    if (envAdmin || metadataAdmin) {
      setAdminStatus('granted');
      return;
    }

    let cancelled = false;
    setAdminStatus('checking');

    supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Errore durante la verifica admin', error);
          setAdminStatus('denied');
          return;
        }
        setAdminStatus(data ? 'granted' : 'denied');
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase || adminStatus !== 'granted') return;

    let cancelled = false;
    const fetchData = async () => {
      setLoadingData(true);
      setDataError(null);
      try {
        const [clientsRes, licensesRes] = await Promise.all([
          supabase
            .from('clients')
            .select('id, owner_id, first_name, last_name, address, phone, email, notes, tags, status, first_contacted_at, lat, lon, created_at')
            .order('created_at', { ascending: false }),
          supabase
            .from('licenses')
            .select('*')
            .order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;

        if (clientsRes.error) {
          throw clientsRes.error;
        }
        if (licensesRes.error) {
          throw licensesRes.error;
        }

        const normalizedClients = (clientsRes.data ?? []).map((row) => normalizeClient(row as Client));
        setClients(normalizedClients);
        setLicenses((licensesRes.data ?? []) as License[]);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
        console.error('[admin] errore caricamento dati', error);
        setDataError(message);
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [supabase, adminStatus, refreshToken]);

  const resetForm = useCallback(() => {
    setLicenseForm(defaultFormState);
    setFormError(null);
  }, []);

  const handleEditLicense = useCallback((license: License) => {
    setLicenseForm({
      id: license.id,
      userId: license.user_id,
      status: license.status,
      plan: license.plan ?? '',
      expiresAt: toInputDate(license.expires_at ?? undefined),
      metadata: license.metadata ? JSON.stringify(license.metadata, null, 2) : '',
    });
    setFormError(null);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const handleSubmitForm = useCallback(async () => {
    if (!supabase) return;

    const trimmedUserId = licenseForm.userId.trim();
    if (!trimmedUserId) {
      setFormError('Specifica un user_id valido (UUID).');
      return;
    }

    let metadata: Record<string, unknown> | null = null;
    if (licenseForm.metadata.trim().length > 0) {
      try {
        metadata = JSON.parse(licenseForm.metadata);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setFormError(`Metadata non valido: ${message}`);
        return;
      }
    }

    const payload: Record<string, unknown> = {
      user_id: trimmedUserId,
      status: licenseForm.status,
      plan: licenseForm.plan.trim() || null,
      expires_at: licenseForm.expiresAt ? new Date(licenseForm.expiresAt).toISOString() : null,
      metadata,
    };

    setSubmitting(true);
    setFormError(null);

    try {
      if (licenseForm.id) {
        const { error } = await supabase.from('licenses').update(payload).eq('id', licenseForm.id);
        if (error) throw error;
        push('success', 'Licenza aggiornata con successo.');
      } else {
        const { error } = await supabase.from('licenses').insert(payload);
        if (error) throw error;
        push('success', 'Licenza creata con successo.');
      }
      resetForm();
      handleRefresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }, [supabase, licenseForm, push, resetForm, handleRefresh]);

  const handleRevoke = useCallback(
    async (license: License) => {
      if (!supabase) return;
      setSubmitting(true);
      try {
        const { error } = await supabase
          .from('licenses')
          .update({ status: 'inactive', expires_at: null })
          .eq('id', license.id);
        if (error) throw error;
        push('info', 'Licenza revocata.');
        if (licenseForm.id === license.id) {
          resetForm();
        }
        handleRefresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        push('error', message);
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, push, handleRefresh, licenseForm.id, resetForm]
  );

  const isLoading = authLoading || adminStatus === 'checking';
  const isUnauthorized = adminStatus === 'denied';

  const licenseByUser = useMemo(() => {
    const map = new Map<string, License>();
    for (const license of licenses) {
      if (!map.has(license.user_id)) {
        map.set(license.user_id, license);
      }
    }
    return map;
  }, [licenses]);

  const clientStats = useMemo(() => {
    const total = clients.length;
    const withActiveLicense = clients.filter((client) => {
      const license = licenseByUser.get(client.owner_id);
      return license ? isLicenseCurrentlyActive(license) : false;
    }).length;
    const withoutLicense = total - withActiveLicense;
    return { total, withActiveLicense, withoutLicense };
  }, [clients, licenseByUser]);

  const licenseStats = useMemo(() => {
    const active = licenses.filter((license) => isLicenseCurrentlyActive(license)).length;
    const trial = licenses.filter((license) => license.status === 'trial').length;
    const expired = licenses.filter((license) => license.status === 'expired' || !isLicenseCurrentlyActive(license)).length;
    return { active, trial, expired, total: licenses.length };
  }, [licenses]);

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => {
      const fullName = `${client.first_name ?? ''} ${client.last_name ?? ''}`.toLowerCase();
      return (
        fullName.includes(term) ||
        (client.email ?? '').toLowerCase().includes(term) ||
        (client.phone ?? '').toLowerCase().includes(term) ||
        client.owner_id.toLowerCase().includes(term)
      );
    });
  }, [clientSearch, clients]);

  const filteredLicenses = useMemo(() => {
    const term = licenseSearch.trim().toLowerCase();
    if (!term) return licenses;
    return licenses.filter((license) => {
      return (
        license.user_id.toLowerCase().includes(term) ||
        license.status.toLowerCase().includes(term) ||
        (license.plan ?? '').toLowerCase().includes(term)
      );
    });
  }, [licenseSearch, licenses]);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-sm text-neutral-400">Caricamento...</p>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-50">Configurazione mancante</h2>
          <p className="text-sm text-neutral-400">
            Il client Supabase non è configurato. Verifica le variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-sm text-neutral-400">Caricamento...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-4 rounded-3xl border border-red-900/70 bg-red-950/40 px-6 py-8">
          <h2 className="text-xl font-semibold text-red-100">Accesso non autorizzato</h2>
          <p className="text-sm text-red-200/80">
            Il tuo account non dispone dei permessi amministrativi. Contatta un amministratore per ottenere l&apos;accesso.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900/70 px-4 py-2.5 text-sm font-semibold text-neutral-100 border border-neutral-700/60 transition hover:bg-neutral-800"
          >
            Torna alla dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <header className="bg-neutral-900/80 border border-neutral-800 rounded-3xl shadow-xl">
          <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-blue-400/80">Area amministrativa</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-50">Admin · Licenze &amp; Clienti</h1>
                <p className="text-sm text-neutral-400 max-w-2xl">
                  Gestisci le licenze degli utenti, monitora lo stato dei clienti e aggiorna rapidamente abbonamenti e permessi.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-end">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700/70 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Dashboard clienti
                </Link>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16.023 9.348h4.492m0 0V4.856m0 4.492l-2.533-2.533A8.25 8.25 0 004.909 7.5m0 0H.417m0 0v4.492m0-4.492l2.533 2.533a8.25 8.25 0 0012.937 3.252"
                    />
                  </svg>
                  Aggiorna dati
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Clienti totali" value={clientStats.total} accent="blue" />
              <StatCard label="Clienti con licenza" value={clientStats.withActiveLicense} accent="emerald" />
              <StatCard label="Clienti senza licenza" value={clientStats.withoutLicense} accent="amber" />
              <StatCard label="Licenze attive" value={licenseStats.active} accent="violet" />
            </div>
          </div>
        </header>

        {dataError && (
          <div className="rounded-2xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            Errore nel caricamento dei dati: {dataError}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-50">Clienti</h2>
                <p className="text-sm text-neutral-400">Visualizza e filtra tutti i clienti registrati nel CRM.</p>
              </div>
              <span className="rounded-full border border-neutral-700/60 bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
                {filteredClients.length} elementi
              </span>
            </div>
            <input
              type="search"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              className="w-full rounded-xl border border-neutral-700/60 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              placeholder="Cerca per nome, email, telefono o user_id"
            />
            <div className="max-h-[420px] overflow-y-auto no-scrollbar pr-3">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="pb-3 pr-3">Cliente</th>
                    <th className="pb-3 pr-3">Contatti</th>
                    <th className="pb-3 pr-3">Licenza</th>
                    <th className="pb-3 pr-3">User ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredClients.map((client) => {
                    const license = licenseByUser.get(client.owner_id);
                    const hasLicense = Boolean(license);
                    const statusLabel = hasLicense
                      ? isLicenseCurrentlyActive(license!)
                        ? 'Attiva'
                        : 'Scaduta / inattiva'
                      : 'Nessuna';
                    return (
                      <tr key={client.id} className="align-top">
                        <td className="py-3 pr-3">
                          <div className="font-medium text-neutral-100">
                            {`${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Senza nome'}
                          </div>
                          <div className="text-xs text-neutral-500">Creato: {formatDate(client.created_at)}</div>
                        </td>
                        <td className="py-3 pr-3 text-neutral-300">
                          {client.email && <div>{client.email}</div>}
                          {client.phone && <div className="text-neutral-400">{client.phone}</div>}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                              hasLicense
                                ? isLicenseCurrentlyActive(license!)
                                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                                  : 'bg-amber-500/15 text-amber-200 border border-amber-500/20'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-xs text-neutral-500 break-all">{client.owner_id}</td>
                      </tr>
                    );
                  })}

                  {filteredClients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-neutral-400">
                        Nessun cliente trovato.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-50">Licenze</h2>
                <p className="text-sm text-neutral-400">Monitora lo stato delle licenze e gestisci i rinnovi.</p>
              </div>
              <span className="rounded-full border border-neutral-700/60 bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
                {filteredLicenses.length} elementi
              </span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={licenseSearch}
                onChange={(event) => setLicenseSearch(event.target.value)}
                className="w-full sm:w-1/2 rounded-xl border border-neutral-700/60 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="Cerca per user_id, stato o piano"
              />
              <div className="text-sm text-neutral-400 space-x-3">
                <span>Totali: {licenseStats.total}</span>
                <span>Attive: {licenseStats.active}</span>
                <span>Trial: {licenseStats.trial}</span>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto no-scrollbar pr-3">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="pb-3 pr-3">User ID</th>
                    <th className="pb-3 pr-3">Stato</th>
                    <th className="pb-3 pr-3">Scadenza</th>
                    <th className="pb-3 pr-3">Piano</th>
                    <th className="pb-3 pr-3">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredLicenses.map((license) => {
                    const isActive = isLicenseCurrentlyActive(license);
                    return (
                      <tr key={license.id}>
                        <td className="py-3 pr-3 text-xs text-neutral-400 break-all">{license.user_id}</td>
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                                : license.status === 'trial'
                                ? 'bg-blue-500/15 text-blue-200 border border-blue-500/20'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60'
                            }`}
                          >
                            {license.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-neutral-300">{formatDate(license.expires_at)}</td>
                        <td className="py-3 pr-3 text-neutral-300">{license.plan ?? '—'}</td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-neutral-700/60 px-2.5 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-800"
                              onClick={() => handleEditLicense(license)}
                            >
                              Modifica
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-200 transition hover:bg-red-500/10"
                              onClick={() => handleRevoke(license)}
                              disabled={submitting}
                            >
                              Revoca
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLicenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-neutral-400">
                        Nessuna licenza presente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-50">
              {licenseForm.id ? 'Aggiorna licenza' : 'Crea nuova licenza'}
            </h2>
            <p className="text-sm text-neutral-400">
              Compila i campi per creare una nuova licenza o aggiornarne una esistente.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                User ID
              </label>
              <input
                value={licenseForm.userId}
                onChange={(event) => setLicenseForm((prev) => ({ ...prev, userId: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700/60 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="UUID dell&apos;utente Supabase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Stato
              </label>
              <select
                value={licenseForm.status}
                onChange={(event) =>
                  setLicenseForm((prev) => ({ ...prev, status: event.target.value as License['status'] }))
                }
                className="w-full rounded-xl border border-neutral-700/60 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                {LICENSE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Piano (opzionale)
              </label>
              <input
                value={licenseForm.plan}
                onChange={(event) => setLicenseForm((prev) => ({ ...prev, plan: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700/60 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="crm-pro, enterprise..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Scadenza (opzionale)
              </label>
              <input
                type="datetime-local"
                value={licenseForm.expiresAt}
                onChange={(event) => setLicenseForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700/60 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Metadata (JSON opzionale)
              </label>
              <textarea
                rows={4}
                value={licenseForm.metadata}
                onChange={(event) => setLicenseForm((prev) => ({ ...prev, metadata: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700/60 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder='{"note":"Cliente premium"}'
              />
            </div>
          </div>

          {formError && <div className="text-sm text-red-300">{formError}</div>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmitForm}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {licenseForm.id ? 'Aggiorna licenza' : 'Crea licenza'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700/60 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
            >
              Annulla
            </button>
          </div>
        </section>
      </div>

      {loadingData && (
        <div className="fixed inset-0 pointer-events-none flex items-start justify-center pt-4">
          <div className="rounded-full bg-neutral-900/80 px-4 py-2 text-sm text-neutral-300 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            Aggiornamento dati...
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  accent: 'blue' | 'emerald' | 'amber' | 'violet';
}

function StatCard({ label, value, accent }: StatCardProps) {
  const accentMap: Record<StatCardProps['accent'], string> = {
    blue: 'from-blue-600/20 via-blue-500/10 to-blue-600/20 text-blue-100 border-blue-500/30',
    emerald: 'from-emerald-600/20 via-emerald-500/10 to-emerald-600/20 text-emerald-100 border-emerald-500/30',
    amber: 'from-amber-600/20 via-amber-500/10 to-amber-600/20 text-amber-100 border-amber-500/30',
    violet: 'from-violet-600/20 via-violet-500/10 to-violet-600/20 text-violet-100 border-violet-500/30',
  };

  return (
    <div
      className={`rounded-2xl border px-4 py-5 backdrop-blur bg-gradient-to-br ${accentMap[accent]} shadow-lg shadow-black/20`}
    >
      <p className="text-xs uppercase tracking-[0.35em] text-white/70">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ToastProvider>
      <AdminApp />
    </ToastProvider>
  );
}
