/**
 * AI helper – server-only.
 * Wraps OpenAI embeddings API. Gated by AI_INDEXING_ENABLED env var.
 * Never import this in client components.
 */

export const AI_ENABLED = process.env.AI_INDEXING_ENABLED === 'true';

const MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY non configurata');
  return key;
}

/**
 * Generate embedding vector for a text string.
 * Returns float[] with 1536 dimensions (text-embedding-3-small).
 */
export async function embedText(text: string): Promise<number[]> {
  if (!AI_ENABLED) throw new Error('AI indexing è disabilitato (AI_INDEXING_ENABLED=false)');

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ model: MODEL, input: text.trim() }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0]?.embedding ?? [];
}

/**
 * Split a long text into overlapping chunks suitable for embedding.
 * Simple character-based splitter; replace with token-aware splitter for production.
 */
export function chunkDocumentText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter((c) => c.length > 10);
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

export type SimilarChunk = {
  document_id: string;
  chunk_id: string;
  chunk_text: string;
  similarity: number;
};

/**
 * Search for documents similar to a query string.
 * Performs applicative cosine similarity over stored embeddings.
 * Suitable for small datasets; for larger datasets, use a vector DB.
 */
export async function searchSimilarDocuments(
  query: string,
  ownerId: string,
  topK = 5
): Promise<SimilarChunk[]> {
  if (!AI_ENABLED) throw new Error('AI indexing è disabilitato');

  const { dbQuery } = await import('./mysql');

  const queryEmbedding = await embedText(query);

  const rows = await dbQuery<{
    chunk_id: string;
    document_id: string;
    chunk_text: string;
    embedding: string | number[];
  }>(
    `SELECT e.id AS chunk_id, c.document_id, c.chunk_text, e.embedding
     FROM document_ai_embeddings e
     JOIN document_ai_chunks c ON c.id = e.chunk_id
     WHERE e.owner_id = :owner_id`,
    { owner_id: ownerId }
  );

  const scored = rows.map((row) => {
    const emb: number[] = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
    return {
      document_id: row.document_id,
      chunk_id: row.chunk_id,
      chunk_text: row.chunk_text,
      similarity: cosineSimilarity(queryEmbedding, emb),
    };
  });

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
