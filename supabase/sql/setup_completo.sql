-- ============================================
-- Bitora CRM - Setup Completo Database
-- ============================================
-- Esegui questo script UNICO su Supabase SQL Editor
-- Crea tutte le tabelle nell'ordine corretto
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PARTE 1: AUTENTICAZIONE (DEVE ESSERE PRIMA!)
-- ============================================

-- Helper: updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

-- Tabella USERS (sostituisce auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  email_verified boolean NOT NULL DEFAULT true,
  password_hash text NOT NULL,
  
  -- Metadata utente
  first_name text,
  last_name text,
  user_metadata jsonb DEFAULT '{}'::jsonb,
  app_metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Tracking
  last_sign_in_at timestamptz,
  confirmed_at timestamptz DEFAULT timezone('utc', now()),
  
  -- Password reset
  recovery_token text UNIQUE,
  recovery_sent_at timestamptz,
  
  -- Account status
  is_active boolean NOT NULL DEFAULT true,
  banned_until timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_recovery_token_idx ON public.users(recovery_token) WHERE recovery_token IS NOT NULL;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabella SESSIONS
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  refresh_token text UNIQUE,
  
  user_agent text,
  ip_address inet,
  
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_activity_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON public.sessions(token);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions(expires_at);

-- Tabella AUDIT LOG
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS auth_audit_log_user_id_idx ON public.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS auth_audit_log_created_at_idx ON public.auth_audit_log(created_at DESC);

-- Funzioni helper
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := public.current_user_id();
  IF uid IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = uid
  );
END;
$$;

-- RLS per autenticazione
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy per users (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='users'
      AND policyname='Service role full access users'
  ) THEN
    DROP POLICY "Service role full access users" ON public.users;
  END IF;

  CREATE POLICY "Service role full access users"
  ON public.users FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
END$$;

-- Policy per sessions (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sessions'
      AND policyname='Service role full access sessions'
  ) THEN
    DROP POLICY "Service role full access sessions" ON public.sessions;
  END IF;

  CREATE POLICY "Service role full access sessions"
  ON public.sessions FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
END$$;

-- Policy per audit log (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='auth_audit_log'
      AND policyname='Service role full access audit'
  ) THEN
    DROP POLICY "Service role full access audit" ON public.auth_audit_log;
  END IF;

  CREATE POLICY "Service role full access audit"
  ON public.auth_audit_log FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
END$$;

-- ============================================
-- PARTE 2: TABELLE PRINCIPALI
-- ============================================

-- CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  notes text,
  tags text[],

  lat double precision,
  lon double precision,

  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','archived')),
  first_contacted_at timestamptz,

  lead_source text NOT NULL DEFAULT 'manual',
  contact_request text,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS clients_owner_id_idx ON public.clients(owner_id);
CREATE INDEX IF NOT EXISTS clients_owner_status_idx ON public.clients(owner_id, status);
CREATE INDEX IF NOT EXISTS clients_owner_email_idx ON public.clients(owner_id, email);

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clients'
      AND policyname='Owners manage clients'
  ) THEN
    CREATE POLICY "Owners manage clients"
    ON public.clients FOR ALL
    USING (current_setting('role') = 'service_role' OR owner_id = public.current_user_id())
    WITH CHECK (current_setting('role') = 'service_role' OR owner_id = public.current_user_id());
  END IF;
END$$;

-- ADMIN USERS
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='admin_users'
      AND policyname='Admin can see admin list'
  ) THEN
    DROP POLICY "Admin can see admin list" ON public.admin_users;
  END IF;

  CREATE POLICY "Admin can see admin list"
  ON public.admin_users FOR SELECT
  USING (
    current_setting('role') = 'service_role'
    OR user_id = public.current_user_id()
  );
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='admin_users'
      AND policyname='Service role manages admin list'
  ) THEN
    CREATE POLICY "Service role manages admin list"
    ON public.admin_users FOR ALL
    USING (current_setting('role') = 'service_role')
    WITH CHECK (current_setting('role') = 'service_role');
  END IF;
END$$;

-- LICENSES
CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active', 'trial', 'inactive', 'expired')),
  expires_at timestamptz,
  plan text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS licenses_user_id_idx ON public.licenses(user_id);
CREATE INDEX IF NOT EXISTS licenses_status_idx ON public.licenses(status);

