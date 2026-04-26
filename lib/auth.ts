/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomBytes, randomUUID } from 'crypto';
import { dbQuery } from './mysql';

export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string | null;
  last_name: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  refresh_token: string | null;
  expires_at: string;
  created_at: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

function parseJsonMaybe<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') return value as T;
  return fallback;
}

// Hash password con SHA-256 (per produzione considerare bcrypt/argon2)
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// Genera token sicuro
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Verifica password
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Crea sessione
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<Session> {
  const token = generateToken();
  const refreshToken = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 giorni
  const id = randomUUID();

  await dbQuery(
    `INSERT INTO sessions (id, user_id, token, refresh_token, expires_at, user_agent, ip_address, last_activity_at)
     VALUES (:id, :user_id, :token, :refresh_token, :expires_at, :user_agent, :ip_address, :last_activity_at)`,
    {
      id,
      user_id: userId,
      token,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString().slice(0, 23).replace('T', ' '),
      user_agent: userAgent ?? null,
      ip_address: ipAddress ?? null,
      last_activity_at: new Date().toISOString().slice(0, 23).replace('T', ' '),
    }
  );

  return {
    id,
    user_id: userId,
    token,
    refresh_token: refreshToken,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
  };
}

// Verifica token e ottieni sessione
export async function getSessionFromToken(token: string): Promise<{ user: User; session: Session } | null> {
  const sessions = await dbQuery<any>(
    `SELECT * FROM sessions WHERE token = :token AND expires_at > NOW(3) LIMIT 1`,
    { token }
  );
  const sessionRow = sessions[0];
  if (!sessionRow) return null;

  const users = await dbQuery<any>(
    `SELECT * FROM users WHERE id = :id AND is_active = 1 LIMIT 1`,
    { id: sessionRow.user_id }
  );
  const userRow = users[0];
  if (!userRow) return null;

  await dbQuery(`UPDATE sessions SET last_activity_at = NOW(3) WHERE id = :id`, { id: sessionRow.id });

  const user: User = {
    id: userRow.id,
    email: userRow.email,
    email_verified: Boolean(userRow.email_verified),
    first_name: userRow.first_name ?? null,
    last_name: userRow.last_name ?? null,
    user_metadata: parseJsonMaybe<Record<string, unknown>>(userRow.user_metadata, {}),
    app_metadata: parseJsonMaybe<Record<string, unknown>>(userRow.app_metadata, {}),
    last_sign_in_at: userRow.last_sign_in_at ? new Date(userRow.last_sign_in_at).toISOString() : null,
    created_at: new Date(userRow.created_at).toISOString(),
  };

  const session: Session = {
    id: sessionRow.id,
    user_id: sessionRow.user_id,
    token: sessionRow.token,
    refresh_token: sessionRow.refresh_token ?? null,
    expires_at: new Date(sessionRow.expires_at).toISOString(),
    created_at: new Date(sessionRow.created_at).toISOString(),
  };

  return { user, session };
}

// Registra utente (senza conferma email - attivo immediatamente)
export async function signUp(
  email: string,
  password: string,
  metadata?: { first_name?: string; last_name?: string }
): Promise<AuthResult> {
  const existing = await dbQuery<any>(`SELECT id FROM users WHERE email = :email LIMIT 1`, { email: email.toLowerCase() });
  if (existing[0]) {
    return {
      user: null,
      session: null,
      error: 'Email già registrata',
    };
  }

  // Crea utente ATTIVO (email_verified = true, confirmed_at = now)
  const passwordHash = hashPassword(password);
  const userId = randomUUID();
  const now = new Date();

  await dbQuery(
    `INSERT INTO users (id, email, password_hash, email_verified, confirmed_at, first_name, last_name, user_metadata, app_metadata, created_at)
     VALUES (:id, :email, :password_hash, 1, :confirmed_at, :first_name, :last_name, :user_metadata, :app_metadata, :created_at)`,
    {
      id: userId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      confirmed_at: now.toISOString().slice(0, 23).replace('T', ' '),
      first_name: metadata?.first_name ?? null,
      last_name: metadata?.last_name ?? null,
      user_metadata: JSON.stringify(metadata ?? {}),
      app_metadata: JSON.stringify({}),
      created_at: now.toISOString().slice(0, 23).replace('T', ' '),
    }
  );

  await dbQuery(
    `INSERT INTO auth_audit_log (id, user_id, event_type, created_at) VALUES (:id, :user_id, :event_type, :created_at)`,
    { id: randomUUID(), user_id: userId, event_type: 'signup', created_at: now.toISOString().slice(0, 23).replace('T', ' ') }
  );

  const user: User = {
    id: userId,
    email: email.toLowerCase(),
    email_verified: true,
    first_name: metadata?.first_name ?? null,
    last_name: metadata?.last_name ?? null,
    user_metadata: metadata ?? {},
    app_metadata: {},
    last_sign_in_at: null,
    created_at: now.toISOString(),
  };

  return {
    user,
    session: null,
    error: null,
  };
}

