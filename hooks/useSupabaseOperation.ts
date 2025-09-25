import { useState, useCallback } from 'react';
import { useToast } from '../components/Toaster';

export function useSupabaseOperation() {
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  const execute = useCallback(async <T>(
    operation: () => Promise<T>,
    successMessage?: string,
    errorMessage?: string
  ): Promise<T | null> => {
    setLoading(true);
    try {
      const result = await operation();
      if (successMessage) {
        push("success", successMessage);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : (errorMessage || "Operazione fallita");
      push("error", message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [push]);

  return { execute, loading };
}