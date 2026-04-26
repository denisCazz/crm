import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/authHelpers';
import { listUsers } from '../../../lib/auth';
import { dbQuery } from '../../../lib/mysql';

// Lista delle email admin
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export async function GET(request: Request) {
  try {
    // Verifica che chi chiama sia admin
    const user = await requireAdmin(request, ADMIN_EMAILS);

    // Fetch tutte le licenze
    const licenses = await dbQuery<any>(`SELECT * FROM licenses ORDER BY created_at DESC`);

    // Fetch tutti gli utenti dalla tabella custom
    const users = await listUsers();

    // Crea mappa user_id -> email
    const userEmailMap = new Map<string, string>();
    for (const u of users) {
      userEmailMap.set(u.id, u.email ?? u.id);
    }

    // Combina licenze con email
    const userLicensesMap = new Map<string, {
      user_id: string;
      email: string;
      license_id: string;
      status: string;
      plan: string | null;
      expires_at: string | null;
      created_at: string;
    }>();

    for (const lic of (licenses ?? [])) {
      const existing = userLicensesMap.get(lic.user_id);
      if (!existing || new Date(lic.created_at) > new Date(existing.created_at)) {
        userLicensesMap.set(lic.user_id, {
          user_id: lic.user_id,
          email: userEmailMap.get(lic.user_id) ?? lic.user_id,
          license_id: lic.id,
          status: lic.status,
          plan: lic.plan,
          expires_at: lic.expires_at ? new Date(lic.expires_at).toISOString() : null,
          created_at: lic.created_at ? new Date(lic.created_at).toISOString() : new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ 
      users: Array.from(userLicensesMap.values()) 
    });
  } catch (e) {
    console.error('Errore API users:', e);
    const message = e instanceof Error ? e.message : 'Errore interno del server';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
