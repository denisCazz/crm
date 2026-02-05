import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../lib/supabaseServer';
import { requireAdmin } from '../../../lib/authHelpers';
import { listUsers } from '../../../lib/auth';

// Lista delle email admin
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export async function GET(request: Request) {
  try {
    // Verifica che chi chiama sia admin
    const user = await requireAdmin(request, ADMIN_EMAILS);

    const supabase = getServiceSupabaseClient();

    // Fetch tutte le licenze
    const { data: licenses, error: licensesError } = await supabase
      .from('licenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (licensesError) {
      return NextResponse.json({ error: licensesError.message }, { status: 500 });
    }

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
          expires_at: lic.expires_at,
          created_at: lic.created_at,
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
