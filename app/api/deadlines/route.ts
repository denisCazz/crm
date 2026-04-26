import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

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

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('client_id');
    const documentId = url.searchParams.get('document_id');

    const conditions: string[] = ['dl.owner_id = :owner_id'];
    const params: Record<string, unknown> = { owner_id: user.id };

    if (status && status !== 'all') { conditions.push('dl.status = :status'); params.status = status; }
    if (clientId) { conditions.push('dl.client_id = :client_id'); params.client_id = clientId; }
    if (documentId) { conditions.push('dl.document_id = :document_id'); params.document_id = documentId; }

    const rows = await dbQuery<any>(
      `SELECT dl.*, 
              c.first_name AS client_first_name, c.last_name AS client_last_name,
              d.title AS document_title
       FROM deadlines dl
       LEFT JOIN clients c ON c.id = dl.client_id
       LEFT JOIN documents d ON d.id = dl.document_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY dl.due_at ASC`,
      params
    );

    return NextResponse.json({ deadlines: rows.map(parseRow) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      due_at?: string;
      priority?: string;
      client_id?: string | null;
      document_id?: string | null;
      reminder_at?: string | null;
    };

    if (!body.title?.trim()) return NextResponse.json({ error: 'Titolo obbligatorio' }, { status: 400 });
    if (!body.due_at) return NextResponse.json({ error: 'Scadenza obbligatoria' }, { status: 400 });

    const id = randomUUID();
    const now = new Date();

    await dbQuery(
      `INSERT INTO deadlines (id, owner_id, client_id, document_id, title, description,
        due_at, priority, status, reminder_at, created_at, updated_at)
       VALUES (:id, :owner_id, :client_id, :document_id, :title, :description,
        :due_at, :priority, 'open', :reminder_at, :now, :now)`,
      {
        id,
        owner_id: user.id,
        client_id: body.client_id || null,
        document_id: body.document_id || null,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        due_at: new Date(body.due_at),
        priority: body.priority || 'normal',
        reminder_at: body.reminder_at ? new Date(body.reminder_at) : null,
        now,
      }
    );

    return NextResponse.json({
      deadline: {
        id,
        owner_id: user.id,
        client_id: body.client_id || null,
        document_id: body.document_id || null,
        title: body.title.trim(),
        due_at: new Date(body.due_at).toISOString(),
        priority: body.priority || 'normal',
        status: 'open',
        created_at: now.toISOString(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
