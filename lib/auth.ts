import { createHash, randomBytes } from 'crypto';
import { getServiceSupabaseClient } from './supabaseServer';

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
  const supabase = getServiceSupabaseClient();
  
  const token = generateToken();
  const refreshToken = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 giorni

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      token,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
      user_agent: userAgent,
      ip_address: ipAddress,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data as Session;
}

// Verifica token e ottieni sessione
export async function getSessionFromToken(token: string): Promise<{ user: User; session: Session } | null> {
  const supabase = getServiceSupabaseClient();

  // Ottieni sessione
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (sessionError || !session) {
    return null;
  }

  // Ottieni utente
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .eq('is_active', true)
    .single();

  if (userError || !user) {
    return null;
  }

  // Aggiorna last_activity_at
  await supabase
    .from('sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', session.id);

  return {
    user: user as User,
    session: session as Session,
  };
}

// Registra utente (senza conferma email - attivo immediatamente)
export async function signUp(
  email: string,
  password: string,
  metadata?: { first_name?: string; last_name?: string }
): Promise<AuthResult> {
  const supabase = getServiceSupabaseClient();

  // Verifica se email esiste già
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    return {
      user: null,
      session: null,
      error: 'Email già registrata',
    };
  }

  // Crea utente ATTIVO (email_verified = true, confirmed_at = now)
  const passwordHash = hashPassword(password);

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      email_verified: true, // Attivo subito senza conferma
      confirmed_at: new Date().toISOString(), // Confermato automaticamente
      first_name: metadata?.first_name,
      last_name: metadata?.last_name,
      user_metadata: metadata || {},
    })
    .select()
    .single();

  if (userError || !user) {
    return {
      user: null,
      session: null,
      error: userError?.message || 'Errore durante la registrazione',
    };
  }

  // Log audit
  await supabase.from('auth_audit_log').insert({
    user_id: user.id,
    event_type: 'signup',
  });

  return {
    user: user as User,
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
  const supabase = getServiceSupabaseClient();

  // Ottieni utente
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .single();

  if (userError || !user) {
    // Log tentativo fallito
    await supabase.from('auth_audit_log').insert({
      event_type: 'login_failed',
      ip_address: ipAddress,
      metadata: { email, reason: 'user_not_found' },
    });

    return {
      user: null,
      session: null,
      error: 'Email o password non corretti',
    };
  }

  // Verifica password
  if (!verifyPassword(password, user.password_hash)) {
    // Log tentativo fallito
    await supabase.from('auth_audit_log').insert({
      user_id: user.id,
      event_type: 'login_failed',
      ip_address: ipAddress,
      metadata: { reason: 'wrong_password' },
    });

    return {
      user: null,
      session: null,
      error: 'Email o password non corretti',
    };
  }

  // Crea sessione
  const session = await createSession(user.id, userAgent, ipAddress);

  // Aggiorna last_sign_in_at
  await supabase
    .from('users')
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq('id', user.id);

  // Log successo
  await supabase.from('auth_audit_log').insert({
    user_id: user.id,
    event_type: 'login_success',
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return {
    user: user as User,
    session,
    error: null,
  };
}

// Logout
export async function signOut(token: string): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('token', token)
    .single();

  // Elimina sessione
  await supabase.from('sessions').delete().eq('token', token);

  // Log
  if (session) {
    await supabase.from('auth_audit_log').insert({
      user_id: session.user_id,
      event_type: 'logout',
    });
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
  const supabase = getServiceSupabaseClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .single();

  if (error || !user) {
    // Per sicurezza, non rivelare se l'email esiste o meno
    return { token: null, error: null };
  }

  const recoveryToken = generateToken();

  await supabase
    .from('users')
    .update({
      recovery_token: recoveryToken,
      recovery_sent_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // Log
  await supabase.from('auth_audit_log').insert({
    user_id: user.id,
    event_type: 'password_reset_requested',
  });

  return { token: recoveryToken, error: null };
}

// Reset password
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const supabase = getServiceSupabaseClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('recovery_token', token)
    .single();

  if (error || !user) {
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

  await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
      recovery_token: null,
      recovery_sent_at: null,
    })
    .eq('id', user.id);

  // Elimina tutte le sessioni esistenti per sicurezza
  await supabase.from('sessions').delete().eq('user_id', user.id);

  // Log
  await supabase.from('auth_audit_log').insert({
    user_id: user.id,
    event_type: 'password_reset_completed',
  });

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
  const supabase = getServiceSupabaseClient();

  const updateData: Record<string, unknown> = {};

  if (updates.email) {
    // Verifica che la nuova email non sia già in uso
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', updates.email.toLowerCase())
      .neq('id', userId)
      .single();

    if (existing) {
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

  const { data: user, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error || !user) {
    return { user: null, error: error?.message || 'Errore durante l\'aggiornamento' };
  }

  // Log
  await supabase.from('auth_audit_log').insert({
    user_id: userId,
    event_type: 'user_updated',
    metadata: { fields: Object.keys(updateData) },
  });

  return { user: user as User, error: null };
}

// Ottieni utente da ID
export async function getUserById(userId: string): Promise<User | null> {
  const supabase = getServiceSupabaseClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('is_active', true)
    .single();

  if (error || !user) {
    return null;
  }

  return user as User;
}

// Lista tutti gli utenti (solo per admin)
export async function listUsers(): Promise<User[]> {
  const supabase = getServiceSupabaseClient();

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !users) {
    return [];
  }

  return users as User[];
}
