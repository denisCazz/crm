-- Bitora CRM - Sistema di autenticazione personalizzato
-- Sostituisce Supabase Auth con tabelle custom

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- USERS (sostituisce auth.users)
-- =====================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  email_verified boolean NOT NULL DEFAULT true, -- Attivo di default
  password_hash text NOT NULL,
  
  -- Metadata utente
  first_name text,
  last_name text,
  user_metadata jsonb DEFAULT '{}'::jsonb,
  app_metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Tracking
  last_sign_in_at timestamptz,
  confirmed_at timestamptz DEFAULT timezone('utc', now()), -- Confermato di default
  
  -- Password reset (manteniamo solo questo)
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

-- Helper per updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- SESSIONS
-- =====================

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  refresh_token text UNIQUE,
  
  -- Session info
  user_agent text,
  ip_address inet,
  
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_activity_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON public.sessions(token);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions(expires_at);

-- =====================
-- AUDIT LOG (opzionale ma consigliato)
-- =====================

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL, -- login, logout, password_reset, etc.
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS auth_audit_log_user_id_idx ON public.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS auth_audit_log_created_at_idx ON public.auth_audit_log(created_at DESC);

-- =====================
-- RLS POLICIES
-- =====================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Users: solo service role può gestire direttamente
-- (l'accesso normale avviene tramite API routes)
CREATE POLICY "Service role full access users"
ON public.users
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Sessions: solo service role
CREATE POLICY "Service role full access sessions"
ON public.sessions
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Audit log: solo service role
CREATE POLICY "Service role full access audit"
ON public.auth_audit_log
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- =====================
-- FUNZIONI HELPER
-- =====================

-- Funzione per ottenere l'user_id dalla sessione corrente
-- (sostituisce auth.uid())
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Cerca nel context runtime (verrà impostato dall'API)
  RETURN current_setting('app.current_user_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Funzione per verificare se l'utente corrente è admin
-- (sostituisce la logica auth.role())
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

-- =====================
-- CLEANUP: rimuovi sessioni scadute (esegui periodicamente)
-- =====================

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.sessions
  WHERE expires_at < timezone('utc', now());
END;
$$;

COMMIT;

-- =====================
-- NOTE MIGRAZIONE
-- =====================

-- Per migrare utenti esistenti da auth.users:
-- 
-- INSERT INTO public.users (id, email, email_verified, password_hash, user_metadata, app_metadata, confirmed_at, created_at)
-- SELECT 
--   id,
--   email,
--   email_confirmed_at IS NOT NULL,
--   encrypted_password, -- o un hash temporaneo se vuoi che gli utenti resettino la password
--   COALESCE(raw_user_meta_data, '{}'::jsonb),
--   COALESCE(raw_app_meta_data, '{}'::jsonb),
--   email_confirmed_at,
--   created_at
-- FROM auth.users;

-- IMPORTANTE: Assicurati di informare gli utenti esistenti che dovranno
-- fare un reset della password dopo la migrazione per sicurezza.
