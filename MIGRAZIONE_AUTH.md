# Migrazione da Supabase Auth a Autenticazione Personalizzata

## ✅ Completato

### 1. Sistema di Autenticazione Custom
- ✅ Schema database (`supabase/sql/auth_custom.sql`)
  - Tabella `users` con gestione password hash
  - Tabella `sessions` per token di sessione
  - Tabella `auth_audit_log` per tracciamento accessi
  - Funzioni helper `current_user_id()` e `is_current_user_admin()`

- ✅ Librerie autenticazione
  - `lib/auth.ts` - Funzioni server-side (signIn, signUp, reset password, ecc.)
  - `lib/authClient.ts` - Funzioni client-side
  - `lib/authHelpers.ts` - Helper per API routes

- ✅ API Routes
  - `/api/auth/signin` - Login
  - `/api/auth/signup` - Registrazione
  - `/api/auth/signout` - Logout
  - `/api/auth/session` - Verifica sessione
  - `/api/auth/user` - Get/Update utente
  - `/api/auth/reset-password` - Reset password
  - `/api/auth/reset-password/confirm` - Conferma reset

- ✅ Aggiornamento componenti principali
  - `components/LoginForm.tsx` - Usa nuova autenticazione
  - `app/page.tsx` - Gestione sessioni custom

- ✅ Aggiornamento API routes esistenti
  - `/api/settings/route.ts`
  - `/api/settings/apikey/route.ts`
  - `/api/users/route.ts`
  - `/api/email/send/route.ts`
  - `/api/email/newsletter/route.ts`

- ✅ SQL Scripts aggiornati
  - `setup_all.sql` - Usa `public.users` invece di `auth.users`
  - `licenses.sql` - Policy aggiornate con `current_user_id()`
  - Tutte le foreign keys ora puntano a `public.users(id)`

## 🔧 Da Completare Manualmente

### 1. Eseguire gli script SQL su Supabase

**IMPORTANTE**: Esegui gli script in questo ordine:

```sql
-- 1. Prima crea il nuovo schema di autenticazione
-- Esegui il file: supabase/sql/auth_custom.sql

-- 2. Migra gli utenti esistenti (OPZIONALE se hai già utenti)
-- Questo script copia gli utenti da auth.users a public.users
INSERT INTO public.users (id, email, email_verified, password_hash, user_metadata, app_metadata, confirmed_at, created_at)
SELECT 
  id,
  email,
  email_confirmed_at IS NOT NULL as email_verified,
  '***RESET_REQUIRED***' as password_hash, -- Gli utenti dovranno fare reset password
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  email_confirmed_at,
  created_at
FROM auth.users
ON CONFLICT (email) DO NOTHING;

-- 3. Aggiorna le tabelle esistenti
-- Esegui il file: supabase/sql/setup_all.sql
```

### 2. Migliorare la sicurezza delle password

**IMPORTANTE**: Il sistema attualmente usa SHA-256 per le password. Per produzione, sostituisci con bcrypt o argon2:

```bash
npm install bcrypt
npm install --save-dev @types/bcrypt
```

Poi aggiorna `lib/auth.ts`:

```typescript
import bcrypt from 'bcrypt';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
```

### 3. Configurare invio email per conferma e reset

Attualmente le email per conferma account e reset password non vengono inviate.

Opzioni:
1. Usa il sistema SMTP esistente (`lib/emailSender.ts`)
2. Integra servizio come SendGrid, Mailgun, o Resend
3. Usa AWS SES

Esempio di integrazione in `app/api/auth/signup/route.ts`:

```typescript
// Dopo aver creato l'utente
if (result.user && result.user.confirmation_token) {
  const confirmLink = `${process.env.NEXT_PUBLIC_SITE_URL}/confirm-email?token=${result.user.confirmation_token}`;
  
  await sendEmail({
    to: result.user.email,
    subject: 'Conferma il tuo account',
    html: `<p>Clicca qui per confermare: <a href="${confirmLink}">${confirmLink}</a></p>`,
  });
}
```

### 4. Componenti client-side da aggiornare (se esistono)

Se hai altre pagine che usano autenticazione, aggiornale seguendo questo pattern:

