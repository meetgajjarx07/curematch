"use client";

import { useEffect, useState } from "react";
import { TrialMatch } from "@/lib/types";

interface MapViewProps {
  trials: TrialMatch[];
}

export default function MapView({ trials }: MapViewProps) {
  const [components, setComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    CircleMarker: typeof import("react-leaflet").CircleMarker;
    Popup: typeof import("react-leaflet").Popup;
  } | null>(null);

  useEffect(() => {
    import("react-leaflet").then((rl) => {
      setComponents({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        CircleMarker: rl.CircleMarker,
        Popup: rl.Popup,
      });
    });
  }, []);

  if (!components) return <div className="w-full h-[500px] rounded-[18px] bg-paper-alt" />;

  const { MapContainer, TileLayer, CircleMarker, Popup } = components;
  const allLocations = trials.flatMap((t) => t.locations.map((loc) => ({ ...loc, trial: t })));
  const center: [number, number] = allLocations.length > 0 ? [allLocations[0].lat, allLocations[0].lng] : [39.8283, -98.5795];

  const getColor = (score: number) => {
    if (score >= 80) return "#30D158";
    if (score >= 50) return "#FF9F0A";
    return "#FF3B30";
  };

  return (
    <div className="w-full h-[600px] rounded-[18px] overflow-hidden border border-line-soft relative">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <MapContainer center={center} zoom={4} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        {allLocations.map((loc, i) => (
          <CircleMarker
            key={`${loc.trial.nctId}-${i}`}
            center={[loc.lat, loc.lng]}
            radius={8}
            pathOptions={{
              fillColor: getColor(loc.trial.matchScore),
              fillOpacity: 0.9,
              color: getColor(loc.trial.matchScore),
              weight: 3,
              opacity: 0.3,
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <p className="font-semibold text-fg mb-1 text-[13px] leading-snug">
                  {loc.trial.briefTitle.slice(0, 60)}…
                </p>
                <p className="text-[11px] text-fg-faint tabular">{loc.trial.nctId}</p>
                <p className="text-[12px] text-fg-mute mt-1">{loc.facility}, {loc.city}, {loc.state}</p>
                <p className="text-xl font-semibold mt-2 tabular" style={{ color: getColor(loc.trial.matchScore) }}>
                  {loc.trial.matchScore}% match
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-xl p-3 shadow-sm border border-line-soft text-[12px] z-[500]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint mb-2">Legend</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-success" /> 80 – 100% match</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-warning" /> 50 – 79% match</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-error" /> Below 50%</div>
        </div>
      </div>
    </div>
  );
}
