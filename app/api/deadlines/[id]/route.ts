import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';

function parseRow(r: any) {
  return {
    ...r,
    due_at: r.due_at ? new Date(r.due_at).toISOString() : null,
    reminder_at: r.reminder_at ? new Date(r.reminder_at).toISOString() : null,
    completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const rows = await dbQuery<any>(
      'SELECT id FROM deadlines WHERE id = :id AND owner_id = :owner_id',
      { id, owner_id: user.id }
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    const allowed = ['title', 'description', 'due_at', 'priority', 'status', 'client_id', 'document_id', 'reminder_at'];
    const sets: string[] = ['updated_at = :now'];
    const p: Record<string, unknown> = { id, owner_id: user.id, now: new Date() };

    for (const field of allowed) {
      if (field in body) {
        sets.push(`${field} = :${field}`);
        if ((field === 'due_at' || field === 'reminder_at') && body[field]) {
          p[field] = new Date(body[field] as string);
        } else {
          p[field] = body[field];
        }
      }
    }

    // Auto-set completed_at when marking as done
    if (body.status === 'done') {
      sets.push('completed_at = :completed_at');
      p.completed_at = new Date();
    } else if (body.status && body.status !== 'done') {
      sets.push('completed_at = NULL');
    }

    await dbQuery(`UPDATE deadlines SET ${sets.join(', ')} WHERE id = :id AND owner_id = :owner_id`, p);

    const updated = await dbQuery<any>('SELECT * FROM deadlines WHERE id = :id', { id });
    return NextResponse.json({ deadline: parseRow(updated[0]) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    await dbQuery(
      'DELETE FROM deadlines WHERE id = :id AND owner_id = :owner_id',
      { id, owner_id: user.id }
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
