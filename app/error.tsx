// app/error.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Qui puoi loggare su Sentry/console
    // console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-6">
      <section
        aria-labelledby="error-title"
        className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-lg"
      >
        <h1 id="error-title" className="text-2xl font-semibold tracking-tight">
          Qualcosa è andato storto
        </h1>
        <p className="mt-2 text-neutral-400">
          Si è verificato un errore inatteso. Puoi riprovare oppure tornare alla home.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex justify-center rounded-xl bg-white/90 px-4 py-2.5 font-medium text-black hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            Riprova
          </button>

          <Link
            href="/"
            className="inline-flex justify-center rounded-xl bg-neutral-800 px-4 py-2.5 text-neutral-100 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-700"
          >
            ← Torna alla Home
          </Link>
        </div>

        <div className="mt-4 space-y-1">
          {error?.message && (
            <p className="text-xs text-neutral-500 break-words">
              Dettagli: <span className="font-mono">{error.message}</span>
            </p>
          )}
          {error?.digest && (
            <p className="text-xs text-neutral-500">
              Codice riferimento: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
