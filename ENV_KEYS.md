# Variabili ambiente da impostare

Queste variabili servono per far funzionare Bitora CRM (Next.js + Supabase) con licenze, impostazioni e invio email via SMTP.

## Obbligatorie

### Supabase (client)

- `NEXT_PUBLIC_SUPABASE_URL`
  - URL del progetto Supabase (Settings → API)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Anon public key (Settings → API)

### Supabase (server)

- `SUPABASE_SERVICE_ROLE_KEY`
  - Service Role key (Settings → API)
  - Usata SOLO lato server nelle route:
    - `/api/settings`
    - `/api/email/send`
  - Non va mai esposta nel browser.

### SMTP Sistema (Brevo)

- `BREVO_SMTP_HOST`
  - Default: `smtp-relay.brevo.com`
  - Host SMTP Brevo per invio email centralizzato

- `BREVO_SMTP_PORT`
  - Default: `587`
  - Porta SMTP

- `BREVO_SMTP_USER`
  - Username SMTP Brevo (es: `9e3f1b001@smtp-brevo.com`)

- `BREVO_SMTP_PASSWORD`
  - Password SMTP Brevo (la chiave SMTP da Brevo dashboard)

- `BREVO_SMTP_FROM_EMAIL`
  - Email mittente statica (es: `noreply@bitora-crm.com`)
  - Le risposte vanno al Reply-To dell'utente

### Cifratura password SMTP (legacy)

- `SMTP_ENCRYPTION_SECRET`
  - Segreto usato per cifrare/decifrare la password SMTP salvata in `public.app_settings.smtp_password_enc`.
  - **Nota:** Con il nuovo sistema Brevo centralizzato, questo non è più necessario.
  - Mantienilo per backward compatibility.

## Admin (opzionale ma consigliato)

- `NEXT_PUBLIC_ADMIN_EMAILS`
  - Lista email separate da virgola per abilitare accesso rapido a `/admin`.
  - Esempio: `admin@example.com,ceo@example.com`

> In alternativa (o in aggiunta) puoi inserire l’utente in `public.admin_users` da SQL.

## Rate limiting API (opzionale)

Se vuoi attivare il rate limit sulle route `/api/*` (middleware Upstash):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Se non le imposti, l’app continua a funzionare senza rate limiting.

## Endpoint pubblici lead (newsletter/contatto)

Queste variabili servono per usare gli endpoint:

- `POST /api/leads/newsletter`
- `POST /api/leads/contact`

Variabili:

- `LEADS_OWNER_ID` (consigliata/necessaria)
  - L’`owner_id` (UUID utente Supabase) a cui associare i lead in ingresso.
  - Se non è impostata, gli endpoint rispondono 500.

- `LEADS_API_KEY` (opzionale ma consigliata)
  - Se impostata, gli endpoint richiedono header `X-API-Key: <valore>`.

- `LEADS_CORS_ORIGIN` (opzionale)
  - Default `*`. Se vuoi restringere, imposta l’origin consentito (es. `https://tuodominio.it`).

## Esempio `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx
SMTP_ENCRYPTION_SECRET=una-stringa-molto-lunga-e-segreta
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com

# lead endpoints (newsletter/contatti)
# LEADS_OWNER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# LEADS_API_KEY=una-chiave-segreta
# LEADS_CORS_ORIGIN=https://tuodominio.it

# opzionali
# UPSTASH_REDIS_REST_URL=...
# UPSTASH_REDIS_REST_TOKEN=...
```
