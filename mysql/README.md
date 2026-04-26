# Bitora CRM – Database & Setup Guide

## Database

MySQL 8+ · Host `212.227.193.249` · Port `60000` · Database `crm_bitora`

### Schema setup

Run the two SQL files in order:

```bash
# 1. Core tables (users, sessions, licenses, clients, email, settings)
mysql -h 212.227.193.249 -P 60000 -u crm_user -p crm_bitora < mysql/schema.sql

# 2. Document management + deadlines + AI extensions
mysql -h 212.227.193.249 -P 60000 -u crm_user -p crm_bitora < mysql/schema_documents.sql
```

### Tables

| Table | Purpose |
|---|---|
| `users` | Custom auth users (email + password hash) |
| `sessions` | Active user sessions (token-based) |
| `auth_audit_log` | Login/signup/logout events |
| `licenses` | Per-user license records |
| `clients` | CRM clients linked to an owner user |
| `app_settings` | Per-user branding + SMTP config |
| `email_templates` | Reusable HTML email templates |
| `email_sends` | Log of sent emails |
| `documents` | Document metadata (file stored on S3) |
| `document_versions` | Version history per document |
| `document_events` | Audit timeline for documents |
| `document_ai_chunks` | Extracted text chunks for embedding |
| `document_ai_embeddings` | OpenAI embedding vectors (JSON) |
| `deadlines` | Scadenziari linked to clients/documents |

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```env
# MySQL
MYSQL_HOST=212.227.193.249
MYSQL_PORT=60000
MYSQL_USER=crm_user
MYSQL_PASSWORD=your_password
MYSQL_DB=crm_bitora

# Admin emails (comma-separated, server and browser)
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com
ADMIN_EMAILS=admin@example.com

# S3-compatible storage (required for document uploads)
S3_ENDPOINT=https://s3.amazonaws.com   # or MinIO/R2/B2 endpoint
S3_REGION=eu-west-1
S3_BUCKET=crm-bitora-docs
S3_ACCESS_KEY_ID=your_key_id
S3_SECRET_ACCESS_KEY=your_secret
S3_PUBLIC_BASE_URL=                    # optional public CDN base URL

# AI – OpenAI (optional)
OPENAI_API_KEY=                        # leave empty to keep AI disabled
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
AI_INDEXING_ENABLED=false              # set true to activate
```

---

## Features

### CRM (Clienti)
- Create, edit, delete clients
- Quick search and filters (email, phone, tags)
- Map view, notes, lead source tracking

### Documenti
- Upload any file to S3-compatible storage
- Metadata: title, type, client link, doc date, expiry date
- Filters: client, doc type, status, text search
- Presigned download URLs (1 hour expiry)
- Soft delete (archived status)

### Scadenze
- Create deadlines linked to clients or documents
- Priorities: low, normal, high, urgent
- Status: open, done, overdue, cancelled
- KPI dashboard: today / this week / overdue / done
- One-click complete with timestamp

### Email
- Single email via API to individual contacts
- Mass newsletter via BCC to all clients with email
- Reusable HTML templates with `{{first_name}}` variables

### AI (predisposed, off by default)
Activate with `AI_INDEXING_ENABLED=true` + `OPENAI_API_KEY`.

| Endpoint | Purpose |
|---|---|
| `POST /api/ai/documents/index` | Index document text chunks as embeddings |
| `POST /api/ai/documents/search` | Semantic search across indexed documents |
| `POST /api/ai/deadlines/suggest` | Future: suggest deadlines from document text |

For small datasets, similarity is computed applicatively (cosine). For larger corpora, adapt the `searchSimilarDocuments()` function in `lib/ai.ts` to use a vector database (Pinecone, Qdrant, MySQL HeatWave, etc.).

---

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

Node.js 20+ LTS recommended.
