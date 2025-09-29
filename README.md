## Bitora CRM

Mini CRM costruito con Next.js App Router e Supabase. Gestisce clienti, tags, note e mappa geolocalizzata. L&apos;accesso alla dashboard è protetto da licenze associate agli utenti Supabase.

## Requisiti

- Node.js 18+
- Account e progetto [Supabase](https://supabase.com/)
- Variabili ambiente in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com,ceo@example.com
```

## Avvio locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) e accedi con un utente Supabase che possiede una licenza attiva.

## Setup Supabase

Nel repository trovi lo script `supabase/sql/licenses.sql` che crea le tabelle `licenses` e `admin_users`, i trigger e le policy RLS suggerite. Eseguilo dal SQL Editor di Supabase o tramite CLI prima di avviare l&apos;applicazione.

Lo script assume l&apos;esistenza della tabella `public.clients` con la colonna `owner_id` che punta a `auth.users.id`.

## Modello dati licenze

La schermata principale ora è disponibile solo a chi possiede una licenza attiva. Crea una tabella `licenses` su Supabase con la seguente struttura minima:

| Colonna      | Tipo                 | Note                                         |
|--------------|----------------------|----------------------------------------------|
| `id`         | `uuid`               | PK, `default uuid_generate_v4()`             |
| `user_id`    | `uuid`               | FK verso `auth.users.id`                     |
| `status`     | `text`               | Valori consigliati: `active`, `trial`, `inactive`, `expired` |
| `expires_at` | `timestamptz`        | `NULL` per licenze senza scadenza            |
| `plan`       | `text` (opzionale)   | Nome piano, opzionale                        |
| `created_at` | `timestamptz`        | `default now()`                              |
| `updated_at` | `timestamptz`        | Aggiornato via trigger opzionale             |
| `metadata`   | `jsonb` (opzionale)  | Informazioni aggiuntive                      |

La logica lato client considera valida una licenza quando:

- lo `status` è `active` oppure `trial`
- `expires_at` è nullo oppure nel futuro

Se non esiste alcuna riga per l&apos;utente, oppure lo `status` è `inactive`/`expired` o la data è passata, l&apos;app mostra una schermata di blocco con istruzioni e il pulsante di logout.

### Query di esempio per assegnare una licenza

```sql
insert into public.licenses (user_id, status, expires_at, plan)
values ('<user-uuid>', 'active', now() + interval '1 year', 'crm-pro');
```

### Politiche RLS

Lo script `supabase/sql/licenses.sql` abilita Row Level Security e definisce le seguenti regole:

- Gli utenti possono leggere solo la propria licenza.
- Gli admin (presenti nella tabella `admin_users`) possono creare, aggiornare e revocare qualsiasi licenza.
- La manutenzione della tabella `admin_users` è riservata al ruolo di servizio.

Se preferisci un approccio diverso, adatta le policy alle tue esigenze mantenendo i permessi della dashboard amministrativa.

## Area amministrativa `/admin`

È disponibile una pagina dedicata agli amministratori per:

- consultare i clienti registrati e lo stato della licenza associata;
- creare, modificare e revocare licenze;
- visualizzare statistiche aggregate su clienti e licenze.

L&apos;accesso è consentito a:

- account con email presente in `NEXT_PUBLIC_ADMIN_EMAILS` (lista separata da virgole);
- oppure utenti Supabase con `user_metadata.is_admin = true` o `app_metadata.role = 'admin'`;
- oppure utenti registrati nella tabella `public.admin_users` (gestita via SQL/script).

Per assegnare rapidamente un amministratore:

```sql
insert into public.admin_users (user_id)
values ('<user-uuid>');
```

> Nota: assicurati che l&apos;utente admin disponga di un account Supabase attivo e abbia già confermato l&apos;email.

### Operazioni supportate

- **Creazione licenza**: specifica `user_id`, stato iniziale, eventuale piano e data di scadenza.
- **Modifica**: seleziona una licenza dalla tabella e aggiorna i campi; il form si compila automaticamente.
- **Revoca**: imposta lo stato a `inactive` e azzera la scadenza. Puoi riattivarla dal form.

Per evitare errori nelle date, il form accetta valori `datetime-local` e converte automaticamente l&apos;orario in UTC.

## Test & lint

```bash
npm run lint
```

## Deploy

Il progetto è compatibile con Vercel. Assicurati di impostare le variabili ambiente e, se necessario, una chiave di servizio Supabase per le funzioni API/serverless.
