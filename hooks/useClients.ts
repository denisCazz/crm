import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '../components/Toaster';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Client = {
  id: string;
  owner_id: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export function useClients(user: User) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    loadClients();
  }, [user.id]);

  const loadClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Errore nel caricamento";
      setError(errorMessage);
      push("error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'owner_id'>) => {
    try {
      const insert = {
        owner_id: user.id,
        first_name: clientData.first_name || null,
        last_name: clientData.last_name || null,
        address: clientData.address || null,
        notes: clientData.notes || null,
      };

      const { data, error } = await supabase
        .from("clients")
        .insert(insert)
        .select("*")
        .single();

      if (error) throw error;

      // Geocode se c'è indirizzo
      if (data?.address) {
        await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id, address: data.address, owner_id: data.owner_id }),
        });
      }

      setClients(prev => [data as Client, ...prev]);
      push("success", "Cliente creato con successo!");
      return data as Client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Errore nella creazione";
      push("error", errorMessage);
      throw error;
    }
  };

  const updateClient = async (clientId: string, clientData: Partial<Omit<Client, 'id' | 'created_at' | 'owner_id'>>) => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .update({
          first_name: clientData.first_name || null,
          last_name: clientData.last_name || null,
          address: clientData.address || null,
          notes: clientData.notes || null,
        })
        .eq("id", clientId)
        .select("*")
        .single();

      if (error) throw error;

      // Geocode se l'indirizzo è cambiato
      const oldClient = clients.find(c => c.id === clientId);
      if (data && data.address !== oldClient?.address) {
        await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id, address: data.address, owner_id: data.owner_id }),
        });
      }

      setClients(prev => 
        prev.map(c => c.id === clientId ? data as Client : c)
      );
      push("success", "Cliente aggiornato con successo!");
      return data as Client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Errore nell'aggiornamento";
      push("error", errorMessage);
      throw error;
    }
  };

  const deleteClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);

      if (error) throw error;

      setClients(prev => prev.filter(c => c.id !== clientId));
      push("success", "Cliente eliminato con successo!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Errore nell'eliminazione";
      push("error", errorMessage);
      throw error;
    }
  };

  return {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    deleteClient,
    refetch: loadClients
  };
}