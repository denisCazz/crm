import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';
import { getPresignedDownloadUrl } from '@/lib/storage';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const rows = await dbQuery<any>(
      'SELECT s3_key, s3_bucket, file_name FROM documents WHERE id = :id AND owner_id = :owner_id AND status != "deleted"',
      { id, owner_id: user.id }
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const doc = rows[0];
    const url = await getPresignedDownloadUrl(doc.s3_key, 3600, doc.s3_bucket ?? undefined);

    return NextResponse.json({ url, file_name: doc.file_name });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
