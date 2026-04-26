import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);

    const rows = await dbQuery<any>(
      `SELECT id, owner_id, first_name, last_name, address, notes, phone, email, tags, status, first_contacted_at, lat, lon, created_at
       FROM clients
       WHERE owner_id = :owner_id
       ORDER BY created_at DESC`,
      { owner_id: user.id }
    );

    const clients = rows.map((r) => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : null,
      first_contacted_at: r.first_contacted_at ? new Date(r.first_contacted_at).toISOString() : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));

    return NextResponse.json({ clients });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => null) as any;

    const id = randomUUID();
    await dbQuery(
      `INSERT INTO clients (id, owner_id, first_name, last_name, address, notes, phone, email, tags, status, first_contacted_at, lat, lon)
       VALUES (:id, :owner_id, :first_name, :last_name, :address, :notes, :phone, :email, :tags, :status, :first_contacted_at, :lat, :lon)`,
      {
        id,
        owner_id: user.id,
        first_name: body?.first_name ?? null,
        last_name: body?.last_name ?? null,
        address: body?.address ?? null,
        notes: body?.notes ?? null,
        phone: body?.phone ?? null,
        email: body?.email ?? null,
        tags: body?.tags ? JSON.stringify(body.tags) : null,
        status: body?.status ?? 'new',
        first_contacted_at: body?.first_contacted_at ? new Date(body.first_contacted_at).toISOString().slice(0, 23).replace('T', ' ') : null,
        lat: body?.lat ?? null,
        lon: body?.lon ?? null,
      }
    );

    const created = await dbQuery<any>(
      `SELECT id, owner_id, first_name, last_name, address, notes, phone, email, tags, status, first_contacted_at, lat, lon, created_at
       FROM clients WHERE id = :id AND owner_id = :owner_id LIMIT 1`,
      { id, owner_id: user.id }
    );

    const c = created[0];
    return NextResponse.json({
      client: {
        ...c,
        tags: c?.tags ? JSON.parse(c.tags) : null,
        first_contacted_at: c?.first_contacted_at ? new Date(c.first_contacted_at).toISOString() : null,
        created_at: c?.created_at ? new Date(c.created_at).toISOString() : null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