DROP TRIGGER IF EXISTS licenses_set_updated_at ON public.licenses;
CREATE TRIGGER licenses_set_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='licenses'
      AND policyname='Owners can read their license'
  ) THEN
    CREATE POLICY "Owners can read their license"
    ON public.licenses FOR SELECT
    USING (current_setting('role') = 'service_role' OR user_id = public.current_user_id());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='licenses'
      AND policyname='Admins manage licenses'
  ) THEN
    CREATE POLICY "Admins manage licenses"
    ON public.licenses FOR ALL
    USING (
      current_setting('role') = 'service_role'
      OR public.is_current_user_admin()
    )
    WITH CHECK (
      current_setting('role') = 'service_role'
      OR public.is_current_user_admin()
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clients'
      AND policyname='Admins read clients'
  ) THEN
    CREATE POLICY "Admins read clients"
    ON public.clients FOR SELECT
    USING (
      owner_id = public.current_user_id()
      OR current_setting('role') = 'service_role'
      OR public.is_current_user_admin()
    );
  END IF;
END$$;

-- APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  brand_name text,
  logo_url text,

  smtp_host text,
  smtp_port integer,
  smtp_secure boolean,
  smtp_user text,
  smtp_password_enc text,

  smtp_from_email text,
  smtp_from_name text,
  smtp_reply_to text,

  api_key text UNIQUE,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT app_settings_owner_unique UNIQUE (owner_id)
);

CREATE INDEX IF NOT EXISTS app_settings_owner_idx ON public.app_settings(owner_id);
CREATE INDEX IF NOT EXISTS app_settings_api_key_idx ON public.app_settings(api_key) WHERE api_key IS NOT NULL;

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_set_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='app_settings'
      AND policyname='Owners manage app settings'
  ) THEN
    CREATE POLICY "Owners manage app settings"
    ON public.app_settings FOR ALL
    USING (current_setting('role') = 'service_role' OR owner_id = public.current_user_id())
    WITH CHECK (current_setting('role') = 'service_role' OR owner_id = public.current_user_id());
  END IF;
END$$;

-- EMAIL TEMPLATES
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS email_templates_owner_idx ON public.email_templates(owner_id);

DROP TRIGGER IF EXISTS email_templates_set_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_set_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='email_templates'
      AND policyname='Owners manage email templates'
  ) THEN
    CREATE POLICY "Owners manage email templates"
    ON public.email_templates FOR ALL
    USING (current_setting('role') = 'service_role' OR owner_id = public.current_user_id())
    WITH CHECK (current_setting('role') = 'service_role' OR owner_id = public.current_user_id());
  END IF;
END$$;

-- EMAIL SENDS
CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS email_sends_owner_created_idx ON public.email_sends(owner_id, created_at DESC);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='email_sends'
      AND policyname='Owners read email sends'
  ) THEN
    CREATE POLICY "Owners read email sends"
    ON public.email_sends FOR SELECT
    USING (current_setting('role') = 'service_role' OR owner_id = public.current_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='email_sends'
      AND policyname='Owners insert email sends'
  ) THEN
    CREATE POLICY "Owners insert email sends"
    ON public.email_sends FOR INSERT
    WITH CHECK (current_setting('role') = 'service_role' OR owner_id = public.current_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='email_sends'
      AND policyname='Owners update their email sends'
  ) THEN
    CREATE POLICY "Owners update their email sends"
    ON public.email_sends FOR UPDATE
    USING (current_setting('role') = 'service_role' OR owner_id = public.current_user_id())
    WITH CHECK (current_setting('role') = 'service_role' OR owner_id = public.current_user_id());
  END IF;
END$$;

-- VIEW
CREATE OR REPLACE VIEW public.license_with_owner AS
SELECT
  l.id,
  l.user_id,
  l.status,
  l.expires_at,
  l.plan,
  l.metadata,
  l.created_at,
  l.updated_at,
  c.first_name,
  c.last_name,
  c.email,
  c.phone
FROM public.licenses l
LEFT JOIN public.clients c ON c.owner_id = l.user_id;

COMMIT;

-- ============================================
-- VERIFICA FINALE
-- ============================================
-- Esegui questa query per verificare che tutto sia OK:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('users', 'sessions', 'clients', 'licenses', 'app_settings', 'email_templates', 'email_sends');
-- ============================================
