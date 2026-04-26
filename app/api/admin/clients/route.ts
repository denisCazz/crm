import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function GET(req: Request) {
  try {
    await requireAdmin(req, ADMIN_EMAILS);

    const rows = await dbQuery<any>(
      `SELECT id, owner_id, first_name, last_name, email, phone, address, notes, tags, status,
              first_contacted_at, lat, lon, lead_source, contact_request, created_at, updated_at
       FROM clients
       ORDER BY created_at DESC`,
      []
    );

    const clients = rows.map((r) => ({
      ...r,
      tags: r.tags && typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags ?? []),
      first_contacted_at: r.first_contacted_at ? new Date(r.first_contacted_at).toISOString() : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));

    return NextResponse.json({ clients });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
