// Helper per le API routes che necessitano di autenticazione
import { getSessionFromToken } from './auth';
import type { User } from './auth';

/**
 * Estrae e verifica il Bearer token dalla richiesta
 * Ritorna l'utente autenticato o null se il token non è valido
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const result = await getSessionFromToken(token);
  
  if (!result) {
    return null;
  }

  return result.user;
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
