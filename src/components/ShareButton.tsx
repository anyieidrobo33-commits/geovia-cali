import { Share2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { categoryMeta } from '../lib/domain';

/** Compartir un reporte: hoja nativa del celular o WhatsApp como alternativa. */
export default function ShareButton({ code, categoryCode, sector, size = 'sm' }: {
  code: string; categoryCode: string; sector: string | null; size?: 'sm' | 'md';
}) {
  const toast = useToast();
  const url = `${window.location.origin}/r/${code}`;
  const text = `${categoryMeta(categoryCode).name}${sector ? ` en ${sector}` : ''} — reportado en GeoVía Cali (${code}). ¿Lo has visto? Apóyalo o actualízalo:`;

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'GeoVía Cali', text, url }); return; } catch { return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { /* sin portapapeles */ }
  };

  return (
    <button type="button" className={`btn ${size === 'sm' ? 'btn-sm' : ''}`} onClick={share} aria-label="Compartir reporte">
      <Share2 size={size === 'sm' ? 16 : 18} />{size === 'md' && 'Compartir'}
    </button>
  );
}
