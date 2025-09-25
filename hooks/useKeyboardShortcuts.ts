import { useEffect, useCallback } from 'react';

export interface KeyboardShortcuts {
  search?: () => void;
  newClient?: () => void;
  closeModal?: () => void;
  save?: () => void;
  cancel?: () => void;
}

export function useKeyboardShortcuts(callbacks: KeyboardShortcuts, enabled: boolean = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignora se l'utente sta scrivendo in un input, textarea o elemento contenteditable
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.contentEditable === 'true';

    // Ctrl/Cmd + K per la ricerca
    if ((event.ctrlKey || event.metaKey) && event.key === 'k' && !isInputField) {
      event.preventDefault();
      callbacks.search?.();
    }

    // Ctrl/Cmd + N per nuovo cliente (solo se non in un input field)
    if ((event.ctrlKey || event.metaKey) && event.key === 'n' && !isInputField) {
      event.preventDefault();
      callbacks.newClient?.();
    }

    // ESC per chiudere modali
    if (event.key === 'Escape') {
      callbacks.closeModal?.();
    }

    // Ctrl/Cmd + S per salvare (quando disponibile)
    if ((event.ctrlKey || event.metaKey) && event.key === 's' && callbacks.save) {
      event.preventDefault();
      callbacks.save();
    }

    // Ctrl/Cmd + Escape per annullare (quando disponibile)
    if ((event.ctrlKey || event.metaKey) && event.key === 'Escape' && callbacks.cancel) {
      event.preventDefault();
      callbacks.cancel();
    }
  }, [callbacks, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Hook specifico per gestire shortcuts nei modali
export function useModalShortcuts(isOpen: boolean, onSave?: () => void, onClose?: () => void) {
  useKeyboardShortcuts({
    save: onSave,
    closeModal: onClose,
    cancel: onClose
  }, isOpen);
}

// Hook per gestire shortcuts globali dell'app
export function useAppShortcuts(searchFocusCallback: () => void, newClientCallback: () => void) {
  useKeyboardShortcuts({
    search: searchFocusCallback,
    newClient: newClientCallback
  });
}