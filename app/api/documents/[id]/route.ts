import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';

function parseRow(r: any) {
  return {
    ...r,
    tags: r.tags && typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags ?? []),
    doc_date: r.doc_date ? new Date(r.doc_date).toISOString().slice(0, 10) : null,
    expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const rows = await dbQuery<any>(
      `SELECT d.*, c.first_name AS client_first_name, c.last_name AS client_last_name
       FROM documents d
       LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.id = :id AND d.owner_id = :owner_id`,
      { id, owner_id: user.id }
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ document: parseRow(rows[0]) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const rows = await dbQuery<any>(
      'SELECT id FROM documents WHERE id = :id AND owner_id = :owner_id AND status != "deleted"',
      { id, owner_id: user.id }
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    const allowed = ['title', 'description', 'doc_type', 'client_id', 'doc_date', 'expires_at', 'tags', 'status'];
    const sets: string[] = ['updated_at = :now'];
    const p: Record<string, unknown> = { id, owner_id: user.id, now: new Date() };

    for (const field of allowed) {
      if (field in body) {
        sets.push(`${field} = :${field}`);
        p[field] = field === 'tags' ? JSON.stringify(body[field]) : body[field];
      }
    }

    await dbQuery(`UPDATE documents SET ${sets.join(', ')} WHERE id = :id AND owner_id = :owner_id`, p);

    const updated = await dbQuery<any>('SELECT * FROM documents WHERE id = :id', { id });
    return NextResponse.json({ document: parseRow(updated[0]) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const rows = await dbQuery<any>(
      'SELECT id FROM documents WHERE id = :id AND owner_id = :owner_id',
      { id, owner_id: user.id }
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Soft delete
    await dbQuery(
      'UPDATE documents SET status = "deleted", updated_at = NOW(3) WHERE id = :id AND owner_id = :owner_id',
      { id, owner_id: user.id }
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
