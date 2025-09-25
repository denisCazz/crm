import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";          // garantisce runtime Node
export const dynamic = "force-dynamic";   // niente cache

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // chiave server: NON pubblica
);

async function fetchCoords(address: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "mini-crm/1.0 (contact@example.com)" },
    // rispetta i termini d'uso; non abusare
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as any[];
  if (!arr?.length) return null;
  return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) };
}

export async function POST(req: NextRequest) {
  try {
    const { id, address, owner_id } = await req.json();
    if (!id || !owner_id) {
      return NextResponse.json({ error: "Missing id/owner_id" }, { status: 400 });
    }

    // Se non c'è indirizzo, azzera le coords
    if (!address) {
      await supabase.from("clients").update({ lat: null, lon: null }).eq("id", id).eq("owner_id", owner_id);
      return NextResponse.json({ ok: true, lat: null, lon: null });
    }

    // Prova cache
    const { data: cached } = await supabase
      .from("geocode_cache")
      .select("lat, lon")
      .eq("addr", address)
      .maybeSingle();

    let coords = cached ?? (await fetchCoords(address));

    // salva cache se necessario
    if (!cached && coords) {
      await supabase.from("geocode_cache").upsert({ addr: address, lat: coords.lat, lon: coords.lon });
    }

    // aggiorna il cliente (owner-safe)
    if (coords) {
      await supabase
        .from("clients")
        .update({ lat: coords.lat, lon: coords.lon })
        .eq("id", id)
        .eq("owner_id", owner_id);
    }

    return NextResponse.json({ ok: true, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
