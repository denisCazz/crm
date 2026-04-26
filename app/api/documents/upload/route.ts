import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';
import { uploadToS3, getDefaultBucket } from '@/lib/storage';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const clientId = formData.get('client_id') as string | null;
    const docType = formData.get('doc_type') as string | null;
    const description = formData.get('description') as string | null;
    const docDate = formData.get('doc_date') as string | null;
    const expiresAt = formData.get('expires_at') as string | null;
    const tagsRaw = formData.get('tags') as string | null;

    if (!file) return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: 'Titolo obbligatorio' }, { status: 400 });

    const docId = randomUUID();
    const ext = file.name.split('.').pop() ?? '';
    const s3Key = `documents/${user.id}/${docId}${ext ? `.${ext}` : ''}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToS3({
      key: s3Key,
      body: buffer,
      contentType: file.type || 'application/octet-stream',
      bucket: getDefaultBucket(),
    });

    const tags = tagsRaw ? JSON.parse(tagsRaw) : [];
    const now = new Date();

    await dbQuery(
      `INSERT INTO documents (id, owner_id, client_id, title, description, doc_type, status,
        file_name, mime_type, file_size, s3_key, s3_bucket, doc_date, expires_at, tags, created_at, updated_at)
       VALUES (:id, :owner_id, :client_id, :title, :description, :doc_type, 'active',
        :file_name, :mime_type, :file_size, :s3_key, :s3_bucket, :doc_date, :expires_at, :tags, :now, :now)`,
      {
        id: docId,
        owner_id: user.id,
        client_id: clientId || null,
        title: title.trim(),
        description: description?.trim() || null,
        doc_type: docType?.trim() || null,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        s3_key: s3Key,
        s3_bucket: getDefaultBucket(),
        doc_date: docDate || null,
        expires_at: expiresAt ? new Date(expiresAt) : null,
        tags: JSON.stringify(tags),
        now,
      }
    );

    // Log event
    await dbQuery(
      `INSERT INTO document_events (id, document_id, owner_id, event_type, actor_id, created_at)
       VALUES (:id, :doc_id, :owner_id, 'uploaded', :actor_id, :now)`,
      { id: randomUUID(), doc_id: docId, owner_id: user.id, actor_id: user.id, now }
    );

    return NextResponse.json({
      document: {
        id: docId,
        owner_id: user.id,
        client_id: clientId || null,
        title: title.trim(),
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        s3_key: s3Key,
        status: 'active',
        created_at: now.toISOString(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
