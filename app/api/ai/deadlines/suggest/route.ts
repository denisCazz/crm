import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { AI_ENABLED } from '@/lib/ai';

/**
 * Placeholder endpoint for AI-based deadline suggestions.
 * Will use document text + embeddings to suggest deadlines in a future release.
 */
export async function POST(req: Request) {
  try {
    await requireAuth(req);

    if (!AI_ENABLED) {
      return NextResponse.json({
        error: 'AI suggerimenti non attivi. Imposta AI_INDEXING_ENABLED=true.',
        suggestions: [],
      }, { status: 503 });
    }

    // Future: read document_id, extract text, call OpenAI chat completion to suggest deadlines
    return NextResponse.json({
      suggestions: [],
      message: 'Funzionalità in sviluppo. Sarà disponibile quando il documento avrà un testo indicizzato.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
