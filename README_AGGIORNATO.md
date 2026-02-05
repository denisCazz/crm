# Bitora CRM - Sistema Aggiornato

## 🎯 Novità Principali

### ✨ Autenticazione Personalizzata
Il CRM ora utilizza un sistema di autenticazione personalizzato invece di Supabase Auth, offrendo:
- Controllo completo sul processo di autenticazione
- Audit log completo di tutti gli accessi
- Gestione personalizzabile delle password
- Token di sessione con scadenza configurabile

### 📁 Nuovi File Importanti

#### Documentazione
- **MIGRAZIONE_AUTH.md** - Guida completa per completare la migrazione
- **MIGLIORAMENTI_PROGETTO.md** - Dettagli tecnici di tutti i miglioramenti
- **README_AGGIORNATO.md** - Questo file

#### Codice
- `lib/auth.ts` - Core autenticazione server-side
- `lib/authClient.ts` - Helper autenticazione client-side
- `lib/authHelpers.ts` - Utility per API routes
- `supabase/sql/auth_custom.sql` - Schema database autenticazione

---

## 🚀 Quick Start

### 1. Installazione Dipendenze

```bash
npm install
```

### 2. Setup Database

Esegui gli script SQL su Supabase **in quest'ordine**:

```bash
# 1. Crea schema autenticazione personalizzata
supabase/sql/auth_custom.sql

# 2. Aggiorna schema esistente
supabase/sql/setup_all.sql
```

### 3. Variabili Ambiente

Crea/aggiorna `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com,ceo@example.com

# SMTP (per cifratura password)
SMTP_ENCRYPTION_SECRET=una-stringa-lunga-e-segreta

# Optional
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Avvio

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

---

## 📖 Come Funziona

### Autenticazione

#### Registrazione
1. Utente si registra con email e password
2. Sistema crea record in `public.users` con password hashata
3. Viene generato un `confirmation_token`
4. (TODO: Inviare email di conferma)
5. Viene creata automaticamente una licenza trial

#### Login
1. Utente inserisce email e password
2. Sistema verifica credenziali
3. Crea sessione in `public.sessions` con token sicuro
4. Token salvato in localStorage
5. Log evento in `auth_audit_log`

#### Verifica Sessione
1. Client invia Bearer token
2. Server verifica token in `sessions`
3. Controlla scadenza
4. Aggiorna `last_activity_at`
5. Ritorna dati utente

#### Logout
1. Client invia richiesta con Bearer token
2. Server elimina sessione da database
3. Client rimuove token da localStorage

### Protezione Route

Le API routes sono protette con helper:

```typescript
// Richiede autenticazione
const user = await requireAuth(request);

// Richiede ruolo admin
const user = await requireAdmin(request, ADMIN_EMAILS);
```

---

## 🔐 Sicurezza

### Password
- **Attuale**: SHA-256 (funzionante ma basic)
- **Consigliato**: Upgrade a bcrypt o argon2 per produzione

### Sessioni
- Token: 32 bytes cryptographically random
- Scadenza: 30 giorni (configurabile)
- Refresh token: supportato
- Tracking: IP e User Agent

### Audit Log
Tutti gli eventi vengono tracciati:
- Login success/failed
- Registrazioni
- Logout
- Reset password
- Aggiornamenti profilo

---

## 📊 Struttura Database

### Nuove Tabelle

#### `public.users`
Sostituisce `auth.users`:
- id, email, password_hash
- email_verified, is_active
- user_metadata, app_metadata (jsonb)
- confirmation_token, recovery_token
- Tracking: created_at, updated_at, last_sign_in_at

#### `public.sessions`
Gestione sessioni:
- user_id, token, refresh_token
- expires_at, last_activity_at
- user_agent, ip_address

#### `public.auth_audit_log`
Audit completo:
- user_id, event_type
- ip_address, user_agent
- metadata (jsonb)

### Tabelle Aggiornate

Tutte le foreign keys ora puntano a `public.users`:
- `clients.owner_id` → `public.users(id)`
- `licenses.user_id` → `public.users(id)`
- `admin_users.user_id` → `public.users(id)`
- `app_settings.owner_id` → `public.users(id)`
- Etc.

---

## 🛠️ API Endpoints

### Autenticazione

```bash
POST   /api/auth/signin              # Login
POST   /api/auth/signup              # Registrazione
POST   /api/auth/signout             # Logout
GET    /api/auth/session             # Verifica sessione
GET    /api/auth/user                # Get utente corrente
PATCH  /api/auth/user                # Update utente
POST   /api/auth/reset-password      # Richiedi reset
POST   /api/auth/reset-password/confirm  # Conferma reset
```

### Esistenti (Aggiornate)

Tutte le API esistenti ora usano la nuova autenticazione:
- `/api/settings`
- `/api/settings/apikey`
- `/api/users`
- `/api/email/send`
- `/api/email/newsletter`
- `/api/license`
- Etc.

Esempio uso:

```javascript
const response = await fetch('/api/settings', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 🧪 Testing

### 1. Test Flow Registrazione

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "metadata": {
      "first_name": "Mario",
      "last_name": "Rossi"
    }
  }'
