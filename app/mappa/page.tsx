"use client";
import NextDynamic from "next/dynamic";

export const dynamic = "force-dynamic"; // <-- deve chiamarsi esattamente così (per Next)

const LeafletMap = NextDynamic(() => import("../../components/LeafletMap"), {
  ssr: false, // disabilita SSR per Leaflet
});

export default function MappaPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Mappa clienti</h1>
        <LeafletMap />
      </div>
    </div>
  );
}
