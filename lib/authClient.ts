'use client';

import type { User, Session } from './auth';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

// Salva sessione nel localStorage
export function saveSession(session: Session): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('bitora_session', JSON.stringify(session));
}

// Ottieni sessione dal localStorage
export function getStoredSession(): Session | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('bitora_session');
    if (!stored) return null;
    
    const session = JSON.parse(stored) as Session;
    
    // Verifica se la sessione è scaduta
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    clearSession();
    return null;
  }
}

// Rimuovi sessione
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('bitora_session');
  localStorage.removeItem('bitora_user');
}

// Salva utente
export function saveUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('bitora_user', JSON.stringify(user));
}

// Ottieni utente salvato
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('bitora_user');
    if (!stored) return null;
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
}

// Hook per verificare la sessione
export async function verifySession(): Promise<{ user: User; session: Session } | null> {
  const session = getStoredSession();
  if (!session) return null;

  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`,
      },
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const data = await response.json();
    
    if (data.user && data.session) {
      saveUser(data.user);
      saveSession(data.session);
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

// Login
export async function signIn(email: string, password: string): Promise<{ user: User; session: Session } | { error: string }> {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Errore durante il login' };
    }

    if (data.user && data.session) {
      saveUser(data.user);
      saveSession(data.session);
      return { user: data.user, session: data.session };
    }

    return { error: 'Risposta non valida dal server' };
  } catch {
    return { error: 'Errore di connessione' };
  }
}

// Registrazione
export async function signUp(
  email: string,
  password: string,
  metadata?: { first_name?: string; last_name?: string }
): Promise<{ user: User } | { error: string }> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, metadata }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Errore durante la registrazione' };
    }

    return { user: data.user };
  } catch {
    return { error: 'Errore di connessione' };
  }
}

// Logout
export async function signOut(): Promise<void> {
  const session = getStoredSession();
  
  if (session) {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
    } catch {
      // Ignora errori di rete
    }
  }

  clearSession();
}

// Reset password
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Errore durante la richiesta' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Errore di connessione' };
  }
}

// Conferma reset password
export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/reset-password/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password: newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Errore durante il reset' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Errore di connessione' };
  }
}

// Aggiorna utente
export async function updateUser(updates: {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<{ user: User } | { error: string }> {
  const session = getStoredSession();
  if (!session) {
    return { error: 'Sessione non valida' };
  }

  try {
    const response = await fetch('/api/auth/user', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Errore durante l\'aggiornamento' };
    }

    if (data.user) {
      saveUser(data.user);
      return { user: data.user };
    }

    return { error: 'Risposta non valida dal server' };
  } catch {
    return { error: 'Errore di connessione' };
  }
}
