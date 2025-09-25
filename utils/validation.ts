// Nota: Richiede 'npm install zod' per funzionare
// Per ora usando validazione semplificata senza Zod

export interface ClientFormData {
  first_name: string;
  last_name: string;
  address?: string;
  notes?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateClient(data: unknown): { success: boolean; data?: ClientFormData; errors?: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  if (typeof data !== 'object' || data === null) {
    return { success: false, errors: [{ field: 'general', message: 'Dati non validi' }] };
  }

  const formData = data as Record<string, unknown>;

  // Validazione first_name
  if (!formData.first_name || typeof formData.first_name !== 'string' || formData.first_name.trim().length === 0) {
    errors.push({ field: 'first_name', message: 'Il nome è obbligatorio' });
  } else if (formData.first_name.length > 50) {
    errors.push({ field: 'first_name', message: 'Il nome è troppo lungo (max 50 caratteri)' });
  }

  // Validazione last_name
  if (!formData.last_name || typeof formData.last_name !== 'string' || formData.last_name.trim().length === 0) {
    errors.push({ field: 'last_name', message: 'Il cognome è obbligatorio' });
  } else if (formData.last_name.length > 50) {
    errors.push({ field: 'last_name', message: 'Il cognome è troppo lungo (max 50 caratteri)' });
  }

  // Validazione address (opzionale)
  if (formData.address && typeof formData.address === 'string' && formData.address.length > 200) {
    errors.push({ field: 'address', message: 'L\'indirizzo è troppo lungo (max 200 caratteri)' });
  }

  // Validazione notes (opzionale)
  if (formData.notes && typeof formData.notes === 'string' && formData.notes.length > 1000) {
    errors.push({ field: 'notes', message: 'Le note sono troppo lunghe (max 1000 caratteri)' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      first_name: (formData.first_name as string).trim(),
      last_name: (formData.last_name as string).trim(),
      address: formData.address ? (formData.address as string).trim() : undefined,
      notes: formData.notes ? (formData.notes as string).trim() : undefined,
    }
  };
}

// Hook per gestire validazione in tempo reale
export function useFormValidation() {
  const validateField = (field: keyof ClientFormData, value: string): string | null => {
    switch (field) {
      case 'first_name':
        if (!value.trim()) return 'Il nome è obbligatorio';
        if (value.length > 50) return 'Nome troppo lungo (max 50 caratteri)';
        return null;
      
      case 'last_name':
        if (!value.trim()) return 'Il cognome è obbligatorio';
        if (value.length > 50) return 'Cognome troppo lungo (max 50 caratteri)';
        return null;
      
      case 'address':
        if (value.length > 200) return 'Indirizzo troppo lungo (max 200 caratteri)';
        return null;
      
      case 'notes':
        if (value.length > 1000) return 'Note troppo lunghe (max 1000 caratteri)';
        return null;
      
      default:
        return null;
    }
  };

  return { validateField };
}