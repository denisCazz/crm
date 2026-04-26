import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/mysql";

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

    if (!address) {
      await dbQuery(`UPDATE clients SET lat = NULL, lon = NULL WHERE id = :id AND owner_id = :owner_id`, { id, owner_id });
      return NextResponse.json({ ok: true, lat: null, lon: null });
    }

    const coords: Coords = await fetchCoords(address);

    if (coords) {
      await dbQuery(
        `UPDATE clients SET lat = :lat, lon = :lon WHERE id = :id AND owner_id = :owner_id`,
        { id, owner_id, lat: coords.lat, lon: coords.lon }
      );
    }

    return NextResponse.json({ ok: true, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
