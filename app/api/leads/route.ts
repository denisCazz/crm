import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Usa service role per inserire lead senza autenticazione utente
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper per aggiungere header CORS
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
  };
}

interface LeadPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  message?: string;          // Messaggio o richiesta di contatto
  source?: string;           // es: "website", "newsletter", "landing_page"
  tags?: string[];           // Tag opzionali
}

export async function POST(request: Request) {
  try {
    // Leggi API key dall'header
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key mancante. Usa header X-API-Key o Authorization: Bearer <key>' },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Trova l'owner associato all'API key
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('owner_id')
      .eq('api_key', apiKey)
      .single();

    if (settingsError) {
      const msg = settingsError.message ?? String(settingsError);
      if (msg.includes('column') && msg.includes('app_settings.api_key') && msg.includes('does not exist')) {
        return NextResponse.json(
          {
            error:
              "Database schema mismatch: missing public.app_settings.api_key. Run the migration in supabase/sql/api_keys.sql (or re-run supabase/sql/setup_all.sql) and then retry.",
          },
          { status: 500, headers: corsHeaders() }
        );
      }
    }

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: 'API key non valida' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const ownerId = settings.owner_id;

    // Parse del body
    const body = await request.json() as LeadPayload;

    // Validazione minima: almeno email o telefono
    if (!body.email && !body.phone) {
      return NextResponse.json(
        { error: 'Almeno email o phone è richiesto' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Controlla se esiste già un client con stessa email per questo owner
    if (body.email) {
      const { data: existingClient } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('email', body.email.toLowerCase().trim())
        .maybeSingle();

      if (existingClient) {
        // Aggiorna il client esistente invece di crearne uno nuovo
        const { error: updateError } = await supabaseAdmin
          .from('clients')
          .update({
            first_name: body.first_name || undefined,
            last_name: body.last_name || undefined,
            phone: body.phone || undefined,
            contact_request: body.message || undefined,
            notes: body.message?.trim() || undefined,
            lead_source: body.source || 'website',
            tags: body.tags || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingClient.id);

        if (updateError) {
          console.error('Errore aggiornamento lead:', updateError);
          return NextResponse.json({ error: updateError.message }, { status: 500, headers: corsHeaders() });
        }

        return NextResponse.json({
          success: true,
          message: 'Lead aggiornato',
          client_id: existingClient.id,
          is_new: false,
        }, { headers: corsHeaders() });
      }
    }

    // Inserisci nuovo client
    const { data: newClient, error: insertError } = await supabaseAdmin
      .from('clients')
      .insert({
        owner_id: ownerId,
        first_name: body.first_name?.trim() || null,
        last_name: body.last_name?.trim() || null,
        email: body.email?.toLowerCase().trim() || null,
        phone: body.phone?.trim() || null,
        contact_request: body.message?.trim() || null,
        notes: body.message?.trim() || null,
        lead_source: body.source || 'website',
        tags: body.tags || [],
        status: 'new',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Errore inserimento lead:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({
      success: true,
      message: 'Lead creato con successo',
      client_id: newClient.id,
      is_new: true,
    }, { headers: corsHeaders() });

  } catch (e) {
    console.error('Errore API leads:', e);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// OPTIONS per CORS (necessario per chiamate da altri domini)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    },
  });
}
