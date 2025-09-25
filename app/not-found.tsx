"use client";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-6">
      <section
        aria-labelledby="notfound-title"
        className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-lg"
      >
        <h1 id="notfound-title" className="text-2xl font-semibold tracking-tight">
          Pagina non trovata
        </h1>
        <p className="mt-2 text-neutral-400">
          La risorsa che stai cercando potrebbe essere stata rimossa, rinominata o non è disponibile.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/"
            className="inline-flex justify-center rounded-xl bg-white/90 px-4 py-2.5 font-medium text-black hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            ← Torna alla Home
          </Link>

          <button
            type="button"
            onClick={() => history.back()}
            className="inline-flex justify-center rounded-xl bg-neutral-800 px-4 py-2.5 text-neutral-100 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-700"
          >
            Indietro
          </button>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Codice errore: <span className="font-mono">404</span>
        </p>
      </section>
    </main>
  );
}
