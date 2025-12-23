-- Supabase schema for Bitora CRM email marketing (idempotente)

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============
-- Clients: tracking new clients
-- ==============

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='clients'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clients' AND column_name='lead_source'
    ) THEN
      ALTER TABLE public.clients
        ADD COLUMN lead_source text NOT NULL DEFAULT 'manual';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clients' AND column_name='contact_request'
    ) THEN
      ALTER TABLE public.clients
        ADD COLUMN contact_request text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clients' AND column_name='status'
    ) THEN
      ALTER TABLE public.clients
        ADD COLUMN status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','archived'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clients' AND column_name='first_contacted_at'
    ) THEN
      ALTER TABLE public.clients
        ADD COLUMN first_contacted_at timestamptz;
    END IF;

    CREATE INDEX IF NOT EXISTS clients_owner_status_idx ON public.clients(owner_id, status);
    CREATE INDEX IF NOT EXISTS clients_owner_email_idx ON public.clients(owner_id, email);
  END IF;
END$$;

-- ==============
-- App settings (per owner/tenant)
-- ==============

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

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

-- ==============
-- Email templates
-- ==============

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

-- Se la tabella esiste già, garantisci che owner_id abbia default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='email_templates'
  ) THEN
    EXECUTE 'ALTER TABLE public.email_templates ALTER COLUMN owner_id SET DEFAULT auth.uid()';
  END IF;
END$$;

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

-- ==============
-- Email sends (log)
-- ==============

CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
