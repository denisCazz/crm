import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../../lib/supabaseServer';
import { randomBytes } from 'crypto';
import { requireAuth } from '../../../../lib/authHelpers';

// Genera una API key sicura
function generateApiKey(): string {
  // Formato: bcrm_<32 caratteri random hex>
  return `bcrm_${randomBytes(16).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const userId = user.id;

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
      const msg = error.message ?? String(error);
      if (msg.includes('column') && msg.includes('app_settings.api_key') && msg.includes('does not exist')) {
        return NextResponse.json(
          {
            error:
              "Database schema mismatch: missing public.app_settings.api_key. Run the migration in supabase/sql/api_keys.sql (or re-run supabase/sql/setup_all.sql) and then retry.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      api_key: data.api_key,
      message: 'API key generata con successo'
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE per revocare l'API key
export async function DELETE(req: Request) {
  try {
    const user = await requireAuth(req);
    const userId = user.id;

    const supabase = getServiceSupabaseClient();

    const { error } = await supabase
      .from('app_settings')
      .update({ api_key: null })
      .eq('owner_id', userId);

    if (error) {
      const msg = error.message ?? String(error);
      if (msg.includes('column') && msg.includes('app_settings.api_key') && msg.includes('does not exist')) {
        return NextResponse.json(
          {
            error:
              "Database schema mismatch: missing public.app_settings.api_key. Run the migration in supabase/sql/api_keys.sql (or re-run supabase/sql/setup_all.sql) and then retry.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'API key revocata'
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
