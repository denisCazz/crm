'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

import { ToastProvider, useToast } from '../../components/Toaster';
import LoginForm from '../../components/LoginForm';
import { useSupabaseSafe } from '../../lib/supabase';
import { AppLayout } from '../../components/layout/AppLayout';
import type { AppSettings, EmailTemplate, License } from '../../types';

const ADMIN_EMAILS: string[] = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const envAdmin = Boolean(user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const metadataAdmin = userMetadata['is_admin'] === true || appMetadata['role'] === 'admin';
  return envAdmin || metadataAdmin;
}

function adminBypassLicense(user: User): License {
  return {
    id: 'admin-bypass',
    user_id: user.id,
    status: 'active',
    expires_at: null,
    plan: 'admin',
    created_at: new Date().toISOString(),
  } as License;
}

type LicenseState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'active'; license: License }
  | { status: 'inactive'; reason: string }
  | { status: 'error'; message: string };

function isLicenseValid(data: License | null): { ok: true } | { ok: false; reason: string } {
  if (!data) {
    return { ok: false, reason: "Non è stata trovata alcuna licenza attiva associata a questo account." };
  }

  const now = Date.now();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const isExpired = typeof expiresAt === 'number' && !Number.isNaN(expiresAt) && expiresAt < now;
  const isDisabled = data.status === 'inactive' || data.status === 'expired';

  if (isExpired || isDisabled) {
    return {
      ok: false,
      reason: isExpired ? 'La licenza è scaduta.' : 'La licenza risulta inattiva.',
    };
  }

  return { ok: true };
}

