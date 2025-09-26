'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Verifica che le variabili d'ambiente esistano
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton client per il browser
let supabaseInstance: SupabaseClient | null = null;

// Funzione per creare/ottenere il client Supabase
export function getSupabaseClient(): SupabaseClient | null {
  // Durante SSR, ritorna null
  if (typeof window === 'undefined') {
    return null;
  }

  // Se non abbiamo le variabili d'ambiente, ritorna null
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    return null;
  }

  // Crea il client solo se non esiste già (singleton pattern)
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseInstance;
}

// Hook per usare Supabase in modo sicuro nei componenti
export function useSupabase(): SupabaseClient {
  const client = getSupabaseClient();
  
  if (!client) {
    throw new Error('Supabase client not available. Make sure environment variables are set and component is rendered on client side.');
  }
  
  return client;
}

// Hook per ottenere il client in modo safe (ritorna null se non disponibile)
export function useSupabaseSafe(): SupabaseClient | null {
  return getSupabaseClient();
}

// Tipi utili
export type { User, SupabaseClient } from '@supabase/supabase-js';