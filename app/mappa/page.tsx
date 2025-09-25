"use client";
import Link from "next/link";
import NextDynamic from "next/dynamic";

export const dynamic = "force-dynamic"; // evita prerender statico

// carica la mappa solo sul client (no SSR → niente errori 'window is not defined')
const LeafletMap = NextDynamic(() => import("../../components/LeafletMap"), { ssr: false });

export default function MappaPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header con navigazione */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-semibold">Mappa clienti</h1>
          <Link
            href="/"
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm"
          >
            ← Torna alla Home
          </Link>
        </div>

        <LeafletMap />
      </div>
    </div>
  );
}
