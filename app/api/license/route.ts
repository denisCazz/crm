import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Usa service role per poter creare licenze senza RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface LicenseCreatePayload {
  user_id: string;
  plan?: string;
  status?: string;
  expires_at?: string | null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as LicenseCreatePayload;
    const { user_id, plan = 'trial', status = 'trial', expires_at } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id è obbligatorio' }, { status: 400 });
    }

    // Controlla se la licenza esiste già
    const { data: existingLicense } = await supabaseAdmin
      .from('licenses')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (existingLicense) {
      // Licenza già esistente, non creare duplicati
      return NextResponse.json({ message: 'Licenza già esistente', license: existingLicense });
    }

    // Calcola data scadenza trial (30 giorni)
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 30);

    const { data, error } = await supabaseAdmin
      .from('licenses')
      .insert({
        user_id,
        plan,
        status,
        expires_at: expires_at ?? trialExpires.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Errore creazione licenza:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Licenza creata con successo', license: data });
  } catch (e) {
    console.error('Errore API license:', e);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
