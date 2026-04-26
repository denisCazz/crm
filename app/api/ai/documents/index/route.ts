import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';
import { AI_ENABLED, embedText, chunkDocumentText } from '@/lib/ai';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);

    if (!AI_ENABLED) {
      return NextResponse.json({ error: 'AI indexing non è attivo. Imposta AI_INDEXING_ENABLED=true.' }, { status: 503 });
    }

    const body = (await req.json()) as { document_id?: string; text?: string };
    if (!body.document_id || !body.text?.trim()) {
      return NextResponse.json({ error: 'document_id e text sono obbligatori' }, { status: 400 });
    }

    const docs = await dbQuery<any>(
      'SELECT id FROM documents WHERE id = :id AND owner_id = :owner_id',
      { id: body.document_id, owner_id: user.id }
    );
    if (docs.length === 0) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });

    // Remove existing chunks and embeddings for this document
    await dbQuery('DELETE FROM document_ai_chunks WHERE document_id = :doc_id AND owner_id = :owner_id', {
      doc_id: body.document_id, owner_id: user.id,
    });

    const chunks = chunkDocumentText(body.text);
    const results: { chunk_id: string; indexed: boolean }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = randomUUID();
      const now = new Date();

      await dbQuery(
        `INSERT INTO document_ai_chunks (id, document_id, owner_id, chunk_index, chunk_text, created_at)
         VALUES (:id, :document_id, :owner_id, :chunk_index, :chunk_text, :now)`,
        { id: chunkId, document_id: body.document_id, owner_id: user.id, chunk_index: i, chunk_text: chunks[i], now }
      );

      const embedding = await embedText(chunks[i]);
      const embId = randomUUID();

      await dbQuery(
        `INSERT INTO document_ai_embeddings (id, chunk_id, owner_id, model, embedding, created_at)
         VALUES (:id, :chunk_id, :owner_id, :model, :embedding, :now)`,
        {
          id: embId,
          chunk_id: chunkId,
          owner_id: user.id,
          model: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
          embedding: JSON.stringify(embedding),
          now,
        }
      );

      results.push({ chunk_id: chunkId, indexed: true });
    }

    return NextResponse.json({ ok: true, chunks_indexed: results.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
