import { useEffect, useMemo, useRef } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type L from 'leaflet';
import { CALI_CENTER } from '../lib/domain';
import { selectionPin, TILE_ATTRIBUTION, TILE_URL } from './mapIcons';

interface Props {
  value: [number, number] | null;
  accuracy?: number | null;
  onChange: (pos: [number, number], source: 'mapa') => void;
}

function ClickHandler({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function Recenter({ value }: { value: [number, number] | null }) {
  const map = useMap();
  const last = useRef<string>('');
  useEffect(() => {
    if (!value) return;
    const key = value.join(',');
    if (key === last.current) return;
    last.current = key;
    const inView = map.getBounds().pad(-0.15).contains(value);
    if (!inView || map.getZoom() < 15) map.flyTo(value, Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [value, map]);
  return null;
}

/** Selector de ubicación: toque el mapa o arrastre el marcador (RF01). */
export default function LocationPicker({ value, accuracy, onChange }: Props) {
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(() => ({
    dragend() {
      const m = markerRef.current;
      if (m) { const ll = m.getLatLng(); onChange([ll.lat, ll.lng], 'mapa'); }
    },
  }), [onChange]);

  return (
    <MapContainer center={value ?? CALI_CENTER} zoom={value ? 17 : 13} minZoom={11} maxZoom={19}
      maxBounds={[[3.15, -76.85], [3.68, -76.3]]}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <ClickHandler onPick={(p) => onChange(p, 'mapa')} />
      <Recenter value={value} />
      {value && (
        <>
          {accuracy ? <Circle center={value} radius={accuracy} pathOptions={{ color: '#003163', weight: 1, fillOpacity: 0.08 }} /> : null}
          <Marker position={value} icon={selectionPin} draggable eventHandlers={handlers} ref={markerRef}
            title="Ubicación del daño (arrastre para ajustar)" />
        </>
      )}
    </MapContainer>
  );
}
