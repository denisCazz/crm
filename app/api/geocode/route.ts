import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Coords = { lat: number; lon: number } | null;
type NominatimItem = { lat: string; lon: string };

async function fetchCoords(address: string): Promise<Coords> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "mini-crm/1.0 (contact@example.com)" },
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as NominatimItem[];
  if (!arr?.length) return null;
  const lat = Number(arr[0].lat);
  const lon = Number(arr[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

export async function POST(req: NextRequest) {
  try {
    const { id, address, owner_id } = (await req.json()) as {
      id?: string;
      address?: string;
      owner_id?: string;
    };
    if (!id || !owner_id) {
      return NextResponse.json({ error: "Missing id/owner_id" }, { status: 400 });
    }

    // ✅ CREA IL CLIENT QUI (a runtime, non a import-time)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return NextResponse.json({ error: "Server env not set" }, { status: 500 });
    }
    const supabase: SupabaseClient = createClient(url, service);

    if (!address) {
      await supabase.from("clients").update({ lat: null, lon: null }).eq("id", id).eq("owner_id", owner_id);
      return NextResponse.json({ ok: true, lat: null, lon: null });
    }

    // cache
    const { data: cached } = await supabase
      .from("geocode_cache")
      .select("lat, lon")
      .eq("addr", address)
      .maybeSingle<{ lat: number | null; lon: number | null }>();

    const coords: Coords =
      cached?.lat != null && cached?.lon != null ? { lat: cached.lat, lon: cached.lon } : await fetchCoords(address);

    if (coords) {
      if (!cached) {
        await supabase.from("geocode_cache").upsert({ addr: address, lat: coords.lat, lon: coords.lon });
      }
      await supabase.from("clients").update({ lat: coords.lat, lon: coords.lon }).eq("id", id).eq("owner_id", owner_id);
    }

    return NextResponse.json({ ok: true, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
