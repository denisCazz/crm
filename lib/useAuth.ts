'use client';

import { useEffect, useState } from 'react';
import { verifySession, getStoredUser, getStoredSession } from './authClient';
import type { User } from './auth';

/**
 * Hook per gestire l'autenticazione nelle pagine
 * Sostituisce l'uso di supabase.auth.getSession()
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Prova prima a verificare la sessione
      const result = await verifySession();
      if (result) {
        setUser(result.user);
      } else {
        // Fallback: prova a ottenere user dal localStorage
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      }
      setLoading(false);
    };

    checkAuth();

    // Verifica periodicamente la sessione (ogni 30 secondi)
    const interval = setInterval(async () => {
      const session = getStoredSession();
      if (session) {
        const result = await verifySession();
        if (result) {
          setUser(result.user);
        } else {
          setUser(null);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return { user, loading };
}