```

### 2. Test Flow Login

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Risposta:
```json
{
  "user": { ... },
  "session": {
    "token": "abc123...",
    "expires_at": "..."
  }
}
```

### 3. Test Verifica Sessione

```bash
curl http://localhost:3000/api/auth/session \
  -H "Authorization: Bearer abc123..."
```

### 4. Test Reset Password

```bash
# Richiedi reset
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# In dev mode, il token viene restituito nella risposta
# Conferma reset
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TOKEN_FROM_EMAIL",
    "password": "newpassword123"
  }'
```

---

## 📝 TODO List

### Critici (Da fare prima del deploy)
- [ ] Eseguire script SQL su Supabase
- [ ] Configurare invio email (conferma + reset)
- [ ] Upgrade password hashing a bcrypt
- [ ] Testare tutti i flow in dev

### Consigliati
- [ ] Implementare conferma email
- [ ] Aggiungere 2FA (Two-Factor Authentication)
- [ ] Dashboard gestione sessioni
- [ ] Rate limiting per login attempts
- [ ] Password strength indicator

### Nice to Have
- [ ] OAuth2 (Google, GitHub)
- [ ] Magic link login
- [ ] Remember device
- [ ] Suspicious login detection

---

## 🔄 Migrazione da Supabase Auth

Se hai già utenti con Supabase Auth, segui questi passaggi:

### 1. Backup Database
```bash
# Da Supabase Dashboard: Settings > Database > Backup
```

### 2. Migra Utenti

```sql
-- Copia utenti esistenti
INSERT INTO public.users (id, email, email_verified, password_hash, user_metadata, app_metadata, confirmed_at, created_at)
SELECT 
  id,
  email,
  email_confirmed_at IS NOT NULL,
  '***RESET_REQUIRED***', -- Gli utenti dovranno resettare la password
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  email_confirmed_at,
  created_at
FROM auth.users
ON CONFLICT (email) DO NOTHING;
```

### 3. Notifica Utenti

Invia email agli utenti esistenti informandoli che dovranno:
1. Usare il flow "Password dimenticata"
2. Creare una nuova password
3. Fare login con le nuove credenziali

### 4. Cleanup (Dopo test completi)

```sql
-- Solo dopo aver verificato che tutto funziona!
-- DROP TABLE auth.users CASCADE;
```

---

## 🆘 Troubleshooting

### Errore: "Missing Supabase environment variables"
**Soluzione**: Verifica `.env.local` e riavvia il server dev

### Errore: "Token non valido o scaduto"
**Soluzione**: Fai logout e login nuovamente

### Errore: "Cannot find module 'lib/auth'"
**Soluzione**: Verifica che tutti i file siano stati creati correttamente

### Errore: "relation 'public.users' does not exist"
**Soluzione**: Esegui gli script SQL su Supabase

### Errore: "Foreign key constraint violation"
**Soluzione**: Assicurati di aver eseguito gli script nell'ordine corretto

---

## 📚 Risorse

### Documentazione Progetto
- [MIGRAZIONE_AUTH.md](./MIGRAZIONE_AUTH.md) - Guida migrazione completa
- [MIGLIORAMENTI_PROGETTO.md](./MIGLIORAMENTI_PROGETTO.md) - Dettagli tecnici

### Documentazione Esterna
- [Next.js 15](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Best Practices
- [OWASP Auth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## 🤝 Supporto

Per problemi o domande:
1. Controlla la documentazione in `MIGRAZIONE_AUTH.md`
2. Verifica i log del browser (Console F12)
3. Controlla i log di Supabase
4. Verifica le variabili d'ambiente

---

## 📜 Changelog

### v2.0.0 (2026-02-05)
- ✨ Migrazione a autenticazione personalizzata
- ✨ Sistema di sessioni custom
- ✨ Audit log completo
- ✨ Password policy
- ✨ Reset password flow
- 🐛 Fix vari bug autenticazione
- 📚 Documentazione completa
- ⚡ Performance improvements
- 🔐 Security enhancements

### v1.0.0
- Initial release con Supabase Auth

---

## 📄 License

Proprietario - Cazzulo Denis / Bitora.it

---

**Made with ❤️ by Cazzulo Denis**
