import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

type ContactLeadPayload = {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  message?: string;
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

  let payload: ContactLeadPayload;
  try {
    payload = (await req.json()) as ContactLeadPayload;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const first_name = typeof payload.first_name === 'string' ? payload.first_name.trim() : '';
  const last_name = typeof payload.last_name === 'string' ? payload.last_name.trim() : '';
  const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (!message) {
    return json(400, { ok: false, error: 'Missing message' });
  }

  let email: string | null = null;
  if (typeof payload.email === 'string' && payload.email.trim()) {
    const normalized = normalizeEmail(payload.email);
    if (!isValidEmail(normalized)) {
      return json(400, { ok: false, error: 'Invalid email' });
    }
    email = normalized;
  }

  if (!email && !phone) {
    return json(400, { ok: false, error: 'Provide at least email or phone' });
  }

  const inputTags = Array.isArray(payload.tags) ? payload.tags : [];
  const tags = uniqueStrings(['contact', ...inputTags]);

  // Cerca un record esistente per evitare duplicati.
  // Priorità: email, poi telefono.
  let existing:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        tags: string[] | null;
        notes: string | null;
      }
    | null
    | undefined = null;

  if (email) {
    const rows = await dbQuery<any>(
      `SELECT id, first_name, last_name, phone, email, tags, notes
       FROM clients
       WHERE owner_id = :owner_id AND LOWER(email) = :email
       LIMIT 1`,
      { owner_id: ownerId, email }
    );
    existing = rows[0] ? { ...rows[0], tags: rows[0].tags ? JSON.parse(rows[0].tags) : null } : null;
  } else if (phone) {
    const rows = await dbQuery<any>(
      `SELECT id, first_name, last_name, phone, email, tags, notes
       FROM clients
       WHERE owner_id = :owner_id AND phone = :phone
       LIMIT 1`,
      { owner_id: ownerId, phone }
    );
    existing = rows[0] ? { ...rows[0], tags: rows[0].tags ? JSON.parse(rows[0].tags) : null } : null;
  }

  if (existing?.id) {
    const mergedTags = uniqueStrings([...(existing.tags ?? []), ...tags]);

    const update: Record<string, unknown> = {
      lead_source: 'contact',
      contact_request: message,
      tags: mergedTags.length > 0 ? mergedTags : null,
      notes: message,
    };

    if (first_name && !existing.first_name) update.first_name = first_name;
    if (last_name && !existing.last_name) update.last_name = last_name;
    if (phone && !existing.phone) update.phone = phone;
    if (email && !existing.email) update.email = email;

    await dbQuery(
      `UPDATE clients SET
        lead_source = :lead_source,
        contact_request = :contact_request,
        tags = :tags,
        notes = :notes,
        first_name = COALESCE(NULLIF(:first_name, ''), first_name),
        last_name = COALESCE(NULLIF(:last_name, ''), last_name),
        phone = COALESCE(NULLIF(:phone, ''), phone),
        email = COALESCE(:email, email)
       WHERE id = :id AND owner_id = :owner_id`,
      {
        id: existing.id,
        owner_id: ownerId,
        lead_source: 'contact',
        contact_request: message,
        tags: mergedTags.length > 0 ? JSON.stringify(mergedTags) : null,
        notes: message,
        first_name,
        last_name,
        phone,
        email,
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
    notes: message,
    tags: tags.length > 0 ? tags : null,
    status: 'new',
    lead_source: 'contact',
    contact_request: message,
  };

  const id = randomUUID();
  await dbQuery(
    `INSERT INTO clients (id, owner_id, email, first_name, last_name, phone, notes, tags, status, lead_source, contact_request)
     VALUES (:id, :owner_id, :email, :first_name, :last_name, :phone, :notes, :tags, :status, :lead_source, :contact_request)`,
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
      contact_request: insert.contact_request,
    }
  );

  return json(201, { ok: true, id, existing: false });
}
