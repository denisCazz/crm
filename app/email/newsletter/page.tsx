'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ToastProvider, useToast } from '../../../components/Toaster';
import { NewsletterModal } from '../../../components/NewsletterModal';
import { useSupabaseSafe } from '../../../lib/supabase';
import { EmailGate } from '../_components/EmailGate';
import { AppLayout } from '../../../components/layout/AppLayout';

function NewsletterInner({ userId }: { userId: string }) {
  const supabase = useSupabaseSafe();
  const { push } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const canOpenModal = useMemo(() => !loadingCount && clientCount > 0, [loadingCount, clientCount]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;

    (async () => {
      setLoadingCount(true);
      try {
        const res = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .not('email', 'is', null);

        if (res.error) throw res.error;
        if (!cancelled) setClientCount(res.count ?? 0);
      } catch (e: unknown) {
        if (!cancelled) push('error', e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingCount(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId, push]);

  const handleSendNewsletter = useCallback(
    async (templateId: string) => {
      if (!supabase) return;

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
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
    [supabase, push]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="space-y-2">
        <Link
          href="/email"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
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
  const supabase = useSupabaseSafe();
  const router = useRouter();
  return (
    <EmailGate title="Newsletter · Bitora CRM">
      {({ user }) => (
        <AppLayout
          user={user}
          onLogout={async () => {
            if (supabase) {
              await supabase.auth.signOut();
            }
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
