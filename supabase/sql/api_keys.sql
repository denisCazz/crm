-- Aggiunge colonna api_key alla tabella app_settings per integrazione esterna

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

-- Indice per lookup veloce dell'API key
CREATE INDEX IF NOT EXISTS app_settings_api_key_idx ON public.app_settings(api_key) WHERE api_key IS NOT NULL;

COMMIT;
