import { getServiceSupabaseClient } from '@/lib/supabaseServer';

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

  const supabase = getServiceSupabaseClient();

  // Se esiste già (stesso owner + email), aggiorna senza creare duplicati.
  const { data: existing, error: existingError } = await supabase
    .from('clients')
    .select('id, first_name, last_name, phone, email, tags, notes')
    .eq('owner_id', ownerId)
    .ilike('email', email)
    .maybeSingle();

  if (existingError) {
    return json(500, { ok: false, error: existingError.message });
  }

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

    const { error: updateError } = await supabase
      .from('clients')
      .update(update)
      .eq('id', existing.id)
      .eq('owner_id', ownerId);

    if (updateError) return json(500, { ok: false, error: updateError.message });
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

  const { data: created, error: createError } = await supabase
    .from('clients')
    .insert(insert)
    .select('id')
    .single();

  if (createError) return json(500, { ok: false, error: createError.message });
  return json(201, { ok: true, id: created.id, existing: false });
}
