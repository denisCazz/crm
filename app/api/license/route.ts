import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/mysql';
import { randomUUID } from 'crypto';

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
    const existing = await dbQuery<any>(
      `SELECT id, user_id, status, plan, expires_at, created_at FROM licenses WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1`,
      { user_id }
    );
    if (existing[0]) {
      // Licenza già esistente, non creare duplicati
      return NextResponse.json({ message: 'Licenza già esistente', license: existing[0] });
    }

    // Calcola data scadenza trial (30 giorni)
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 30);
    const licenseId = randomUUID();

    await dbQuery(
      `INSERT INTO licenses (id, user_id, status, plan, expires_at)
       VALUES (:id, :user_id, :status, :plan, :expires_at)`,
      {
        id: licenseId,
        user_id,
        status,
        plan,
        expires_at: (expires_at ?? trialExpires.toISOString()).slice(0, 23).replace('T', ' '),
      }
    );

    const created = await dbQuery<any>(
      `SELECT id, user_id, status, plan, expires_at, created_at FROM licenses WHERE id = :id LIMIT 1`,
      { id: licenseId }
    );

    return NextResponse.json({ message: 'Licenza creata con successo', license: created[0] ?? { id: licenseId, user_id, status, plan } });
  } catch (e) {
    console.error('Errore API license:', e);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
