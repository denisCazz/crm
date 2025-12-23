# Setup recupero password (Supabase)

## 1) Cosa è stato aggiunto in app
- Link "Password dimenticata?" nel form di login.
- Pagina ` /reset-password ` che:
  - accetta link di recovery Supabase (sia flow con `#access_token` che flow con `?code=`)
  - permette di impostare una nuova password

## 2) Configurazioni richieste in Supabase
Nel progetto Supabase:

1. **Authentication → URL Configuration**
   - Site URL: `https://[TUO-DOMINIO]`
   - Redirect URLs (aggiungi):
     - `https://[TUO-DOMINIO]/reset-password`
     - `http://localhost:3000/reset-password`

2. **Authentication → Email Templates**
   - Template "Reset Password" (o "Recovery") deve includere `{{ .ConfirmationURL }}`.

## 3) Come funziona per l’utente
1. Inserisce la mail nel login
2. Clicca "Password dimenticata?"
3. Riceve una mail di recupero
4. Apre il link → atterra su `/reset-password` → imposta nuova password
