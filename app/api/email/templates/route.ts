import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const rows = await dbQuery<any>(
      `SELECT id, owner_id, name, subject, body_html, body_text, created_at, updated_at
       FROM email_templates
       WHERE owner_id = :owner_id
       ORDER BY updated_at DESC`,
      { owner_id: user.id }
    );

    const templates = rows.map((r) => ({
      ...r,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));

    return NextResponse.json({ templates });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = (await req.json()) as { name?: string; subject?: string; body_html?: string; body_text?: string };

    if (!body.name?.trim() || !body.subject?.trim() || !body.body_html?.trim()) {
      return NextResponse.json({ error: 'name, subject e body_html sono obbligatori' }, { status: 400 });
    }

    const id = randomUUID();
    const now = new Date();
    await dbQuery(
      `INSERT INTO email_templates (id, owner_id, name, subject, body_html, body_text, created_at, updated_at)
       VALUES (:id, :owner_id, :name, :subject, :body_html, :body_text, :now, :now)`,
      {
        id,
        owner_id: user.id,
        name: body.name.trim(),
        subject: body.subject.trim(),
        body_html: body.body_html.trim(),
        body_text: body.body_text?.trim() ?? null,
        now,
      }
    );

    return NextResponse.json({ template: { id, owner_id: user.id, name: body.name.trim(), subject: body.subject.trim(), body_html: body.body_html.trim(), body_text: body.body_text?.trim() ?? null, created_at: now.toISOString(), updated_at: now.toISOString() } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

