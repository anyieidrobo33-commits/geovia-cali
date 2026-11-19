// Geocodificación inversa con Nominatim (OpenStreetMap) para sugerir dirección y barrio.
// Es solo una ayuda: si el servicio no responde, el reporte se envía igual con coordenadas.
// Política de uso: máximo 1 solicitud por segundo; se aplica caché y espera mínima.

export interface PlaceInfo {
  address: string;
  sector: string;
}

const cache = new Map<string, PlaceInfo>();
let lastCall = 0;

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceInfo | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const wait = Math.max(0, 1100 - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (signal?.aborted) return null;
  lastCall = Date.now();

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const road = a.road ?? a.pedestrian ?? a.footway ?? '';
    const number = a.house_number ? ` # ${a.house_number}` : '';
    const sector = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district ?? '';
    const info: PlaceInfo = {
      address: (road ? `${road}${number}` : (data.name ?? '')).slice(0, 250),
      sector: String(sector).slice(0, 120),
    };
    cache.set(key, info);
    return info;
  } catch {
    return null;
  }
}
