import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { AI_ENABLED, searchSimilarDocuments } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);

    if (!AI_ENABLED) {
      return NextResponse.json({ error: 'AI search non è attivo. Imposta AI_INDEXING_ENABLED=true.' }, { status: 503 });
    }

    const body = (await req.json()) as { query?: string; top_k?: number };
    if (!body.query?.trim()) return NextResponse.json({ error: 'query è obbligatoria' }, { status: 400 });

    const results = await searchSimilarDocuments(body.query.trim(), user.id, body.top_k ?? 5);
    return NextResponse.json({ results, ai_enabled: AI_ENABLED });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
