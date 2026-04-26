# Bitora CRM — Documentazione API REST

> **Versione**: 1.0  
> **Base URL**: `https://your-domain.com/api`  
> **Formato**: JSON  
> **Encoding**: UTF-8

---

## Autenticazione

Le API supportano **due metodi di autenticazione**. Ogni richiesta deve includerne uno.

### 1. Bearer Token (sessioni utente)

Utilizzato dall'applicazione web. Il token viene rilasciato al login.

```http
Authorization: Bearer <session_token>
```

### 2. API Key (integrazioni esterne)

Generata dalla pagina **Impostazioni → API Key**. Formato: `bcrm_<32 hex chars>`.

```http
X-API-Key: bcrm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Oppure come query parameter (sconsigliato per motivi di sicurezza nei log):

```
GET /api/clients?api_key=bcrm_xxxx
```

> **Nota**: L'API key ha gli stessi permessi del proprietario. Non condividerla. Revocabile in qualsiasi momento dalle Impostazioni.

---

## Risposte

Tutte le risposte sono in formato JSON.

### Risposta di successo

```json
{ "clients": [...] }        // o "client", "document", "deadline", ecc.
```

### Risposta di errore

```json
{
  "error": "Messaggio descrittivo dell'errore"
}
```

### Codici HTTP

| Codice | Significato |
|--------|-------------|
| `200`  | Successo |
| `201`  | Risorsa creata |
| `400`  | Richiesta non valida (body malformato, campo mancante) |
| `401`  | Non autenticato (token o API key mancante/non valido) |
| `403`  | Non autorizzato (permessi insufficienti) |
| `404`  | Risorsa non trovata |
| `500`  | Errore interno del server |

---

## Clienti

### `GET /api/clients`

Restituisce tutti i clienti dell'utente autenticato.

**Risposta**

```json
{
  "clients": [
    {
      "id": "uuid",
      "owner_id": "uuid",
      "first_name": "Mario",
      "last_name": "Rossi",
      "email": "mario.rossi@example.com",
      "phone": "+39 333 1234567",
      "address": "Via Roma 1, Milano",
      "notes": "Note libere",
      "tags": ["vip", "prospect"],
      "status": "new",
      "first_contacted_at": "2024-01-15T10:00:00.000Z",
      "lat": 45.4654219,
      "lon": 9.1859243,
      "created_at": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/clients`

Crea un nuovo cliente.

**Body**

```json
{
  "first_name": "Mario",
  "last_name": "Rossi",
  "email": "mario.rossi@example.com",
  "phone": "+39 333 1234567",
  "address": "Via Roma 1, Milano",
  "notes": "Cliente proveniente da referral",
  "tags": ["vip"],
  "status": "new",
  "first_contacted_at": "2024-01-15T10:00:00Z",
  "lat": 45.4654219,
  "lon": 9.1859243
}
```

Tutti i campi sono opzionali. `status` default: `"new"`.

**Risposta** `201`

```json
{
  "client": { ...campi cliente... }
}
```

---

### `PATCH /api/clients/:id`

Aggiorna un cliente esistente. Solo i campi inviati vengono sovrascritti.

**Body** — stessi campi di `POST /api/clients`.

**Risposta** `200`

```json
{
  "client": { ...campi cliente aggiornati... }
}
```

---

### `DELETE /api/clients/:id`

Elimina un cliente.

**Risposta** `200`

```json
{ "ok": true }
```

---

## Documenti

### `GET /api/documents`

Elenca i documenti dell'utente. Supporta filtri via query string.

**Query params**

| Param | Valori | Default |
|-------|--------|---------|
| `status` | `active`, `archived`, `deleted`, `all` | `active` |
| `client_id` | UUID cliente | — |
| `doc_type` | `contratto`, `fattura`, `preventivo`, `documento_identita`, `altro` | — |

**Risposta**

```json
{
  "documents": [
    {
      "id": "uuid",
      "owner_id": "uuid",
      "client_id": "uuid",
      "title": "Contratto 2024",
      "description": "Contratto annuale di manutenzione",
      "doc_type": "contratto",
      "status": "active",
      "file_name": "contratto-2024.pdf",
      "mime_type": "application/pdf",
      "file_size": 204800,
      "s3_key": "uuid/contratto-2024.pdf",
      "doc_date": "2024-01-01T00:00:00.000Z",
      "expires_at": "2025-01-01T00:00:00.000Z",
      "tags": [],
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z",
      "client_first_name": "Mario",
      "client_last_name": "Rossi"
    }
  ]
}
```

---

### `POST /api/documents/upload`

Carica un nuovo documento (multipart/form-data).

**Body** — `multipart/form-data`

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:---:|-------------|
| `file` | File | ✓ | Il file da caricare |
| `title` | string | ✓ | Titolo del documento |
| `doc_type` | string | | Tipo documento |
| `description` | string | | Descrizione libera |
| `client_id` | UUID | | Cliente associato |
| `doc_date` | ISO date | | Data del documento |
| `expires_at` | ISO date | | Data di scadenza |

**Esempio cURL**

```bash
curl -X POST https://your-domain.com/api/documents/upload \
  -H "X-API-Key: bcrm_xxxx" \
  -F "file=@contratto.pdf" \
  -F "title=Contratto Mario Rossi 2024" \
  -F "doc_type=contratto" \
  -F "client_id=uuid-cliente"
```

**Risposta** `201`

```json
{
  "document": { ...campi documento... }
}
```

---

### `GET /api/documents/:id`

Recupera un singolo documento.

---

### `PATCH /api/documents/:id`

Aggiorna metadati di un documento (non il file).

**Body**

```json
{
  "title": "Nuovo titolo",
  "description": "Aggiornato",
  "doc_type": "fattura",
  "status": "archived",
  "client_id": "uuid",
  "doc_date": "2024-03-01",
  "expires_at": "2025-03-01",
  "tags": ["urgente"]
}
```

---

### `DELETE /api/documents/:id`

Archivia il documento (soft delete, `status = 'deleted'`).

---

### `GET /api/documents/:id/download`

Genera un URL pre-firmato (presigned URL) per il download diretto dall'object storage.

**Risposta**

```json
{
  "url": "https://s3.example.com/...",
  "file_name": "contratto.pdf",
  "expires_in": 3600
}
```

---

## Scadenze

### `GET /api/deadlines`

Elenca le scadenze.

**Query params**

| Param | Valori |
|-------|--------|
| `status` | `open`, `done`, `overdue`, `cancelled`, `all` |
| `client_id` | UUID |
| `document_id` | UUID |

**Risposta**

```json
{
  "deadlines": [
    {
      "id": "uuid",
      "owner_id": "uuid",
      "client_id": "uuid",
      "document_id": "uuid",
      "title": "Rinnovo contratto",
      "description": "Verificare clausole prima del rinnovo",
      "due_at": "2025-03-15T00:00:00.000Z",
      "priority": "high",
      "status": "open",
      "reminder_at": "2025-03-08T09:00:00.000Z",
      "completed_at": null,
      "created_at": "2024-12-01T10:00:00.000Z",
      "client_first_name": "Mario",
      "client_last_name": "Rossi",
      "document_title": "Contratto 2024"
    }
  ]
}
```

---

### `POST /api/deadlines`

Crea una scadenza.

**Body**

```json
{
  "title": "Rinnovo contratto",
  "description": "Verificare clausole",
  "due_at": "2025-03-15T00:00:00Z",
  "priority": "high",
  "client_id": "uuid",
  "document_id": "uuid",
  "reminder_at": "2025-03-08T09:00:00Z"
}
```

`priority`: `low` | `normal` | `high` | `urgent` (default: `normal`)

---

### `PATCH /api/deadlines/:id`

Aggiorna una scadenza. Per segnare come completata:

```json
{ "status": "done" }
```

`completed_at` viene impostato automaticamente.

---

### `DELETE /api/deadlines/:id`

Elimina una scadenza.

---

## Email Templates

### `GET /api/email/templates`

Lista i template email dell'utente.

**Risposta**

```json
{
  "templates": [
    {
      "id": "uuid",
      "owner_id": "uuid",
      "name": "Benvenuto",
      "subject": "Benvenuto in {{brand_name}}!",
      "body": "Caro {{first_name}}, ...",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Variabili template disponibili**: `{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{brand_name}}`

---

### `POST /api/email/templates`

Crea un nuovo template.

```json
{
  "name": "Follow-up",
  "subject": "Come stai, {{first_name}}?",
  "body": "Ciao {{first_name}}, volevo aggiornarti su..."
}
```

---

### `PATCH /api/email/templates/:id`

Aggiorna un template.

---

### `DELETE /api/email/templates/:id`

Elimina un template.

---

## Autenticazione (Auth)

### `POST /api/auth/signin`

Login con email e password.

**Body**

```json
{
  "email": "mario@example.com",
  "password": "la-mia-password"
}
```

**Risposta**

```json
{
  "user": { ...dati utente... },
  "session": {
    "token": "abc123...",
    "refresh_token": "xyz789...",
    "expires_at": "2025-05-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/auth/signup`

Registra un nuovo utente.

**Body**

```json
{
  "email": "nuovo@example.com",
  "password": "password-sicura",
  "first_name": "Mario",
  "last_name": "Rossi"
}
```

---

### `POST /api/auth/signout`

Invalida la sessione corrente. Richiede autenticazione Bearer.

---

### `GET /api/auth/session`

Verifica se il token è valido e restituisce l'utente corrente.

---

## Impostazioni

### `GET /api/settings`

Recupera le impostazioni dell'account (brand, email SMTP, API key mascherata).

### `PATCH /api/settings`

Aggiorna le impostazioni.

```json
{
  "brand_name": "La Mia Azienda",
  "logo_url": "https://example.com/logo.png",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "no-reply@example.com",
  "smtp_pass": "app-password",
  "smtp_from": "no-reply@example.com"
}
```

### `POST /api/settings/apikey`

Genera una nuova API key (invalida la precedente).

**Risposta**

```json
{
  "success": true,
  "api_key": "bcrm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### `DELETE /api/settings/apikey`

Revoca l'API key corrente.

---

## Licenza

### `GET /api/licenses/me`

Restituisce lo stato della licenza dell'utente corrente.

**Risposta**

```json
{
  "license": {
    "id": "uuid",
    "user_id": "uuid",
    "plan": "pro",
    "status": "active",
    "expires_at": "2026-01-01T00:00:00.000Z",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## Esempi di integrazione

### Aggiungere un cliente da un form esterno

```bash
curl -X POST https://your-domain.com/api/clients \
  -H "Content-Type: application/json" \
  -H "X-API-Key: bcrm_xxxx" \
  -d '{
    "first_name": "Anna",
    "last_name": "Verdi",
    "email": "anna.verdi@example.com",
    "phone": "+39 02 1234567",
    "tags": ["lead", "sito-web"]
  }'
```

### Caricare un documento da script Python

```python
import requests

API_KEY = "bcrm_xxxx"
BASE_URL = "https://your-domain.com/api"

with open("contratto.pdf", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/documents/upload",
        headers={"X-API-Key": API_KEY},
        files={"file": ("contratto.pdf", f, "application/pdf")},
        data={
            "title": "Contratto Anno 2025",
            "doc_type": "contratto",
        }
    )
    print(response.json())
```

### Creare una scadenza collegata a un documento

```javascript
const response = await fetch("https://your-domain.com/api/deadlines", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "bcrm_xxxx",
  },
  body: JSON.stringify({
    title: "Rinnovo contratto Mario Rossi",
    due_at: "2025-12-31T00:00:00Z",
    priority: "high",
    client_id: "uuid-del-cliente",
    document_id: "uuid-del-documento",
    reminder_at: "2025-12-24T09:00:00Z",
  }),
});
const { deadline } = await response.json();
```

---

## Sicurezza

- Tutte le comunicazioni devono avvenire tramite **HTTPS**.
- Le API key hanno la stessa portata dei permessi dell'utente proprietario.
- Le sessioni scadono dopo **30 giorni** di inattività.
- I dati sono isolati per `owner_id`: un utente non può mai accedere ai dati di un altro.
- Le API key possono essere revocate istantaneamente da **Impostazioni**.

---

## Rate Limiting

Attualmente non è applicato un rate limiting lato server. Si consiglia di non superare **60 richieste/minuto** per utente per evitare problemi di carico sul database.

---

*Documentazione generata per Bitora CRM — [bitora.it](https://bitora.it)*