function SettingsApp() {
  const supabase = useSupabaseSafe();
  const router = useRouter();
  const { push } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseState, setLicenseState] = useState<LicenseState>({ status: 'idle' });

  const [settings, setSettings] = useState<Partial<AppSettings>>({
    brand_name: '',
    logo_url: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_from_email: '',
    smtp_from_name: '',
    smtp_reply_to: '',
  });
  const [smtpPassword, setSmtpPassword] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // API Key per integrazione esterna
  const [apiKeyGenerating, setApiKeyGenerating] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState({
    id: '' as string | '',
    name: '',
    subject: '',
    body_html: '',
    body_text: '',
  });
  const [templateSaving, setTemplateSaving] = useState(false);

  // Gestione utenti (solo admin)
  interface UserLicense {
    user_id: string;
    email: string;
    license_id: string | null;
    status: string | null;
    plan: string | null;
    expires_at: string | null;
    created_at: string | null;
  }
  interface UserSettings {
    id: string;
    owner_id: string;
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_secure: boolean | null;
    smtp_user: string | null;
    smtp_from_email: string | null;
    smtp_from_name: string | null;
    smtp_reply_to: string | null;
  }
  const [userLicenses, setUserLicenses] = useState<UserLicense[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingLicense, setEditingLicense] = useState<UserLicense | null>(null);
  const [licenseForm, setLicenseForm] = useState({
    status: 'active' as string,
    plan: 'standard' as string,
    expires_at: '' as string,
  });
  const [savingLicense, setSavingLicense] = useState(false);
  
  // Gestione impostazioni email utente
  const [editingUserSettings, setEditingUserSettings] = useState<UserLicense | null>(null);
  const [userSettingsForm, setUserSettingsForm] = useState<Partial<UserSettings>>({
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_from_email: '',
    smtp_from_name: '',
    smtp_reply_to: '',
  });
  const [userSmtpPassword, setUserSmtpPassword] = useState('');
  const [savingUserSettings, setSavingUserSettings] = useState(false);

  useEffect(() => {
    document.title = 'Impostazioni · Bitora CRM';
  }, []);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/');
  }, [supabase, router]);

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
      setLicenseState((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }));
      return;
    }

    if (isAdminUser(user)) {
      setLicenseState({ status: 'active', license: adminBypassLicense(user) });
      return;
    }

    let cancelled = false;
    setLicenseState({ status: 'checking' });

    supabase
      .from('licenses')
      .select('*')
      .eq('user_id', user.id)
      .order('expires_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLicenseState({ status: 'error', message: error.message });
          return;
        }

        const verdict = isLicenseValid((data ?? null) as License | null);
        if (!verdict.ok) {
          setLicenseState({ status: 'inactive', reason: verdict.reason });
          return;
        }

        setLicenseState({ status: 'active', license: data as License });
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const canUse = useMemo(() => licenseState.status === 'active', [licenseState.status]);

  const fetchSettings = useCallback(async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    const res = await fetch('/api/settings', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = (await res.json()) as { settings: AppSettings | null; error?: string };
    if (!res.ok) {
      console.error('/api/settings failed', { status: res.status, json });
      throw new Error(json.error ?? 'Impossibile caricare le impostazioni');
    }

    if (json.settings) {
      setSettings({
        brand_name: json.settings.brand_name ?? '',
        logo_url: json.settings.logo_url ?? '',
        smtp_host: json.settings.smtp_host ?? '',
        smtp_port: json.settings.smtp_port ?? 587,
        smtp_secure: json.settings.smtp_secure ?? false,
        smtp_user: json.settings.smtp_user ?? '',
        smtp_from_email: json.settings.smtp_from_email ?? '',
        smtp_from_name: json.settings.smtp_from_name ?? '',
        smtp_reply_to: json.settings.smtp_reply_to ?? '',
        api_key: json.settings.api_key ?? null,
      });
    }
  }, [supabase]);

  const fetchTemplates = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    setTemplates((data ?? []) as EmailTemplate[]);
  }, [supabase]);

  // Fetch utenti con licenze (solo admin)
  const fetchUserLicenses = useCallback(async () => {
    if (!supabase || !user || !isAdminUser(user)) return;
    
    setLoadingUsers(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      if (!token) {
        push('error', 'Sessione scaduta');
        return;
      }

      // Usa API che ha accesso a auth.users con service role
      const res = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json() as { users?: UserLicense[]; error?: string };
      
      if (!res.ok) {
        throw new Error(json.error ?? 'Errore caricamento utenti');
      }

      setUserLicenses(json.users ?? []);
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingUsers(false);
    }
  }, [supabase, user, push]);

  useEffect(() => {
    if (!supabase || !user || !canUse) return;

    let cancelled = false;
    (async () => {
      try {
        await Promise.all([fetchSettings(), fetchTemplates()]);
        // Carica utenti se admin
        if (isAdminUser(user)) {
          await fetchUserLicenses();
        }
      } catch (e: unknown) {
        if (cancelled) return;
        push('error', e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, user, canUse, fetchSettings, fetchTemplates, fetchUserLicenses, push]);

  const handleSaveSettings = useCallback(async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    setSettingsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...settings,
          smtp_port: typeof settings.smtp_port === 'number' ? settings.smtp_port : Number(settings.smtp_port ?? 587),
          smtp_secure: Boolean(settings.smtp_secure),
          smtp_password: smtpPassword.trim().length > 0 ? smtpPassword : null,
        }),
      });

      const json = (await res.json()) as { settings?: AppSettings; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Salvataggio fallito');

      push('success', 'Impostazioni salvate.');
      setSmtpPassword('');
      await fetchSettings();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setSettingsSaving(false);
    }
  }, [supabase, settings, smtpPassword, fetchSettings, push]);

  // Genera nuova API key
  const handleGenerateApiKey = useCallback(async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    setApiKeyGenerating(true);
    try {
      const res = await fetch('/api/settings/apikey', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = (await res.json()) as { api_key?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Generazione fallita');

      setSettings(s => ({ ...s, api_key: json.api_key ?? null }));
      setApiKeyVisible(true);
      push('success', 'API key generata con successo!');
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setApiKeyGenerating(false);
    }
  }, [supabase, push]);

  // Revoca API key
  const handleRevokeApiKey = useCallback(async () => {
    if (!supabase) return;
    if (!confirm('Sei sicuro di voler revocare l\'API key? Le integrazioni esterne smetteranno di funzionare.')) return;

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    try {
      const res = await fetch('/api/settings/apikey', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Revoca fallita');

      setSettings(s => ({ ...s, api_key: null }));
      setApiKeyVisible(false);
      push('success', 'API key revocata.');
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    }
  }, [supabase, push]);

  const handleSaveTemplate = useCallback(async () => {
    if (!supabase) return;

    if (!templateForm.name.trim() || !templateForm.subject.trim() || !templateForm.body_html.trim()) {
      push('error', 'Compila nome, subject e body HTML.');
      return;
    }

    setTemplateSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: templateForm.name.trim(),
        subject: templateForm.subject,
        body_html: templateForm.body_html,
        body_text: templateForm.body_text.trim() ? templateForm.body_text : null,
      };

      const q = templateForm.id
        ? supabase.from('email_templates').update(payload).eq('id', templateForm.id)
        : supabase.from('email_templates').insert(payload);

      const { error } = await q;
      if (error) throw error;

      push('success', templateForm.id ? 'Template aggiornato.' : 'Template creato.');
      setTemplateForm({ id: '', name: '', subject: '', body_html: '', body_text: '' });
      await fetchTemplates();
    } catch (e: unknown) {
      push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setTemplateSaving(false);
    }
  }, [supabase, templateForm, fetchTemplates, push]);

  const handleEditTemplate = useCallback((tpl: EmailTemplate) => {
    setTemplateForm({
      id: tpl.id,
      name: tpl.name,
      subject: tpl.subject,
      body_html: tpl.body_html,
      body_text: tpl.body_text ?? '',
    });
  }, []);

  const handleDeleteTemplate = useCallback(
    async (tpl: EmailTemplate) => {
      if (!supabase) return;
      if (!confirm(`Eliminare il template "${tpl.name}"?`)) return;

      const { error } = await supabase.from('email_templates').delete().eq('id', tpl.id);
      if (error) {
        push('error', error.message);
        return;
      }

      push('success', 'Template eliminato.');
      await fetchTemplates();
    },
    [supabase, fetchTemplates, push]
  );

  // Funzioni per gestione licenze utenti
  const handleEditLicense = useCallback((userLic: UserLicense) => {
    setEditingLicense(userLic);
    setLicenseForm({
      status: userLic.status ?? 'active',
      plan: userLic.plan ?? 'standard',
      expires_at: userLic.expires_at ? userLic.expires_at.split('T')[0] : '',
    });
  }, []);

  const handleSaveLicense = useCallback(async () => {
    if (!supabase || !editingLicense) return;
    
    setSavingLicense(true);
    try {
      const payload = {
        user_id: editingLicense.user_id,
        status: licenseForm.status,
        plan: licenseForm.plan,
        expires_at: licenseForm.expires_at ? new Date(licenseForm.expires_at).toISOString() : null,
        metadata: { email: editingLicense.email },
      };

      if (editingLicense.license_id) {
        // Aggiorna licenza esistente
        const { error } = await supabase
          .from('licenses')
          .update(payload)
          .eq('id', editingLicense.license_id);
        if (error) throw error;
        push('success', 'Licenza aggiornata.');
      } else {
        // Crea nuova licenza
        const { error } = await supabase
          .from('licenses')
          .insert(payload);
        if (error) throw error;
        push('success', 'Licenza creata.');
      }

      setEditingLicense(null);
      await fetchUserLicenses();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e ? String((e as {message: unknown}).message) : 'Errore sconosciuto');
      push('error', errMsg);
    } finally {
      setSavingLicense(false);
    }
  }, [supabase, editingLicense, licenseForm, fetchUserLicenses, push]);

  const handleDeleteLicense = useCallback(async (userLic: UserLicense) => {
    if (!supabase || !userLic.license_id) return;
    if (!confirm(`Eliminare la licenza per ${userLic.email}?`)) return;

    try {
      const { error } = await supabase
        .from('licenses')
        .delete()
        .eq('id', userLic.license_id);
      if (error) throw error;
      push('success', 'Licenza eliminata.');
      await fetchUserLicenses();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e ? String((e as {message: unknown}).message) : 'Errore sconosciuto');
      push('error', errMsg);
    }
  }, [supabase, fetchUserLicenses, push]);

  // Form per creare licenza per nuovo utente
  const [newLicenseUserId, setNewLicenseUserId] = useState('');
  const [newLicenseEmail, setNewLicenseEmail] = useState('');
  const [creatingNewLicense, setCreatingNewLicense] = useState(false);

  const handleCreateNewLicense = useCallback(async () => {
    if (!supabase) return;
    
    // Verifica che almeno uno dei due campi sia compilato
    if (!newLicenseUserId.trim() && !newLicenseEmail.trim()) {
      push('error', 'Inserisci l\'ID utente o l\'email');
      return;
    }
    
    setCreatingNewLicense(true);
    try {
      const userId = newLicenseUserId.trim();
      const email = newLicenseEmail.trim();
      
      // Se non abbiamo l'ID, proviamo a cercarlo via email nelle licenze esistenti
      // Nota: In Supabase, non possiamo cercare direttamente in auth.users dal client
      // L'utente deve fornire l'ID o usare un utente già esistente
      if (!userId) {
        push('error', 'Per creare una licenza, è necessario l\'ID utente (UUID). L\'utente deve prima registrarsi al sistema.');
        setCreatingNewLicense(false);
        return;
      }

      // Valida che sia un UUID valido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        push('error', 'L\'ID utente deve essere un UUID valido (es: 123e4567-e89b-12d3-a456-426614174000)');
        setCreatingNewLicense(false);
        return;
      }

      const { error } = await supabase
        .from('licenses')
        .insert({
          user_id: userId,
          status: 'active',
          plan: 'standard',
          expires_at: null,
          metadata: { email: email || null },
        });
      
      if (error) {
        if (error.message.includes('foreign key') || error.message.includes('violates')) {
          throw new Error('Utente non trovato. L\'ID deve corrispondere a un utente registrato nel sistema.');
        }
        throw error;
      }
      
      push('success', `Licenza creata${email ? ` per ${email}` : ''}`);
      setNewLicenseUserId('');
      setNewLicenseEmail('');
      await fetchUserLicenses();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e ? String((e as {message: unknown}).message) : 'Errore sconosciuto');
      push('error', errMsg);
    } finally {
      setCreatingNewLicense(false);
    }
  }, [supabase, newLicenseUserId, newLicenseEmail, fetchUserLicenses, push]);

  // Gestione impostazioni SMTP per utente
  const handleEditUserSettings = useCallback(async (userLic: UserLicense) => {
    if (!supabase) return;
    
    setEditingUserSettings(userLic);
    
    // Carica le impostazioni esistenti dell'utente
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('owner_id', userLic.user_id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setUserSettingsForm({
          smtp_host: data.smtp_host ?? '',
          smtp_port: data.smtp_port ?? 587,
          smtp_secure: data.smtp_secure ?? false,
          smtp_user: data.smtp_user ?? '',
          smtp_from_email: data.smtp_from_email ?? '',
          smtp_from_name: data.smtp_from_name ?? '',
          smtp_reply_to: data.smtp_reply_to ?? '',
        });
      } else {
        // Reset form se non ci sono impostazioni
        setUserSettingsForm({
          smtp_host: '',
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: '',
          smtp_from_email: '',
          smtp_from_name: '',
          smtp_reply_to: '',
        });
      }
      setUserSmtpPassword('');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Errore caricamento impostazioni';
      push('error', errMsg);
    }
  }, [supabase, push]);

  const handleSaveUserSettings = useCallback(async () => {
    if (!supabase || !editingUserSettings) return;
    
    setSavingUserSettings(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        push('error', 'Sessione scaduta');
        return;
      }

      // Usa l'API settings con un parametro speciale per indicare l'owner_id target
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_owner_id: editingUserSettings.user_id, // Admin può gestire altri utenti
          smtp_host: userSettingsForm.smtp_host,
          smtp_port: userSettingsForm.smtp_port,
          smtp_secure: userSettingsForm.smtp_secure,
          smtp_user: userSettingsForm.smtp_user,
          smtp_from_email: userSettingsForm.smtp_from_email,
          smtp_from_name: userSettingsForm.smtp_from_name,
          smtp_reply_to: userSettingsForm.smtp_reply_to,
          smtp_password: userSmtpPassword.trim() || null,
        }),
      });

      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Salvataggio fallito');

      push('success', `Impostazioni email salvate per ${editingUserSettings.email}`);
      setEditingUserSettings(null);
      setUserSmtpPassword('');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Errore salvataggio';
      push('error', errMsg);
    } finally {
      setSavingUserSettings(false);
    }
  }, [supabase, editingUserSettings, userSettingsForm, userSmtpPassword, push]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (licenseState.status === 'checking' || licenseState.status === 'idle') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted">Verifica della licenza in corso…</p>
      </div>
    );
  }

  if (licenseState.status === 'error') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center text-foreground">
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-6 py-8 max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Impossibile verificare la licenza</h2>
          <p className="text-sm text-red-600/80 dark:text-red-300/80">{licenseState.message}</p>
        </div>
      </div>
    );
  }

  if (licenseState.status === 'inactive') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center text-foreground">
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 px-6 py-8 max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Licenza richiesta</h2>
          <p className="text-sm text-muted">{licenseState.reason}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-hover"
          >
            Torna alla dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Variabile per controllo admin (usata per mostrare/nascondere sezioni)
  const isAdmin = isAdminUser(user);

  return (
    <AppLayout
      user={user}
      brandName={String(settings.brand_name || 'Bitora CRM')}
      logoUrl={String(settings.logo_url || '') || null}
      onLogout={handleLogout}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Impostazioni</h1>
          <p className="text-sm text-muted">Configurazione tecnica: SMTP, API e template email.</p>
        </header>

        {/* Sezione API Key per integrazione esterna */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              🔗 Integrazione Esterna (API)
            </h2>
            <p className="text-sm text-muted mt-1">
              Usa l&apos;API key per inviare lead dal tuo sito web direttamente al CRM.
            </p>
          </div>

          {settings.api_key ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">La tua API Key</span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-mono text-foreground overflow-x-auto">
                    {apiKeyVisible ? settings.api_key : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <button
                    type="button"
                    onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground hover:bg-surface-hover"
                  >
                    {apiKeyVisible ? '🙈 Nascondi' : '👁️ Mostra'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(settings.api_key ?? '');
                      push('success', 'API key copiata!');
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground hover:bg-surface-hover"
                  >
                    📋 Copia
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleGenerateApiKey()}
                  disabled={apiKeyGenerating}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                >
                  {apiKeyGenerating ? 'Generazione...' : '🔄 Rigenera'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRevokeApiKey()}
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20"
                >
                  🗑️ Revoca
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Non hai ancora generato un&apos;API key. Genera una chiave per permettere al tuo sito di inviare lead al CRM.
              </p>
              <button
                type="button"
                onClick={() => void handleGenerateApiKey()}
                disabled={apiKeyGenerating}
                className="btn btn-primary"
              >
                {apiKeyGenerating ? 'Generazione...' : '🔑 Genera API Key'}
              </button>
            </div>
          )}

          {/* Documentazione API */}
          <div className="rounded-xl border border-border bg-surface/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">📖 Come usare l&apos;API</h3>
            <div className="text-xs text-muted space-y-2">
              <p><strong>Endpoint:</strong> <code className="bg-surface px-1.5 py-0.5 rounded">POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/leads</code></p>
              <p><strong>Header:</strong> <code className="bg-surface px-1.5 py-0.5 rounded">X-API-Key: {settings.api_key ? 'LA_TUA_API_KEY' : '(genera prima una API key)'}</code></p>
              <p><strong>Body (JSON):</strong></p>
              <pre className="bg-surface rounded-lg p-3 overflow-x-auto text-xs">
{`{
  "first_name": "Mario",
  "last_name": "Rossi",
  "email": "mario@esempio.com",
  "phone": "+39 123 456 7890",
  "message": "Richiesta informazioni",
  "source": "website"
}`}
              </pre>
              <p className="text-muted">I lead saranno automaticamente collegati al tuo account CRM.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">SMTP (invio email)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Host</span>
              <input
                value={String(settings.smtp_host ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_host: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Porta</span>
              <input
                type="number"
                value={Number(settings.smtp_port ?? 587)}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_port: Number(e.target.value) }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Username</span>
              <input
                value={String(settings.smtp_user ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_user: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Password (solo per aggiornare)</span>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 px-3.5 py-2.5 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(settings.smtp_secure)}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_secure: e.target.checked }))}
              />
              Connessione sicura (TLS)
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">From email</span>
              <input
                value={String(settings.smtp_from_email ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_from_email: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">From name</span>
              <input
                value={String(settings.smtp_from_name ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_from_name: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Reply-To</span>
              <input
                value={String(settings.smtp_reply_to ?? '')}
                onChange={(e) => setSettings((s) => ({ ...s, smtp_reply_to: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
            </label>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={settingsSaving}
              onClick={handleSaveSettings}
              className="btn btn-primary"
            >
              {settingsSaving ? 'Salvataggio…' : 'Salva impostazioni'}
            </button>
          </div>

          <p className="text-xs text-muted">
            Placeholder supportati nei template: {'{{first_name}}'}, {'{{last_name}}'}, {'{{full_name}}'}, {'{{email}}'}, {'{{phone}}'}.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Template email</h2>
            <button
              type="button"
              onClick={() => setTemplateForm({ id: '', name: '', subject: '', body_html: '', body_text: '' })}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-hover"
            >
              Nuovo template
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-muted" colSpan={3}>
                      Nessun template ancora.
                    </td>
                  </tr>
                ) : (
                  templates.map((tpl) => (
                    <tr key={tpl.id} className="bg-surface/40">
                      <td className="px-4 py-3 text-foreground">{tpl.name}</td>
                      <td className="px-4 py-3 text-muted truncate max-w-[420px]">{tpl.subject}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditTemplate(tpl)}
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover"
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTemplate(tpl)}
                            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/20"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-border bg-surface/40 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Nome</span>
                <input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Subject</span>
                <input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Body HTML</span>
              <textarea
                value={templateForm.body_html}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body_html: e.target.value }))}
                rows={8}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground"
                placeholder="<h1>Ciao {{first_name}}</h1>"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Body testo (opzionale)</span>
              <textarea
                value={templateForm.body_text}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body_text: e.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={templateSaving}
                onClick={() => setTemplateForm({ id: '', name: '', subject: '', body_html: '', body_text: '' })}
                className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-hover disabled:opacity-70"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={templateSaving}
                onClick={() => void handleSaveTemplate()}
                className="btn btn-primary disabled:opacity-70"
              >
                {templateSaving ? 'Salvataggio…' : templateForm.id ? 'Aggiorna template' : 'Crea template'}
              </button>
            </div>
          </div>
        </section>

        {/* Sezione Gestione Utenti - Solo Admin */}
        {isAdmin && (
        <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Gestione Utenti e Licenze
              </h2>
              <p className="text-sm text-muted mt-1">Gestisci le licenze degli utenti del sistema</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchUserLicenses()}
              disabled={loadingUsers}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-hover"
            >
              {loadingUsers ? 'Caricamento…' : 'Aggiorna'}
            </button>
          </div>

          {/* Form per nuova licenza */}
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Aggiungi nuova licenza</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={newLicenseUserId}
                onChange={(e) => setNewLicenseUserId(e.target.value)}
                placeholder="ID utente (UUID) *"
                className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
              <input
                type="email"
                value={newLicenseEmail}
                onChange={(e) => setNewLicenseEmail(e.target.value)}
                placeholder="Email (opzionale)"
                className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => void handleCreateNewLicense()}
                disabled={creatingNewLicense || !newLicenseUserId.trim()}
                className="btn btn-primary disabled:opacity-50"
              >
                {creatingNewLicense ? 'Creazione…' : 'Crea licenza'}
              </button>
            </div>
            <p className="text-xs text-muted mt-2">
              L&apos;ID utente (UUID) è obbligatorio e deve corrispondere a un utente registrato. Puoi trovarlo nella dashboard di Supabase &gt; Authentication &gt; Users.
            </p>
          </div>

          {/* Tabella utenti */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Email/ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Stato</th>
                  <th className="px-4 py-3 text-left font-semibold">Piano</th>
                  <th className="px-4 py-3 text-left font-semibold">Scadenza</th>
                  <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {userLicenses.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-muted" colSpan={5}>
                      {loadingUsers ? 'Caricamento utenti…' : 'Nessuna licenza trovata.'}
                    </td>
                  </tr>
                ) : (
                  userLicenses.map((ul) => (
                    <tr key={ul.user_id} className="bg-surface/40">
                      <td className="px-4 py-3 text-foreground">
                        <div className="flex flex-col">
                          <span className="font-medium">{ul.email}</span>
                          <span className="text-xs text-muted truncate max-w-[200px]">{ul.user_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            ul.status === 'active'
                              ? 'inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400'
                              : ul.status === 'trial'
                                ? 'inline-flex rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400'
                                : ul.status === 'expired'
                                  ? 'inline-flex rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400'
                                  : 'inline-flex rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400'
                          }
                        >
                          {ul.status ?? 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{ul.plan ?? '-'}</td>
                      <td className="px-4 py-3 text-muted">
                        {ul.expires_at ? new Date(ul.expires_at).toLocaleDateString('it-IT') : 'Illimitata'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void handleEditUserSettings(ul)}
                            className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                            title="Configura SMTP"
                          >
                            📧 Email
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditLicense(ul)}
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover"
                          >
                            Licenza
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteLicense(ul)}
                            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/20"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal modifica licenza */}
          {editingLicense && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Modifica Licenza</h3>
                  <button
                    onClick={() => setEditingLicense(null)}
                    className="p-1 rounded-lg hover:bg-surface-hover"
                  >
                    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-muted">{editingLicense.email}</p>

                <div className="space-y-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Stato</span>
                    <select
                      value={licenseForm.status}
                      onChange={(e) => setLicenseForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                    >
                      <option value="active">Attiva</option>
                      <option value="trial">Trial</option>
                      <option value="inactive">Inattiva</option>
                      <option value="expired">Scaduta</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Piano</span>
                    <select
                      value={licenseForm.plan}
                      onChange={(e) => setLicenseForm(f => ({ ...f, plan: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                    >
                      <option value="standard">Standard</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Scadenza (opzionale)</span>
                    <input
                      type="date"
                      value={licenseForm.expires_at}
                      onChange={(e) => setLicenseForm(f => ({ ...f, expires_at: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingLicense(null)}
                    className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-hover"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={savingLicense}
                    onClick={() => void handleSaveLicense()}
                    className="btn btn-primary disabled:opacity-70"
                  >
                    {savingLicense ? 'Salvataggio…' : 'Salva'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modale impostazioni email utente */}
          {editingUserSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">📧 Impostazioni Email</h3>
                  <button
                    onClick={() => { setEditingUserSettings(null); setUserSmtpPassword(''); }}
                    className="p-1 rounded-lg hover:bg-surface-hover"
                  >
                    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{editingUserSettings.email}</p>
                    <p className="text-xs text-muted truncate max-w-[300px]">{editingUserSettings.user_id}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">SMTP Host</span>
                      <input
                        value={userSettingsForm.smtp_host ?? ''}
                        onChange={(e) => setUserSettingsForm(f => ({ ...f, smtp_host: e.target.value }))}
                        placeholder="smtp.gmail.com"
                        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Porta</span>
                      <input
                        type="number"
                        value={userSettingsForm.smtp_port ?? 587}
                        onChange={(e) => setUserSettingsForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))}
                        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettingsForm.smtp_secure ?? false}
                      onChange={(e) => setUserSettingsForm(f => ({ ...f, smtp_secure: e.target.checked }))}
                      className="h-5 w-5 rounded border border-border bg-surface"
                    />
                    <span className="text-sm text-foreground">SSL/TLS (Secure)</span>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">SMTP User</span>
                      <input
                        value={userSettingsForm.smtp_user ?? ''}
                        onChange={(e) => setUserSettingsForm(f => ({ ...f, smtp_user: e.target.value }))}
                        placeholder="user@example.com"
                        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Password SMTP</span>
                      <input
                        type="password"
                        value={userSmtpPassword}
                        onChange={(e) => setUserSmtpPassword(e.target.value)}
                        placeholder="Lascia vuoto per non modificare"
                        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">From Email</span>
                      <input
                        value={userSettingsForm.smtp_from_email ?? ''}
                        onChange={(e) => setUserSettingsForm(f => ({ ...f, smtp_from_email: e.target.value }))}
                        placeholder="noreply@example.com"
                        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">From Name</span>
                      <input
                        value={userSettingsForm.smtp_from_name ?? ''}
                        onChange={(e) => setUserSettingsForm(f => ({ ...f, smtp_from_name: e.target.value }))}
                        placeholder="La Mia Azienda"
                        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Reply-To</span>
                    <input
                      value={userSettingsForm.smtp_reply_to ?? ''}
                      onChange={(e) => setUserSettingsForm(f => ({ ...f, smtp_reply_to: e.target.value }))}
                      placeholder="support@example.com"
                      className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditingUserSettings(null); setUserSmtpPassword(''); }}
                    className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-hover"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={savingUserSettings}
                    onClick={() => void handleSaveUserSettings()}
                    className="btn btn-primary disabled:opacity-70"
                  >
                    {savingUserSettings ? 'Salvataggio…' : 'Salva Impostazioni'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
        )}
      </div>
    </AppLayout>
  );
}

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsApp />
    </ToastProvider>
  );
}
