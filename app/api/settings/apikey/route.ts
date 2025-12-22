import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../../lib/supabaseServer';
import { randomBytes } from 'crypto';

async function getUserIdFromBearerToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const [kind, token] = authHeader.split(' ');
  if (kind?.toLowerCase() !== 'bearer' || !token) return null;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

// Genera una API key sicura
function generateApiKey(): string {
  // Formato: bcrm_<32 caratteri random hex>
  return `bcrm_${randomBytes(16).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromBearerToken(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();
    const newApiKey = generateApiKey();

    // Upsert: crea o aggiorna l'API key per questo utente
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(
        { 
          owner_id: userId, 
          api_key: newApiKey 
        },
        { onConflict: 'owner_id' }
      )
      .select('api_key')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      api_key: data.api_key,
      message: 'API key generata con successo'
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE per revocare l'API key
export async function DELETE(req: Request) {
  try {
    const userId = await getUserIdFromBearerToken(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();

    const { error } = await supabase
      .from('app_settings')
      .update({ api_key: null })
      .eq('owner_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'API key revocata'
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
