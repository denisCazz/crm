import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAuth } from '../../../../lib/authHelpers';
import { dbQuery } from '../../../../lib/mysql';
import { randomUUID } from 'crypto';

// Genera una API key sicura
function generateApiKey(): string {
  // Formato: bcrm_<32 caratteri random hex>
  return `bcrm_${randomBytes(16).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const userId = user.id;

    const newApiKey = generateApiKey();

    const existing = await dbQuery<any>(`SELECT id FROM app_settings WHERE owner_id = :owner_id LIMIT 1`, { owner_id: userId });
    if (existing[0]) {
      await dbQuery(`UPDATE app_settings SET api_key = :api_key WHERE owner_id = :owner_id`, { api_key: newApiKey, owner_id: userId });
    } else {
      await dbQuery(
        `INSERT INTO app_settings (id, owner_id, api_key) VALUES (:id, :owner_id, :api_key)`,
        { id: randomUUID(), owner_id: userId, api_key: newApiKey }
      );
    }

    return NextResponse.json({ 
      success: true,
      api_key: newApiKey,
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

    await dbQuery(`UPDATE app_settings SET api_key = NULL WHERE owner_id = :owner_id`, { owner_id: userId });

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
