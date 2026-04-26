import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

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
    const settingsRows = await dbQuery<any>(
      `SELECT owner_id FROM app_settings WHERE api_key = :api_key LIMIT 1`,
      { api_key: apiKey }
    );
    const settings = settingsRows[0];
    if (!settings) {
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
      const existingRows = await dbQuery<any>(
        `SELECT id FROM clients WHERE owner_id = :owner_id AND LOWER(email) = :email LIMIT 1`,
        { owner_id: ownerId, email: body.email.toLowerCase().trim() }
      );
      const existingClient = existingRows[0];
      if (existingClient?.id) {
        // Aggiorna il client esistente invece di crearne uno nuovo
        await dbQuery(
          `UPDATE clients SET
            first_name = COALESCE(NULLIF(:first_name,''), first_name),
            last_name = COALESCE(NULLIF(:last_name,''), last_name),
            phone = COALESCE(NULLIF(:phone,''), phone),
            contact_request = :contact_request,
            notes = :notes,
            lead_source = :lead_source,
            tags = :tags
           WHERE id = :id AND owner_id = :owner_id`,
          {
            id: existingClient.id,
            owner_id: ownerId,
            first_name: body.first_name?.trim() ?? '',
            last_name: body.last_name?.trim() ?? '',
            phone: body.phone?.trim() ?? '',
            contact_request: body.message?.trim() ?? null,
            notes: body.message?.trim() ?? null,
            lead_source: body.source || 'website',
            tags: JSON.stringify(body.tags || []),
          }
        );

        return NextResponse.json({
          success: true,
          message: 'Lead aggiornato',
          client_id: existingClient.id,
          is_new: false,
        }, { headers: corsHeaders() });
      }
    }

    // Inserisci nuovo client
    const newId = randomUUID();
    await dbQuery(
      `INSERT INTO clients (id, owner_id, first_name, last_name, email, phone, contact_request, notes, lead_source, tags, status)
       VALUES (:id, :owner_id, :first_name, :last_name, :email, :phone, :contact_request, :notes, :lead_source, :tags, 'new')`,
      {
        id: newId,
        owner_id: ownerId,
        first_name: body.first_name?.trim() || null,
        last_name: body.last_name?.trim() || null,
        email: body.email?.toLowerCase().trim() || null,
        phone: body.phone?.trim() || null,
        contact_request: body.message?.trim() || null,
        notes: body.message?.trim() || null,
        lead_source: body.source || 'website',
        tags: JSON.stringify(body.tags || []),
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Lead creato con successo',
      client_id: newId,
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
