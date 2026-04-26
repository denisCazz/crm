import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { dbQuery } from '@/lib/mysql';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);

    const rows = await dbQuery<any>(
      `SELECT id, user_id, status, plan, expires_at, created_at
       FROM licenses
       WHERE user_id = :user_id
       ORDER BY created_at DESC
       LIMIT 1`,
      { user_id: user.id }
    );

    const lic = rows[0] ?? null;
    const license = lic
      ? {
          ...lic,
          expires_at: lic.expires_at ? new Date(lic.expires_at).toISOString() : null,
          created_at: lic.created_at ? new Date(lic.created_at).toISOString() : null,
        }
      : null;

    return NextResponse.json({ license });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

