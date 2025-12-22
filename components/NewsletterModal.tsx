'use client';

import React, { useEffect, useState } from 'react';
import { useSupabaseSafe } from '../lib/supabase';
import type { EmailTemplate } from '../types';

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (templateId: string) => Promise<void>;
  clientCount: number;
  sending: boolean;
}

export function NewsletterModal({ isOpen, onClose, onSend, clientCount, sending }: NewsletterModalProps) {
  const supabase = useSupabaseSafe();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    if (!isOpen || !supabase) return;

    const fetchTemplates = async () => {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('owner_id', session.session.user.id)
        .order('name', { ascending: true });

      if (!error && data) {
        setTemplates(data as EmailTemplate[]);
        if (data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
        }
      }
      setLoading(false);
    };

    fetchTemplates();
  }, [isOpen, supabase, selectedTemplateId]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedTemplateId) return;
    await onSend(selectedTemplateId);
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-lg animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Invia Newsletter</h2>
              <p className="text-sm text-muted">Invia un&apos;email a tutti i tuoi clienti</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Info */}
          <div className="card p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {clientCount} destinatari
                </p>
                <p className="text-xs text-muted mt-0.5">
                  L&apos;email verrà inviata in BCC a tutti i clienti con email
                </p>
              </div>
            </div>
          </div>

          {/* Template Selection */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="card p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-warning/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-foreground font-medium">Nessun template disponibile</p>
              <p className="text-sm text-muted mt-1">
                Crea un template email dalla pagina <a href="/email" className="text-primary hover:underline">Invia Email</a>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Seleziona Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="input-field"
              >
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {/* Preview */}
              {selectedTemplate && (
                <div className="card p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Anteprima</p>
                  <p className="text-sm font-medium text-foreground">
                    Oggetto: {selectedTemplate.subject}
                  </p>
                  <div 
                    className="text-sm text-muted line-clamp-3 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: selectedTemplate.body_html.substring(0, 200) + '...' 
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="card p-4 bg-warning/5 border-warning/20">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-warning flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-foreground">
                <strong>Attenzione:</strong> Le variabili personalizzate (es. {"{{first_name}}"}) non funzioneranno in modalità newsletter BCC.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-surface-elevated rounded-b-2xl">
          <button onClick={onClose} className="btn btn-secondary">
            Annulla
          </button>
          <button 
            onClick={handleSend}
            disabled={!selectedTemplateId || sending || templates.length === 0}
            className="btn btn-primary"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Invio in corso...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Invia a {clientCount} clienti
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
