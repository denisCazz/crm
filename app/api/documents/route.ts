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

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const url = new URL(req.url);
    const clientId = url.searchParams.get('client_id');
    const status = url.searchParams.get('status') ?? 'active';
    const docType = url.searchParams.get('doc_type');

    const conditions: string[] = ['d.owner_id = :owner_id', 'd.status != "deleted"'];
    const params: Record<string, unknown> = { owner_id: user.id };

    if (clientId) { conditions.push('d.client_id = :client_id'); params.client_id = clientId; }
    if (status && status !== 'all') { conditions.push('d.status = :status'); params.status = status; }
    if (docType) { conditions.push('d.doc_type = :doc_type'); params.doc_type = docType; }

    const rows = await dbQuery<any>(
      `SELECT d.id, d.owner_id, d.client_id, d.title, d.description, d.doc_type, d.status,
              d.file_name, d.mime_type, d.file_size, d.s3_key, d.doc_date, d.expires_at,
              d.tags, d.created_at, d.updated_at,
              c.first_name AS client_first_name, c.last_name AS client_last_name
       FROM documents d
       LEFT JOIN clients c ON c.id = d.client_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC`,
      params
    );

    return NextResponse.json({ documents: rows.map(parseRow) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
