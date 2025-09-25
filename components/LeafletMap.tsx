"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Supabase browser client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fix icone Leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Row = {
  id: string;
  owner_id: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  notes: string | null;
  lat: number | null;
  lon: number | null;
};

export default function LeafletMap() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [showAddressDebug, setShowAddressDebug] = useState(false);
  const [debug, setDebug] = useState<{ total: number; withAddress: number; withCoords: number } | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    // Ottieni l'utente corrente
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user?.email || null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      
      // Prima query: tutti i clienti per debug
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, owner_id, first_name, last_name, address, notes, lat, lon");
      
      if (allClients) {
        const total = allClients.length;
        const withAddress = allClients.filter(c => c.address).length;
        const withCoords = allClients.filter(c => c.lat && c.lon).length;
        setDebug({ total, withAddress, withCoords });
        
        console.log(`Debug mappa: ${total} clienti totali, ${withAddress} con indirizzo, ${withCoords} con coordinate`);
      }

      // Seconda query: solo clienti con coordinate per la mappa
      const { data, error } = await supabase
        .from("clients")
        .select("id, owner_id, first_name, last_name, address, notes, lat, lon")
        .not("lat", "is", null)
        .not("lon", "is", null);
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  const isAdmin = currentUser === 'deniscazzulo@icloud.com';

  const geocodeAllMissing = async () => {
    if (!debug || geocoding) return;
    
    setGeocoding(true);
    console.log("Avvio geocoding batch...");
    
    // Ottieni tutti i clienti con indirizzo ma senza coordinate
    const { data: clientsToGeocode } = await supabase
      .from("clients")
      .select("id, owner_id, address")
      .not("address", "is", null)
      .is("lat", null);
    
    if (!clientsToGeocode?.length) {
      console.log("Nessun cliente da geocodificare");
      setGeocoding(false);
      return;
    }
    
    console.log(`Geocoding di ${clientsToGeocode.length} clienti...`);
    
    // Geocodifica uno per uno per evitare rate limiting
    for (const client of clientsToGeocode) {
      try {
        await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            id: client.id, 
            address: client.address, 
            owner_id: client.owner_id 
          }),
        });
        
        // Piccola pausa per evitare rate limiting di Nominatim
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Errore geocoding cliente ${client.id}:`, error);
      }
    }
    
    console.log("Geocoding completato, ricarico la mappa...");
    setGeocoding(false);
    
    // Ricarica i dati della mappa
    window.location.reload();
  };

  const AddressDebugPanel = () => {
    const [allClients, setAllClients] = useState<Row[]>([]);
    const [testResults, setTestResults] = useState<Record<string, { found: boolean; suggestions: string[]; tested: string[] }>>({});
    const [processingClient, setProcessingClient] = useState<string | null>(null);

    useEffect(() => {
      (async () => {
        const { data } = await supabase
          .from("clients")
          .select("id, owner_id, first_name, last_name, address, lat, lon")
          .not("address", "is", null);
        if (data) setAllClients(data as Row[]);
      })();
    }, []);

    // Genera varianti intelligenti dell'indirizzo
    const generateAddressVariants = (address: string): string[] => {
      const variants: string[] = [];
      const original = address.trim();
      
      // Variante 1: Capitalizza ogni parola
      const capitalized = original.replace(/\b\w/g, l => l.toUpperCase());
      if (capitalized !== original) variants.push(capitalized);
      
      // Variante 2: Rimuovi tutto dopo la virgola (più generico)
      const beforeComma = original.split(',')[0].trim();
      if (beforeComma !== original) variants.push(beforeComma);
      
      // Variante 3: Solo città (ultima parte dopo virgola)
      const parts = original.split(',');
      if (parts.length > 1) {
        const city = parts[parts.length - 1].trim();
        if (city) variants.push(city);
      }
      
      // Variante 4: Rimuovi numeri civici
      const withoutNumber = original.replace(/\b\d+[A-Z]*\b/g, '').replace(/,\s*,/g, ',').trim();
      if (withoutNumber !== original && withoutNumber.length > 5) variants.push(withoutNumber);
      
      // Variante 5: Rimuovi CAP e province
      const withoutCap = original.replace(/\b\d{5}\b/g, '').replace(/\b(TO|CN|AL|AT|BI|NO|VB|VC)\b/gi, '').replace(/,\s*,/g, ',').trim();
      if (withoutCap !== original && withoutCap.length > 5) variants.push(withoutCap);
      
      // Variante 6: Aggiungi "Italia" se non presente
      if (!original.toLowerCase().includes('italia')) {
        variants.push(original + ', Italia');
      }
      
      return [...new Set(variants)]; // Rimuovi duplicati
    };

    const testAddressWithVariants = async (address: string, clientId: string) => {
      const variants = [address, ...generateAddressVariants(address)];
      const testedVariants: string[] = [];
      let foundVariant: string | null = null;

      for (const variant of variants) {
        testedVariants.push(variant);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(variant)}&limit=1`;
        
        try {
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.length > 0) {
            foundVariant = variant;
            break;
          }
          
          // Pausa per rispettare rate limit
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Errore test indirizzo ${variant}:`, error);
        }
      }

      setTestResults(prev => ({
        ...prev,
        [clientId]: {
          found: !!foundVariant,
          suggestions: variants.filter(v => v !== address),
          tested: testedVariants
        }
      }));

      return foundVariant;
    };

    const geocodeWithSuggestion = async (clientId: string, suggestion: string, updateAddress = false) => {
      const client = allClients.find(c => c.id === clientId);
      if (!client) return;

      setProcessingClient(clientId);

      try {
        console.log(`🔄 Geocoding ${client.first_name} ${client.last_name} con: ${suggestion}`);
        
        // Prima geocodifica con il suggerimento
        const response = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            id: clientId, 
            address: suggestion, 
            owner_id: client.owner_id
          }),
        });

        const result = await response.json();
        console.log("📡 Risposta geocoding:", result);
        
        if (response.ok && result.lat && result.lon) {
          console.log(`✅ Geocoding riuscito! Coordinate: ${result.lat}, ${result.lon}`);
          
          // Se richiesto, aggiorna anche l'indirizzo nel database
          if (updateAddress) {
            console.log(`🔄 Aggiornamento indirizzo: "${client.address}" → "${suggestion}"`);
            const { error: updateError } = await supabase
              .from("clients")
              .update({ address: suggestion })
              .eq("id", clientId)
              .eq("owner_id", client.owner_id);
              
            if (updateError) {
              console.error("❌ Errore aggiornamento indirizzo:", updateError);
            } else {
              console.log(`✅ Indirizzo aggiornato con successo`);
            }
          } else {
            console.log("📍 Solo coordinate aggiornate (indirizzo mantenuto)");
          }
          
          // Ricarica i dati
          const { data } = await supabase
            .from("clients")
            .select("id, owner_id, first_name, last_name, address, lat, lon")
            .not("address", "is", null);
          if (data) {
            setAllClients(data as Row[]);
            console.log("🔄 Dati ricaricati");
          }
          
          return true;
        } else {
          console.error("❌ Geocoding fallito:", result);
          return false;
        }
      } catch (error) {
        console.error("💥 Errore geocoding:", error);
        return false;
      } finally {
        setProcessingClient(null);
      }
    };

    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <h3 className="font-medium mb-3">🔍 Debug Indirizzi con Suggerimenti</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {allClients.map((client) => {
            const result = testResults[client.id];
            return (
              <div key={client.id} className="p-3 bg-neutral-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {client.first_name} {client.last_name}
                    </div>
                    <div className="text-xs text-neutral-400 truncate">
                      {client.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`w-3 h-3 rounded-full ${
                      client.lat && client.lon 
                        ? 'bg-green-500' 
                        : result?.found
                          ? 'bg-yellow-500' 
                          : result?.found === false
                            ? 'bg-red-500' 
                            : 'bg-neutral-600'
                    }`} />
                    <button
                      onClick={() => testAddressWithVariants(client.address!, client.id)}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded"
                      disabled={!client.address}
                    >
                      🧪 Test
                    </button>
                  </div>
                </div>
                
                {/* Suggerimenti */}
                {result && result.suggestions.length > 0 && (
                  <div className="mt-2 p-2 bg-neutral-700 rounded">
                    <div className="text-xs font-medium text-neutral-300 mb-2">
                      💡 Prova con:
                    </div>
                    <div className="space-y-1">
                      {result.suggestions.slice(0, 3).map((suggestion, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs gap-2">
                          <span className="text-neutral-400 truncate flex-1">
                            {suggestion}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => geocodeWithSuggestion(client.id, suggestion, false)}
                              disabled={processingClient === client.id}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded text-xs flex items-center gap-1"
                              title="Geocodifica solo (mantieni indirizzo originale)"
                            >
                              {processingClient === client.id ? (
                                <div className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                "📍"
                              )}
                            </button>
                            <button
                              onClick={() => geocodeWithSuggestion(client.id, suggestion, true)}
                              disabled={processingClient === client.id}
                              className="px-2 py-1 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded text-xs flex items-center gap-1"
                              title="Geocodifica e sostituisci indirizzo"
                            >
                              {processingClient === client.id ? (
                                <div className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                "✏️"
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-neutral-400">
          🟢 Geocodificato | 🟡 Trovato con test | 🔴 Non trovato | ⚫ Non testato
          <br />
          📍 Solo coordinate | ✏️ Coordinate + sostituisci indirizzo
        </div>
      </div>
    );
  };

  const center: [number, number] =
    rows.length ? [rows[0].lat as number, rows[0].lon as number] : [45.0703, 7.6869]; // Torino fallback

  return (
    <div className="space-y-4">
      {/* Debug Panel */}
      {debug && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <h3 className="font-medium mb-2">📊 Statistiche Mappa</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-neutral-400">Clienti totali:</span>
              <div className="text-lg font-medium">{debug.total}</div>
            </div>
            <div>
              <span className="text-neutral-400">Con indirizzo:</span>
              <div className="text-lg font-medium text-yellow-400">{debug.withAddress}</div>
            </div>
            <div>
              <span className="text-neutral-400">Sulla mappa:</span>
              <div className="text-lg font-medium text-green-400">{debug.withCoords}</div>
            </div>
          </div>
          {debug.withAddress > debug.withCoords && (
            <div className="mt-3 p-3 bg-yellow-950/30 border border-yellow-900 rounded-lg text-yellow-200 text-sm">
              ⚠️ {debug.withAddress - debug.withCoords} clienti con indirizzo non sono stati geocodificati.
              <div className="mt-2 flex gap-2">
                <button 
                  onClick={geocodeAllMissing}
                  disabled={geocoding}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-black rounded-lg text-xs font-medium flex items-center gap-1"
                >
                  {geocoding ? (
                    <>
                      <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Geocoding...
                    </>
                  ) : (
                    <>
                      🔄 Geocodifica tutti
                    </>
                  )}
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => setShowAddressDebug(!showAddressDebug)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
                  >
                    🔍 Debug indirizzi
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Address Debug Panel */}
      {showAddressDebug && isAdmin && (
        <AddressDebugPanel />
      )}

      <div className="rounded-2xl overflow-hidden border border-neutral-800">
      <MapContainer center={center} zoom={8} style={{ height: "70vh", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!loading && rows.map(c => (
          <Marker key={c.id} position={[c.lat!, c.lon!]}>
            <Popup>
              <div className="text-sm">
                <div className="font-medium">{(c.first_name ?? "") + " " + (c.last_name ?? "")}</div>
                {c.address && (
                  <div className="mt-1">
                    <a className="underline" target="_blank" rel="noreferrer"
                       href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}>
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
      {loading && <div className="p-3 text-neutral-400">Caricamento mappa…</div>}
      </div>
    </div>
  );
}
