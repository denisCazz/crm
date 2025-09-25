"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fix icone Leaflet in Next (CDN ufficiale)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  notes: string | null;
  lat: number | null;
  lon: number | null;
};

export default function MappaClienti() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, address, notes, lat, lon")
        .not("lat", "is", null)
        .not("lon", "is", null);

      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  const center: [number, number] =
    rows.length ? [rows[0].lat as number, rows[0].lon as number] : [45.0703, 7.6869]; // Torino fallback

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Mappa clienti</h1>

        <div className="rounded-2xl overflow-hidden border border-neutral-800">
          <MapContainer center={center} zoom={8} style={{ height: "70vh", width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!loading &&
              rows.map((c) => (
                <Marker key={c.id} position={[c.lat!, c.lon!]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-medium">
                        {(c.first_name ?? "") + " " + (c.last_name ?? "")}
                      </div>
                      {c.address && (
                        <div className="mt-1">
                          <a
                            className="underline"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                          >
                            Apri in Maps
                          </a>
                        </div>
                      )}
                      {c.notes && <div className="mt-2 opacity-80 max-w-[40ch]">{c.notes}</div>}
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        {loading && <div className="mt-3 text-neutral-400">Caricamento mappa…</div>}
      </div>
    </div>
  );
}
