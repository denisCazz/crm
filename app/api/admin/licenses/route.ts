import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function GET(req: Request) {
  try {
    await requireAdmin(req, ADMIN_EMAILS);

    const rows = await dbQuery<any>(
      `SELECT id, user_id, status, plan, expires_at, metadata, created_at, updated_at
       FROM licenses
       ORDER BY created_at DESC`,
      []
    );

    const licenses = rows.map((r) => ({
      ...r,
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      metadata: r.metadata && typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? null),
    }));

    return NextResponse.json({ licenses });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req, ADMIN_EMAILS);
    const body = (await req.json()) as {
      user_id?: string;
      status?: string;
      plan?: string;
      expires_at?: string | null;
      metadata?: Record<string, unknown> | null;
    };

    if (!body.user_id?.trim()) {
      return NextResponse.json({ error: 'user_id è obbligatorio' }, { status: 400 });
    }

    const id = randomUUID();
    const now = new Date();
    await dbQuery(
      `INSERT INTO licenses (id, user_id, status, plan, expires_at, metadata, created_at, updated_at)
       VALUES (:id, :user_id, :status, :plan, :expires_at, :metadata, :now, :now)`,
      {
        id,
        user_id: body.user_id.trim(),
        status: body.status ?? 'active',
        plan: body.plan?.trim() ?? null,
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        now,
      }
    );

    return NextResponse.json({ license: { id, user_id: body.user_id, status: body.status ?? 'active', plan: body.plan ?? null, expires_at: body.expires_at ?? null, created_at: now.toISOString() } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
