import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as any;

    const update: Record<string, any> = {
      first_name: body?.first_name ?? null,
      last_name: body?.last_name ?? null,
      address: body?.address ?? null,
      notes: body?.notes ?? null,
      phone: body?.phone ?? null,
      email: body?.email ?? null,
      tags: body?.tags ? JSON.stringify(body.tags) : null,
    };

    await dbQuery(
      `UPDATE clients SET
        first_name = :first_name,
        last_name = :last_name,
        address = :address,
        notes = :notes,
        phone = :phone,
        email = :email,
        tags = :tags
       WHERE id = :id AND owner_id = :owner_id`,
      { ...update, id, owner_id: user.id }
    );

    const rows = await dbQuery<any>(
      `SELECT id, owner_id, first_name, last_name, address, notes, phone, email, tags, status, first_contacted_at, lat, lon, created_at
       FROM clients WHERE id = :id AND owner_id = :owner_id LIMIT 1`,
      { id, owner_id: user.id }
    );
    const c = rows[0];
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      client: {
        ...c,
        tags: c.tags ? JSON.parse(c.tags) : null,
        first_contacted_at: c.first_contacted_at ? new Date(c.first_contacted_at).toISOString() : null,
        created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const req = _req;
    const user = await requireAuth(req);
    const { id } = await ctx.params;

    await dbQuery(`DELETE FROM clients WHERE id = :id AND owner_id = :owner_id`, { id, owner_id: user.id });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

