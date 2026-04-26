import { NextResponse } from 'next/server';
import { encryptSecret } from '../../../lib/crypto';
import { getSessionFromToken } from '../../../lib/auth';
import { dbQuery } from '../../../lib/mysql';
import { randomUUID } from 'crypto';

const ADMIN_EMAILS: string[] = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

type SettingsUpdatePayload = {
  target_owner_id?: string; // Admin può specificare un altro utente
  brand_name?: string | null;
  logo_url?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_secure?: boolean | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from_email?: string | null;
  smtp_from_name?: string | null;
  smtp_reply_to?: string | null;
};

async function getUserFromBearerToken(authHeader: string | null): Promise<{ id: string; email: string | undefined } | null> {
  if (!authHeader) return null;
  const [kind, token] = authHeader.split(' ');
  if (kind?.toLowerCase() !== 'bearer' || !token) return null;

  const result = await getSessionFromToken(token);
  if (!result) return null;
  return { id: result.user.id, email: result.user.email };
}

function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: missing Authorization header (expected: Bearer <token>)' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid Authorization scheme (expected: Bearer <token>)' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const currentUser = await getUserFromBearerToken(authHeader);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired token' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const rows = await dbQuery<any>(
      `SELECT id, owner_id, brand_name, logo_url, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_email, smtp_from_name, smtp_reply_to, api_key, created_at, updated_at
       FROM app_settings
       WHERE owner_id = :owner_id
       LIMIT 1`,
      { owner_id: currentUser.id }
    );
    const data = rows[0] ?? null;
    return NextResponse.json({ settings: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: missing Authorization header (expected: Bearer <token>)' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid Authorization scheme (expected: Bearer <token>)' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const currentUser = await getUserFromBearerToken(authHeader);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired token' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const body = (await req.json()) as SettingsUpdatePayload;
    
    // Determina l'owner_id target
    let targetOwnerId = currentUser.id;
    
    // Se è specificato target_owner_id e l'utente è admin, usa quello
    if (body.target_owner_id && body.target_owner_id !== currentUser.id) {
      if (!isAdmin(currentUser.email)) {
        return NextResponse.json({ error: 'Solo gli admin possono modificare le impostazioni di altri utenti' }, { status: 403 });
      }
      targetOwnerId = body.target_owner_id;
    }

    const update: Record<string, unknown> = {
      owner_id: targetOwnerId,
      smtp_host: body.smtp_host ?? null,
      smtp_port: typeof body.smtp_port === 'number' ? body.smtp_port : null,
      smtp_secure: typeof body.smtp_secure === 'boolean' ? body.smtp_secure : null,
      smtp_user: body.smtp_user ?? null,
      smtp_from_email: body.smtp_from_email ?? null,
      smtp_from_name: body.smtp_from_name ?? null,
      smtp_reply_to: body.smtp_reply_to ?? null,
    };

    // brand_name e logo_url solo se non è una richiesta admin per altro utente
    // (o se è per se stesso)
    if (targetOwnerId === currentUser.id) {
      update.brand_name = body.brand_name ?? null;
      update.logo_url = body.logo_url ?? null;
    }

    if (typeof body.smtp_password === 'string') {
      const trimmed = body.smtp_password.trim();
      // Se vuota => non aggiornare.
      if (trimmed.length > 0) {
        update.smtp_password_enc = encryptSecret(trimmed);
      }
    }
    const existing = await dbQuery<any>(`SELECT id FROM app_settings WHERE owner_id = :owner_id LIMIT 1`, { owner_id: targetOwnerId });
    if (existing[0]) {
      await dbQuery(
        `UPDATE app_settings SET
          brand_name = COALESCE(:brand_name, brand_name),
          logo_url = COALESCE(:logo_url, logo_url),
          smtp_host = :smtp_host,
          smtp_port = :smtp_port,
          smtp_secure = :smtp_secure,
          smtp_user = :smtp_user,
          smtp_password_enc = COALESCE(:smtp_password_enc, smtp_password_enc),
          smtp_from_email = :smtp_from_email,
          smtp_from_name = :smtp_from_name,
          smtp_reply_to = :smtp_reply_to
         WHERE owner_id = :owner_id`,
        {
          owner_id: targetOwnerId,
          brand_name: (update as any).brand_name ?? null,
          logo_url: (update as any).logo_url ?? null,
          smtp_host: update.smtp_host,
          smtp_port: update.smtp_port,
          smtp_secure: update.smtp_secure,
          smtp_user: update.smtp_user,
          smtp_password_enc: (update as any).smtp_password_enc ?? null,
          smtp_from_email: update.smtp_from_email,
          smtp_from_name: update.smtp_from_name,
          smtp_reply_to: update.smtp_reply_to,
        }
      );
    } else {
      await dbQuery(
        `INSERT INTO app_settings (id, owner_id, brand_name, logo_url, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password_enc, smtp_from_email, smtp_from_name, smtp_reply_to)
         VALUES (:id, :owner_id, :brand_name, :logo_url, :smtp_host, :smtp_port, :smtp_secure, :smtp_user, :smtp_password_enc, :smtp_from_email, :smtp_from_name, :smtp_reply_to)`,
        {
          id: randomUUID(),
          owner_id: targetOwnerId,
          brand_name: (update as any).brand_name ?? null,
          logo_url: (update as any).logo_url ?? null,
          smtp_host: update.smtp_host,
          smtp_port: update.smtp_port,
          smtp_secure: update.smtp_secure,
          smtp_user: update.smtp_user,
          smtp_password_enc: (update as any).smtp_password_enc ?? null,
          smtp_from_email: update.smtp_from_email,
          smtp_from_name: update.smtp_from_name,
          smtp_reply_to: update.smtp_reply_to,
        }
      );
    }

    const rows = await dbQuery<any>(
      `SELECT id, owner_id, brand_name, logo_url, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_email, smtp_from_name, smtp_reply_to, api_key, created_at, updated_at
       FROM app_settings
       WHERE owner_id = :owner_id
       LIMIT 1`,
      { owner_id: targetOwnerId }
    );

    return NextResponse.json({ settings: rows[0] ?? null });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
