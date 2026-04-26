import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = (await req.json()) as { name?: string; subject?: string; body_html?: string; body_text?: string };

    const rows = await dbQuery<any>(
      'SELECT id FROM email_templates WHERE id = :id AND owner_id = :owner_id',
      { id, owner_id: user.id }
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sets: string[] = ['updated_at = :now'];
    const params2: Record<string, unknown> = { id, owner_id: user.id, now: new Date() };

    if (body.name !== undefined) { sets.push('name = :name'); params2.name = body.name.trim(); }
    if (body.subject !== undefined) { sets.push('subject = :subject'); params2.subject = body.subject.trim(); }
    if (body.body_html !== undefined) { sets.push('body_html = :body_html'); params2.body_html = body.body_html.trim(); }
    if (body.body_text !== undefined) { sets.push('body_text = :body_text'); params2.body_text = body.body_text.trim() || null; }

    await dbQuery(
      `UPDATE email_templates SET ${sets.join(', ')} WHERE id = :id AND owner_id = :owner_id`,
      params2
    );

    const updated = await dbQuery<any>(
      'SELECT id, owner_id, name, subject, body_html, body_text, created_at, updated_at FROM email_templates WHERE id = :id',
      { id }
    );

    return NextResponse.json({ template: updated[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : message === 'Not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const rows = await dbQuery<any>(
      'SELECT id FROM email_templates WHERE id = :id AND owner_id = :owner_id',
      { id, owner_id: user.id }
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await dbQuery('DELETE FROM email_templates WHERE id = :id AND owner_id = :owner_id', { id, owner_id: user.id });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
