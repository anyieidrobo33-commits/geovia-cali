import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleCheck, Copy, Eye, Plus, Share2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function ConfirmationPage() {
  const { code = '' } = useParams();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/r/${code}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); toast('Código copiado'); } catch { /* sin portapapeles */ }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Mi reporte en GeoVía Cali', text: `Código de seguimiento: ${code}`, url }); } catch { /* cancelado */ }
    } else copy();
  };

  return (
    <div className="container container-narrow page">
      <div className="card card-pad stack" style={{ alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, display: 'grid', placeItems: 'center', background: 'var(--green-50)', color: 'var(--green)' }}>
          <CircleCheck size={40} />
        </div>
        <h1 style={{ margin: 0 }}>¡Reporte recibido!</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 480 }}>
          Gracias por contribuir. Guarde este código para consultar el estado de su reporte en cualquier momento.
        </p>
        <div className="code-display code-hero" aria-label={`Código de seguimiento ${code.split('').join(' ')}`}>{code}</div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={copy}><Copy size={18} />{copied ? 'Copiado' : 'Copiar código'}</button>
          <button className="btn" onClick={share}><Share2 size={18} />Compartir</button>
        </div>
        <div className="alert alert-info" style={{ textAlign: 'left' }}>
          <div>
            <b>¿Qué sigue?</b> Su reporte queda en estado <b>Recibido</b>. Un revisor verificará la ubicación y la fotografía; cuando
            sea validado aparecerá en el mapa público. Cada cambio queda registrado con su fecha y motivo.
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to={`/r/${code}`} className="btn btn-navy"><Eye size={18} />Ver seguimiento</Link>
          <Link to="/reportar" className="btn btn-primary"><Plus size={18} />Reportar otro daño</Link>
        </div>
      </div>
    </div>
  );
}
