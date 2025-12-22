import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Usa service role per accedere a auth.users
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Lista delle email admin
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export async function GET(request: Request) {
  try {
    // Verifica che chi chiama sia admin (tramite Bearer token)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token mancante' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Utente non autenticato' }, { status: 401 });
    }

    // Verifica che sia admin
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
    }

    // Fetch tutte le licenze
    const { data: licenses, error: licensesError } = await supabaseAdmin
      .from('licenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (licensesError) {
      return NextResponse.json({ error: licensesError.message }, { status: 500 });
    }

    // Fetch tutti gli utenti da auth.users
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

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
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
