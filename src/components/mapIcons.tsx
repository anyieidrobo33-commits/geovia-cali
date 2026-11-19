import L from 'leaflet';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactElement } from 'react';

/** Convierte un ícono React en SVG estático sin incluir el renderizador de servidor. */
function toMarkup(el: ReactElement): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(el));
  const html = host.innerHTML;
  root.unmount();
  return html;
}
import { categoryMeta, PUBLIC_STATUSES, type ReportStatus } from '../lib/domain';
import { CATEGORY_ICONS } from './ui';

const cache = new Map<string, L.DivIcon>();

/** Marcador por categoría: forma + ícono + color (no depende solo del color). */
export function categoryPin(category: string, status?: ReportStatus): L.DivIcon {
  const muted = status && !PUBLIC_STATUSES.includes(status);
  const key = `${category}-${muted ? 'm' : 'p'}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const meta = categoryMeta(category);
  const Icon = CATEGORY_ICONS[meta.code];
  const glyph = toMarkup(<Icon size={16} strokeWidth={2.6} color="#fff" />);
  const html = `
    <div class="pin ${muted ? 'pin-muted' : ''}">
      <svg class="pin-shape" viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
        <path d="M17 1C8.2 1 1 8 1 16.7c0 11.4 13.7 24.9 14.3 25.5a2.4 2.4 0 0 0 3.4 0C19.3 41.6 33 28.1 33 16.7 33 8 25.8 1 17 1z"
          fill="${meta.color}" stroke="#fff" stroke-width="2" ${muted ? 'stroke-dasharray="3 2"' : ''}/>
      </svg>
      <span class="pin-glyph">${glyph}</span>
    </div>`;
  const icon = L.divIcon({ html, className: '', iconSize: [34, 44], iconAnchor: [17, 43], popupAnchor: [0, -38] });
  cache.set(key, icon);
  return icon;
}

export const selectionPin = L.divIcon({
  html: `<div class="pin"><svg class="pin-shape" viewBox="0 0 34 44" width="40" height="52" aria-hidden="true">
    <path d="M17 1C8.2 1 1 8 1 16.7c0 11.4 13.7 24.9 14.3 25.5a2.4 2.4 0 0 0 3.4 0C19.3 41.6 33 28.1 33 16.7 33 8 25.8 1 17 1z" fill="#FEA600" stroke="#003163" stroke-width="2.4"/>
    <circle cx="17" cy="16.5" r="5.5" fill="#003163"/></svg></div>`,
  className: '',
  iconSize: [40, 52],
  iconAnchor: [20, 51],
});

export const userLocationIcon = L.divIcon({ html: '<div class="user-dot"></div>', className: '', iconSize: [18, 18], iconAnchor: [9, 9] });

// Mosaicos estándar de OpenStreetMap (uso moderado permitido con atribución).
// Para un despliegue con mucho tráfico se recomienda un proveedor con clave (MapTiler, Stadia).
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