// Login
export async function signIn(
  email: string,
  password: string,
  userAgent?: string,
  ipAddress?: string
): Promise<AuthResult> {
  const userRows = await dbQuery<any>(
    `SELECT * FROM users WHERE email = :email AND is_active = 1 LIMIT 1`,
    { email: email.toLowerCase() }
  );
  const user = userRows[0];

  if (!user) {
    await dbQuery(
      `INSERT INTO auth_audit_log (id, user_id, event_type, ip_address, metadata, created_at)
       VALUES (:id, NULL, :event_type, :ip_address, :metadata, NOW(3))`,
      { id: randomUUID(), event_type: 'login_failed', ip_address: ipAddress ?? null, metadata: JSON.stringify({ email, reason: 'user_not_found' }) }
    );

    return {
      user: null,
      session: null,
      error: 'Email o password non corretti',
    };
  }

  // Verifica password
  if (!verifyPassword(password, user.password_hash)) {
    await dbQuery(
      `INSERT INTO auth_audit_log (id, user_id, event_type, ip_address, metadata, created_at)
       VALUES (:id, :user_id, :event_type, :ip_address, :metadata, NOW(3))`,
      { id: randomUUID(), user_id: user.id, event_type: 'login_failed', ip_address: ipAddress ?? null, metadata: JSON.stringify({ reason: 'wrong_password' }) }
    );

    return {
      user: null,
      session: null,
      error: 'Email o password non corretti',
    };
  }

  // Crea sessione
  const session = await createSession(user.id, userAgent, ipAddress);

  // Aggiorna last_sign_in_at
  await dbQuery(`UPDATE users SET last_sign_in_at = NOW(3) WHERE id = :id`, { id: user.id });
  await dbQuery(
    `INSERT INTO auth_audit_log (id, user_id, event_type, ip_address, user_agent, created_at)
     VALUES (:id, :user_id, :event_type, :ip_address, :user_agent, NOW(3))`,
    { id: randomUUID(), user_id: user.id, event_type: 'login_success', ip_address: ipAddress ?? null, user_agent: userAgent ?? null }
  );

  const outUser: User = {
    id: user.id,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    user_metadata: parseJsonMaybe<Record<string, unknown>>(user.user_metadata, {}),
    app_metadata: parseJsonMaybe<Record<string, unknown>>(user.app_metadata, {}),
    last_sign_in_at: new Date().toISOString(),
    created_at: new Date(user.created_at).toISOString(),
  };

  return {
    user: outUser,
    session,
    error: null,
  };
}

// Logout
export async function signOut(token: string): Promise<void> {
  const sessions = await dbQuery<any>(`SELECT user_id FROM sessions WHERE token = :token LIMIT 1`, { token });
  const session = sessions[0];
  await dbQuery(`DELETE FROM sessions WHERE token = :token`, { token });
  if (session?.user_id) {
    await dbQuery(
      `INSERT INTO auth_audit_log (id, user_id, event_type, created_at) VALUES (:id, :user_id, :event_type, NOW(3))`,
      { id: randomUUID(), user_id: session.user_id, event_type: 'logout' }
    );
  }
}

// Conferma email - NON PIÙ USATA (utenti attivi di default)
// Mantenuta per retrocompatibilità ma non necessaria
export async function confirmEmail(_token: string): Promise<boolean> {
  // Gli utenti sono già attivi alla registrazione
  return true;
}

// Richiedi reset password
export async function requestPasswordReset(email: string): Promise<{ token: string | null; error: string | null }> {
  const users = await dbQuery<any>(`SELECT * FROM users WHERE email = :email AND is_active = 1 LIMIT 1`, { email: email.toLowerCase() });
  const user = users[0];
  if (!user) {
    // Per sicurezza, non rivelare se l'email esiste o meno
    return { token: null, error: null };
  }

  const recoveryToken = generateToken();
  await dbQuery(
    `UPDATE users SET recovery_token = :token, recovery_sent_at = NOW(3) WHERE id = :id`,
    { token: recoveryToken, id: user.id }
  );
  await dbQuery(
    `INSERT INTO auth_audit_log (id, user_id, event_type, created_at) VALUES (:id, :user_id, :event_type, NOW(3))`,
    { id: randomUUID(), user_id: user.id, event_type: 'password_reset_requested' }
  );

  return { token: recoveryToken, error: null };
}

