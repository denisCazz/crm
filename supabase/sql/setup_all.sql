-- Bitora CRM - Setup completo Supabase (idempotente)
--
-- Come usarlo:
-- 1) Apri Supabase Dashboard → SQL Editor
-- 2) Incolla ed esegui questo file
--
-- Crea/aggiorna:
-- - public.clients (CRM)
-- - public.admin_users, public.licenses (+ view) (licenze)
-- - public.app_settings (brand + SMTP cifrato)
-- - public.email_templates
-- - public.email_sends (log invii)
-- - trigger set_updated_at + RLS + policy principali

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper: updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

-- =====================
-- CLIENTS (CRM)
-- =====================

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

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

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Estensioni compatibili per lead in ingresso (newsletter/contatti)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_request text;

CREATE INDEX IF NOT EXISTS clients_owner_id_idx ON public.clients(owner_id);
CREATE INDEX IF NOT EXISTS clients_owner_status_idx ON public.clients(owner_id, status);
CREATE INDEX IF NOT EXISTS clients_owner_email_idx ON public.clients(owner_id, email);

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Owner CRUD sui propri clienti
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clients'
      AND policyname='Owners manage clients'
  ) THEN
    CREATE POLICY "Owners manage clients"
    ON public.clients
    FOR ALL
    USING (auth.role() = 'service_role' OR owner_id = auth.uid())
    WITH CHECK (auth.role() = 'service_role' OR owner_id = auth.uid());
  END IF;
END$$;

-- =====================
-- ADMIN + LICENSES
-- =====================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Admin list: lettura solo service_role o self
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='admin_users'
      AND policyname='Admin can see admin list'
  ) THEN
    EXECUTE 'DROP POLICY "Admin can see admin list" ON public.admin_users';
  END IF;

  CREATE POLICY "Admin can see admin list"
  ON public.admin_users
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id = auth.uid()
  );
END$$;

-- Admin list: gestione solo service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='admin_users'
      AND policyname='Service role manages admin list'
  ) THEN
    CREATE POLICY "Service role manages admin list"
    ON public.admin_users
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Licenses: owner legge la propria
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='licenses'
      AND policyname='Owners can read their license'
  ) THEN
    CREATE POLICY "Owners can read their license"
    ON public.licenses
    FOR SELECT
    USING (auth.role() = 'service_role' OR user_id = auth.uid());
  END IF;
END$$;

-- Licenses: admin gestisce (via admin_users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='licenses'
      AND policyname='Admins manage licenses'
  ) THEN
    CREATE POLICY "Admins manage licenses"
    ON public.licenses
    FOR ALL
    USING (
      auth.role() = 'service_role'
      OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
    )
    WITH CHECK (
      auth.role() = 'service_role'
      OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
    );
  END IF;
END$$;

-- Clients: admin può leggere tutti
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clients'
      AND policyname='Admins read clients'
  ) THEN
    CREATE POLICY "Admins read clients"
    ON public.clients
    FOR SELECT
    USING (
      owner_id = auth.uid()
      OR auth.role() = 'service_role'
      OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
    );
  END IF;
END$$;

-- View: licenza + dati owner (se client esiste)
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

-- =====================
-- APP SETTINGS (brand + SMTP)
-- =====================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

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

-- Backfill/compat: if table already existed without api_key, add it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='app_settings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='app_settings' AND column_name='api_key'
    ) THEN
      ALTER TABLE public.app_settings
        ADD COLUMN api_key text UNIQUE;
    END IF;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS app_settings_owner_idx ON public.app_settings(owner_id);

-- Lookup veloce per /api/leads (X-API-Key)
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
    ON public.app_settings
    FOR ALL
    USING (auth.role() = 'service_role' OR owner_id = auth.uid())
    WITH CHECK (auth.role() = 'service_role' OR owner_id = auth.uid());
  END IF;
END$$;

-- =====================
-- EMAIL TEMPLATES
-- =====================

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
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
    ON public.email_templates
    FOR ALL
    USING (auth.role() = 'service_role' OR owner_id = auth.uid())
    WITH CHECK (auth.role() = 'service_role' OR owner_id = auth.uid());
  END IF;
END$$;

-- =====================
-- EMAIL SENDS (LOG)
-- =====================

CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
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
    ON public.email_sends
    FOR SELECT
    USING (auth.role() = 'service_role' OR owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='email_sends'
      AND policyname='Owners insert email sends'
  ) THEN
    CREATE POLICY "Owners insert email sends"
    ON public.email_sends
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role' OR owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='email_sends'
      AND policyname='Owners update their email sends'
  ) THEN
    CREATE POLICY "Owners update their email sends"
    ON public.email_sends
    FOR UPDATE
    USING (auth.role() = 'service_role' OR owner_id = auth.uid())
    WITH CHECK (auth.role() = 'service_role' OR owner_id = auth.uid());
  END IF;
END$$;

COMMIT;
