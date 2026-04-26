'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ToastProvider, useToast } from '../../../components/Toaster';
import { NewsletterModal } from '../../../components/NewsletterModal';
import { EmailGate } from '../_components/EmailGate';
import { AppLayout } from '../../../components/layout/AppLayout';
import { getStoredSession, signOut } from '../../../lib/authClient';

function NewsletterInner({ userId }: { userId: string }) {
  const { push } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const canOpenModal = useMemo(() => !loadingCount && clientCount > 0, [loadingCount, clientCount]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoadingCount(true);
      try {
        const session = getStoredSession();
        const token = session?.token;
        if (!token) throw new Error('Sessione non valida');

        const res = await fetch('/api/clients', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Errore caricamento clienti');
        const json = (await res.json()) as { clients?: { email?: string | null }[] };
        if (!cancelled) {
          const count = (json.clients ?? []).filter((c) => c.email?.trim()).length;
          setClientCount(count);
        }
      } catch (e: unknown) {
        if (!cancelled) push('error', e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingCount(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, push]);

  const handleSendNewsletter = useCallback(
    async (templateId: string) => {
      const session = getStoredSession();
      const token = session?.token;
      if (!token) {
        push('error', 'Sessione non valida.');
        return;
      }

      setSending(true);
      try {
        const res = await fetch('/api/email/newsletter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ template_id: templateId }),
        });

        const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
        if (!res.ok) throw new Error(json.error ?? 'Invio fallito');

        push('success', json.message ?? 'Newsletter inviata.');
        setModalOpen(false);
      } catch (e: unknown) {
        push('error', e instanceof Error ? e.message : String(e));
      } finally {
        setSending(false);
      }
    },
    [push]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="space-y-2">
        <Link href="/email" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <span aria-hidden>←</span>
          Email
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Newsletter</h1>
          <p className="text-sm text-muted">Invio massivo in BCC usando un template email.</p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface/60 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-foreground font-semibold">Destinatari</p>
            <p className="text-sm text-muted">
              {loadingCount ? 'Caricamento…' : `${clientCount} contatti con email`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canOpenModal || sending}
            onClick={() => setModalOpen(true)}
          >
            Newsletter
          </button>
        </div>
      </section>

      <NewsletterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSend={handleSendNewsletter}
        clientCount={clientCount}
        sending={sending}
      />
    </div>
  );
}

function NewsletterPageInner() {
  const router = useRouter();
  return (
    <EmailGate title="Newsletter · Bitora CRM">
      {({ user }) => (
        <AppLayout
          user={user}
          onLogout={async () => {
            await signOut();
            router.push('/');
          }}
        >
          <NewsletterInner userId={user.id} />
        </AppLayout>
      )}
    </EmailGate>
  );
}

export default function NewsletterPage() {
  return (
    <ToastProvider>
      <NewsletterPageInner />
    </ToastProvider>
  );
}