// Reset password
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const users = await dbQuery<any>(`SELECT * FROM users WHERE recovery_token = :token LIMIT 1`, { token });
  const user = users[0];
  if (!user) {
    return false;
  }

  // Verifica che il token non sia scaduto (24 ore)
  const sentAt = new Date(user.recovery_sent_at);
  const now = new Date();
  const hoursDiff = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    return false;
  }

  // Aggiorna password
  const passwordHash = hashPassword(newPassword);
  await dbQuery(
    `UPDATE users SET password_hash = :hash, recovery_token = NULL, recovery_sent_at = NULL WHERE id = :id`,
    { hash: passwordHash, id: user.id }
  );
  await dbQuery(`DELETE FROM sessions WHERE user_id = :id`, { id: user.id });
  await dbQuery(
    `INSERT INTO auth_audit_log (id, user_id, event_type, created_at) VALUES (:id, :user_id, :event_type, NOW(3))`,
    { id: randomUUID(), user_id: user.id, event_type: 'password_reset_completed' }
  );

  return true;
}

// Aggiorna utente
export async function updateUser(
  userId: string,
  updates: {
    email?: string;
    password?: string;
    first_name?: string;
    last_name?: string;
    user_metadata?: Record<string, unknown>;
  }
): Promise<{ user: User | null; error: string | null }> {
  const updateData: Record<string, unknown> = {};

  if (updates.email) {
    // Verifica che la nuova email non sia già in uso
    const existing = await dbQuery<any>(
      `SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1`,
      { email: updates.email.toLowerCase(), id: userId }
    );
    if (existing[0]) {
      return { user: null, error: 'Email già in uso' };
    }

    updateData.email = updates.email.toLowerCase();
    updateData.email_verified = false; // Richiede nuova verifica
  }

  if (updates.password) {
    updateData.password_hash = hashPassword(updates.password);
  }

  if (updates.first_name !== undefined) {
    updateData.first_name = updates.first_name;
  }

  if (updates.last_name !== undefined) {
    updateData.last_name = updates.last_name;
  }

  if (updates.user_metadata) {
    updateData.user_metadata = updates.user_metadata;
  }

  const sets: string[] = [];
  const params: Record<string, any> = { id: userId };
  for (const [k, v] of Object.entries(updateData)) {
    sets.push(`${k} = :${k}`);
    params[k] = k === 'user_metadata' ? JSON.stringify(v) : v;
  }
  if (sets.length === 0) {
    const current = await getUserById(userId);
    return { user: current, error: null };
  }

  await dbQuery(`UPDATE users SET ${sets.join(', ')} WHERE id = :id`, params);
  await dbQuery(
    `INSERT INTO auth_audit_log (id, user_id, event_type, metadata, created_at)
     VALUES (:id, :user_id, :event_type, :metadata, NOW(3))`,
    { id: randomUUID(), user_id: userId, event_type: 'user_updated', metadata: JSON.stringify({ fields: Object.keys(updateData) }) }
  );

  const updated = await getUserById(userId);
  return { user: updated, error: null };
}

// Ottieni utente da ID
export async function getUserById(userId: string): Promise<User | null> {
  const users = await dbQuery<any>(`SELECT * FROM users WHERE id = :id AND is_active = 1 LIMIT 1`, { id: userId });
  const u = users[0];
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    email_verified: Boolean(u.email_verified),
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    user_metadata: parseJsonMaybe<Record<string, unknown>>(u.user_metadata, {}),
    app_metadata: parseJsonMaybe<Record<string, unknown>>(u.app_metadata, {}),
    last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
    created_at: new Date(u.created_at).toISOString(),
  };
}

// Lista tutti gli utenti (solo per admin)
export async function listUsers(): Promise<User[]> {
  const users = await dbQuery<any>(`SELECT * FROM users ORDER BY created_at DESC`);
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    email_verified: Boolean(u.email_verified),
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    user_metadata: parseJsonMaybe<Record<string, unknown>>(u.user_metadata, {}),
    app_metadata: parseJsonMaybe<Record<string, unknown>>(u.app_metadata, {}),
    last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
    created_at: new Date(u.created_at).toISOString(),
  }));
}