```typescript
// Prima (Supabase Auth)
import { useSupabase } from '../lib/supabase';
const supabase = useSupabase();
const { data: session } = await supabase.auth.getSession();

// Dopo (Auth personalizzata)
import { getStoredSession, verifySession } from '../lib/authClient';
const session = getStoredSession();
const result = await verifySession();
```

Pagine da verificare:
- `app/profilo/page.tsx`
- `app/impostazioni/page.tsx`
- `app/admin/page.tsx`
- `app/email/_components/EmailGate.tsx`
- `app/reset-password/page.tsx`
- Altri componenti che usano `supabase.auth`

### 5. Variabili d'ambiente

Aggiungi al tuo `.env.local`:

```bash
# Esistenti
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Nuove (opzionali)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SESSION_SECRET=your-long-random-secret-key-here
```

## 📝 Miglioramenti Implementati

### Sicurezza
- ✅ Hash password (da migliorare con bcrypt)
- ✅ Token di sessione sicuri (32 bytes random)
- ✅ Scadenza sessioni (30 giorni configurabile)
- ✅ Audit log per tracciamento accessi
- ✅ Rate limiting già presente nel middleware

### Performance
- ✅ Caching brand settings (evita chiamate ripetute)
- ✅ Singleton pattern per Supabase client
- ✅ Sessioni salvate in localStorage (riduce chiamate API)

### UX
- ✅ Gestione errori migliorata
- ✅ Toast notifications per feedback
- ✅ Validazione password (minimo 8 caratteri)
- ✅ Reset password con token sicuro

## 🚀 Testing

### 1. Test locale

```bash
npm install
npm run dev
```

### 2. Test flow completo

1. **Registrazione**: Vai su `/` e registra un nuovo utente
2. **Login**: Fai login con le credenziali
3. **Verifica sessione**: Ricarica la pagina, dovresti rimanere loggato
4. **Reset password**: Testa il flow di reset (in dev mode, il token viene restituito nell'API)
5. **Logout**: Fai logout e verifica che la sessione venga eliminata

### 3. Test API

Usa tools come Postman o curl:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Verifica sessione
curl http://localhost:3000/api/auth/session \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get user
curl http://localhost:3000/api/auth/user \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔄 Rollback (se necessario)

Se vuoi tornare a Supabase Auth:

1. Ripristina i file originali da git
2. Le tabelle `users`, `sessions`, `auth_audit_log` possono essere eliminate
3. Ripristina le foreign keys verso `auth.users`

## 📚 Note Aggiuntive

### Differenze principali

| Supabase Auth | Auth Personalizzata |
|---------------|---------------------|
| `auth.users` | `public.users` |
| `supabase.auth.signInWithPassword()` | `signIn(email, password)` |
| `supabase.auth.getSession()` | `verifySession()` |
| `auth.uid()` | `public.current_user_id()` |
| JWT automatico | Token custom in sessions |

### Vantaggi della migrazione

✅ **Controllo totale**: Gestisci completamente l'autenticazione
✅ **Flessibilità**: Puoi customizzare ogni aspetto
✅ **Trasparenza**: Codice più leggibile e manutenibile
✅ **Portabilità**: Meno dipendenza da Supabase
✅ **Audit**: Log completo di tutti gli accessi

### Svantaggi/Considerazioni

⚠️ **Manutenzione**: Più codice da mantenere
⚠️ **Sicurezza**: Devi gestire tu la sicurezza (usa bcrypt!)
⚠️ **Email**: Devi implementare l'invio email
⚠️ **OAuth**: Dovrai implementare OAuth manualmente se serve

## 🆘 Supporto

In caso di problemi:
1. Controlla i log del browser (F12 > Console)
2. Controlla i log di Supabase (Dashboard > Logs)
3. Verifica che tutte le tabelle siano create correttamente
4. Verifica che le variabili d'ambiente siano configurate

## ✨ Next Steps

1. [ ] Eseguire script SQL su Supabase
2. [ ] Testare registrazione e login
3. [ ] Implementare invio email
4. [ ] Aggiornare password hashing con bcrypt
5. [ ] Aggiornare componenti client-side rimanenti
6. [ ] Test completo di tutti i flow
7. [ ] Deploy in produzione
