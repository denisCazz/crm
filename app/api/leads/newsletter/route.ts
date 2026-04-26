import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

type NewsletterLeadPayload = {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string[];
};

const getCorsHeaders = (): HeadersInit => {
  const origin = process.env.LEADS_CORS_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
    ...(origin !== '*' ? { Vary: 'Origin' } : {}),
  };
};

const json = (status: number, body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isValidEmail = (email: string): boolean => {
  // Validazione minimale (sufficiente per input utente; non è RFC completa)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const uniqueStrings = (values: (string | null | undefined)[]): string[] => {
  const set = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    set.add(trimmed);
  }
  return Array.from(set);
};

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.LEADS_API_KEY;
  if (apiKey) {
    const provided = req.headers.get('x-api-key');
    if (!provided || provided !== apiKey) return json(401, { ok: false, error: 'Unauthorized' });
  }

  const ownerId = process.env.LEADS_OWNER_ID;
  if (!ownerId) {
    return json(500, { ok: false, error: 'Server misconfigured: missing LEADS_OWNER_ID' });
  }

  let payload: NewsletterLeadPayload;
  try {
    payload = (await req.json()) as NewsletterLeadPayload;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const emailRaw = typeof payload.email === 'string' ? payload.email : '';
  const email = normalizeEmail(emailRaw);
  if (!email || !isValidEmail(email)) {
    return json(400, { ok: false, error: 'Missing/invalid email' });
  }

  const first_name = typeof payload.first_name === 'string' ? payload.first_name.trim() : '';
  const last_name = typeof payload.last_name === 'string' ? payload.last_name.trim() : '';
  const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';

  const inputTags = Array.isArray(payload.tags) ? payload.tags : [];
  const tags = uniqueStrings(['newsletter', ...inputTags]);

  // Se esiste già (stesso owner + email), aggiorna senza creare duplicati.
  const existingRows = await dbQuery<any>(
    `SELECT id, first_name, last_name, phone, email, tags, notes
     FROM clients
     WHERE owner_id = :owner_id AND LOWER(email) = :email
     LIMIT 1`,
    { owner_id: ownerId, email }
  );
  const existing = existingRows[0]
    ? { ...existingRows[0], tags: existingRows[0].tags ? JSON.parse(existingRows[0].tags) : null }
    : null;

  if (existing?.id) {
    const mergedTags = uniqueStrings([...(existing.tags ?? []), ...tags]);
    const update: Record<string, unknown> = {
      lead_source: 'newsletter',
      tags: mergedTags.length > 0 ? mergedTags : null,
    };

    if (first_name && !existing.first_name) update.first_name = first_name;
    if (last_name && !existing.last_name) update.last_name = last_name;
    if (phone && !existing.phone) update.phone = phone;

    if (!existing.notes) {
      update.notes = 'Iscrizione newsletter';
    }

    await dbQuery(
      `UPDATE clients SET
        lead_source = 'newsletter',
        tags = :tags,
        first_name = COALESCE(NULLIF(:first_name,''), first_name),
        last_name = COALESCE(NULLIF(:last_name,''), last_name),
        phone = COALESCE(NULLIF(:phone,''), phone),
        notes = COALESCE(notes, :notes)
       WHERE id = :id AND owner_id = :owner_id`,
      {
        id: existing.id,
        owner_id: ownerId,
        tags: mergedTags.length > 0 ? JSON.stringify(mergedTags) : null,
        first_name,
        last_name,
        phone,
        notes: 'Iscrizione newsletter',
      }
    );
    return json(200, { ok: true, id: existing.id, existing: true });
  }

  const insert = {
    owner_id: ownerId,
    email,
    first_name: first_name || null,
    last_name: last_name || null,
    phone: phone || null,
    notes: 'Iscrizione newsletter',
    tags: tags.length > 0 ? tags : null,
    status: 'new',
    lead_source: 'newsletter',
  };

  const id = randomUUID();
  await dbQuery(
    `INSERT INTO clients (id, owner_id, email, first_name, last_name, phone, notes, tags, status, lead_source)
     VALUES (:id, :owner_id, :email, :first_name, :last_name, :phone, :notes, :tags, :status, :lead_source)`,
    {
      id,
      owner_id: insert.owner_id,
      email: insert.email,
      first_name: insert.first_name,
      last_name: insert.last_name,
      phone: insert.phone,
      notes: insert.notes,
      tags: insert.tags ? JSON.stringify(insert.tags) : null,
      status: insert.status,
      lead_source: insert.lead_source,
    }
  );

  return json(201, { ok: true, id, existing: false });
}
