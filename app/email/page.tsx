'use client';

import Link from 'next/link';
import React from 'react';
import { useRouter } from 'next/navigation';

import { ToastProvider } from '../../components/Toaster';
import { EmailGate } from './_components/EmailGate';
import { AppLayout } from '../../components/layout/AppLayout';
import { useSupabaseSafe } from '../../lib/supabase';
import { signOut as authSignOut } from '../../lib/authClient';

function EmailHub() {
  const supabase = useSupabaseSafe();
  const router = useRouter();
  return (
    <EmailGate title="Email · Bitora CRM">
      {({ user }) => (
        <AppLayout
          user={user}
          onLogout={async () => {
            await authSignOut();
            router.push('/');
          }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold text-foreground">Email</h1>
              <p className="text-sm text-muted">Scegli cosa vuoi gestire: newsletter o contatti.</p>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface/60 p-6 space-y-4">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Newsletter</h2>
                  <p className="text-sm text-muted">Invio massivo in BCC usando un template.</p>
                </div>
                <div className="flex items-center justify-end">
                  <Link href="/email/newsletter" className="btn btn-primary">
                    Vai a Newsletter
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-6 space-y-4">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Contatti</h2>
                  <p className="text-sm text-muted">Invio singolo o multiplo a uno o più contatti.</p>
                </div>
                <div className="flex items-center justify-end">
                  <Link href="/email/contatti" className="btn btn-primary">
                    Vai a Contatti
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-6 space-y-4">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Template</h2>
                  <p className="text-sm text-muted">Crea e gestisci i template con anteprima e variabili.</p>
                </div>
                <div className="flex items-center justify-end">
                  <Link href="/email/templates" className="btn btn-primary">
                    Gestisci Template
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </AppLayout>
      )}
    </EmailGate>
  );
}

export default function EmailPage() {
  return (
    <ToastProvider>
      <EmailHub />
    </ToastProvider>
  );
}
