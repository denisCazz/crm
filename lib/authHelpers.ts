/* eslint-disable @typescript-eslint/no-explicit-any */
// Helper per le API routes che necessitano di autenticazione
import { getSessionFromToken } from './auth';
import type { User } from './auth';
import { dbQuery } from './mysql';

/**
 * Risolve un API key statica nel relativo utente proprietario.
 * L'API key è memorizzata in app_settings.api_key.
 */
async function getUserFromApiKey(apiKey: string): Promise<User | null> {
  const settings = await dbQuery<any>(
    `SELECT owner_id FROM app_settings WHERE api_key = :api_key LIMIT 1`,
    { api_key: apiKey }
  );
  const row = settings[0];
  if (!row) return null;

  const users = await dbQuery<any>(
    `SELECT * FROM users WHERE id = :id AND is_active = 1 LIMIT 1`,
    { id: row.owner_id }
  );
  const u = users[0];
  if (!u) return null;

  return {
    id: u.id,
    email: u.email,
    email_verified: Boolean(u.email_verified),
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    user_metadata: u.user_metadata ? (typeof u.user_metadata === 'string' ? JSON.parse(u.user_metadata) : u.user_metadata) : {},
    app_metadata: u.app_metadata ? (typeof u.app_metadata === 'string' ? JSON.parse(u.app_metadata) : u.app_metadata) : {},
    last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
    created_at: new Date(u.created_at).toISOString(),
  };
}

/**
 * Estrae e verifica le credenziali dalla richiesta.
 * Supporta due metodi:
 *  1. Bearer token  → Authorization: Bearer <token>
 *  2. API key       → X-API-Key: <key>  oppure  ?api_key=<key>
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  // 1. Bearer token (sessioni utente e chiamate dall'app)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const result = await getSessionFromToken(token);
      if (result) return result.user;
    }
  }

  // 2. API key (integrazioni esterne)
  const apiKey =
    request.headers.get('x-api-key') ??
    new URL(request.url).searchParams.get('api_key');
  if (apiKey) {
    return getUserFromApiKey(apiKey.trim());
  }

  return null;
}

/**
 * Helper per richiedere autenticazione
 * Lancia un errore se l'utente non è autenticato
 */
export async function requireAuth(request: Request): Promise<User> {
  const user = await getUserFromRequest(request);
  
  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Verifica se un utente è admin
 */
export function isAdmin(user: User, adminEmails: string[]): boolean {
  if (!user.email) return false;
  
  const envAdmin = adminEmails.includes(user.email.toLowerCase());
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const metadataAdmin = userMetadata["is_admin"] === true || appMetadata["role"] === "admin";
  
  return envAdmin || metadataAdmin;
}

/**
 * Helper per richiedere ruolo admin
 */
export async function requireAdmin(request: Request, adminEmails: string[]): Promise<User> {
  const user = await requireAuth(request);
  
  if (!isAdmin(user, adminEmails)) {
    throw new Error('Forbidden');
  }

  return user;
}
