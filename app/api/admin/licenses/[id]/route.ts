import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, ADMIN_EMAILS);
    const { id } = await params;
    const body = (await req.json()) as {
      status?: string;
      plan?: string;
      expires_at?: string | null;
      metadata?: Record<string, unknown> | null;
    };

    const rows = await dbQuery<any>('SELECT id FROM licenses WHERE id = :id', { id });
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sets: string[] = ['updated_at = :now'];
    const p: Record<string, unknown> = { id, now: new Date() };

    if (body.status !== undefined) { sets.push('status = :status'); p.status = body.status; }
    if (body.plan !== undefined) { sets.push('plan = :plan'); p.plan = body.plan?.trim() || null; }
    if ('expires_at' in body) { sets.push('expires_at = :expires_at'); p.expires_at = body.expires_at ? new Date(body.expires_at) : null; }
    if ('metadata' in body) { sets.push('metadata = :metadata'); p.metadata = body.metadata ? JSON.stringify(body.metadata) : null; }

    await dbQuery(`UPDATE licenses SET ${sets.join(', ')} WHERE id = :id`, p);

    const updated = await dbQuery<any>('SELECT id, user_id, status, plan, expires_at, created_at, updated_at FROM licenses WHERE id = :id', { id });
    const lic = updated[0];
    return NextResponse.json({
      license: {
        ...lic,
        expires_at: lic.expires_at ? new Date(lic.expires_at).toISOString() : null,
        created_at: lic.created_at ? new Date(lic.created_at).toISOString() : null,
        updated_at: lic.updated_at ? new Date(lic.updated_at).toISOString() : null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, ADMIN_EMAILS);
    const { id } = await params;

    await dbQuery('DELETE FROM licenses WHERE id = :id', { id });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
