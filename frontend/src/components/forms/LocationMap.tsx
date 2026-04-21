"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, MapPin } from "lucide-react";

interface LocationMapProps {
  city: string;
  radius: number;
  onLocationResolved?: (lat: number, lng: number, displayName: string) => void;
}

interface GeoResult {
  lat: number;
  lng: number;
  display: string;
}

type RL = typeof import("react-leaflet");

/**
 * Imperative view-updater — uses useMap() to call setView() when geo or radius
 * change, instead of remounting the whole map via the key prop. Remounting a
 * live Leaflet map while the user is zooming causes `_leaflet_pos` races.
 */
function MapViewUpdater({ geo, radius, useMap }: { geo: GeoResult; radius: number; useMap: RL["useMap"] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    try {
      map.setView([geo.lat, geo.lng], getZoomForRadius(radius), { animate: true });
      // Ensure layout is correct after the parent resizes (fix for hidden→visible cases)
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          // Map may have been removed mid-timeout
        }
      }, 0);
    } catch {
      // Guard against transient Leaflet internals during remount
    }
  }, [geo.lat, geo.lng, radius, map]);
  return null;
}

function LeafletMap({ geo, radius }: { geo: GeoResult; radius: number }) {
  const [mod, setMod] = useState<RL | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("react-leaflet").then((m) => {
      if (!cancelled) setMod(m);
    });
    return () => { cancelled = true; };
  }, []);

  if (!mod) return <div className="w-full h-full bg-paper-alt" />;

  const { MapContainer, TileLayer, Circle, CircleMarker, useMap } = mod;
  const radiusMeters = radius * 1609.34;

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <MapContainer
        center={[geo.lat, geo.lng]}
        zoom={getZoomForRadius(radius)}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <CircleMarker
          center={[geo.lat, geo.lng]}
          radius={6}
          pathOptions={{
            fillColor: "#0071E3",
            fillOpacity: 1,
            color: "#0071E3",
            weight: 3,
            opacity: 0.25,
          }}
        />
        <Circle
          center={[geo.lat, geo.lng]}
          radius={radiusMeters}
          pathOptions={{
            fillColor: "#0071E3",
            fillOpacity: 0.06,
            color: "#0071E3",
            weight: 1.5,
            opacity: 0.4,
          }}
        />
        <MapViewUpdater geo={geo} radius={radius} useMap={useMap} />
      </MapContainer>
    </>
  );
}

export default function LocationMap({ city, radius, onLocationResolved }: LocationMapProps) {
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const geocode = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setGeo(null); setError(""); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const result = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          display: data[0].display_name.split(",").slice(0, 3).join(","),
        };
        setGeo(result);
        onLocationResolved?.(result.lat, result.lng, result.display);
      } else {
        setGeo(null);
        setError("Location not found.");
      }
    } catch {
      setError("Geocoding service unreachable.");
    } finally {
      setLoading(false);
    }
  }, [onLocationResolved]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => geocode(city), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [city, geocode]);

  if (!city.trim() || city.trim().length < 3) {
    return (
      <div className="h-48 rounded-xl bg-paper-alt border border-line-soft flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-5 h-5 text-fg-faint mx-auto mb-2" strokeWidth={2} />
          <p className="text-[13px] text-fg-mute">Enter a city to see the map</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-48 rounded-xl bg-paper-alt border border-line-soft flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 text-accent animate-spin" strokeWidth={2} />
        <p className="text-[13px] text-fg-mute">Finding location...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-48 rounded-xl bg-paper-alt border border-error/20 flex items-center justify-center">
        <p className="text-[13px] text-error">{error}</p>
      </div>
    );
  }

  if (!geo) return null;

  return (
    <div className="space-y-2">
      <div className="relative h-56 rounded-xl overflow-hidden border border-line-soft">
        <LeafletMap geo={geo} radius={radius} />
        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-medium text-fg tabular shadow-sm z-[500]">
          {radius} mi radius
        </div>
      </div>
      <p className="text-[11px] text-fg-faint flex items-center gap-1.5">
        <MapPin className="w-3 h-3" />
        {geo.display}
      </p>
    </div>
  );
}

function getZoomForRadius(miles: number): number {
  if (miles <= 25) return 9;
  if (miles <= 50) return 8;
  if (miles <= 100) return 7;
  if (miles <= 200) return 6;
  if (miles <= 500) return 5;
  return 4;
}
