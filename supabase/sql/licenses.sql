-- Supabase schema for Bitora CRM license management (idempotente)

BEGIN;

-- Estensioni: basta pgcrypto per gen_random_uuid()
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

-- Admin list
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Licenses
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
CREATE INDEX IF NOT EXISTS licenses_status_idx   ON public.licenses(status);

-- Trigger idempotente
DROP TRIGGER IF EXISTS licenses_set_updated_at ON public.licenses;
CREATE TRIGGER licenses_set_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses   ENABLE ROW LEVEL SECURITY;

-- POLICIES (idempotenti)

-- Admin can see admin list
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
    current_setting('role') = 'service_role'
    OR user_id = public.current_user_id()
  );
END$$;

-- Service role manages admin list (ALL)
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
    USING (current_setting('role') = 'service_role')
    WITH CHECK (current_setting('role') = 'service_role');
  END IF;
END$$;

-- Owners can read their license
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
    USING (current_setting('role') = 'service_role' OR user_id = public.current_user_id());
  END IF;
END$$;

-- Admins manage licenses (ALL)
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
      current_setting('role') = 'service_role'
      OR public.is_current_user_admin()
    )
    WITH CHECK (
      current_setting('role') = 'service_role'
      OR public.is_current_user_admin()
    );
  END IF;
END$$;

COMMIT;

-- Optional: view solo se esiste public.clients
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='clients'
  ) THEN
    -- Abilita RLS sulla tabella clients (idempotente)
    EXECUTE 'ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY';

    -- Policy per consentire agli admin di leggere tutti i clienti
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='clients'
        AND policyname='Admins read clients'
    ) THEN
      EXECUTE '
        CREATE POLICY "Admins read clients"
        ON public.clients
        FOR SELECT
        USING (
          owner_id = public.current_user_id()
          OR current_setting(''role'') = ''service_role''
          OR public.is_current_user_admin()
        );
      ';
    END IF;

    -- Vista di supporto (aggiornata)
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
  END IF;
END$$;
