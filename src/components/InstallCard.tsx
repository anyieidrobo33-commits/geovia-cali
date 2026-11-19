import { useEffect, useRef } from 'react';
import { Share, Smartphone, SquarePlus, X, EllipsisVertical } from 'lucide-react';
import { isIOS, useInstallPrompt } from '../hooks/useInstallPrompt';

/** Tarjeta para instalar la PWA (ícono en la pantalla de inicio del celular). */
export function InstallCard() {
  const install = useInstallPrompt();
  if (install.installed) return null;
  return (
    <div className="card card-pad row" style={{ gap: 16, alignItems: 'center' }}>
      <img src="/icons/icon-192.png" alt="" width={64} height={64} style={{ borderRadius: 16, boxShadow: 'var(--shadow)' }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <h3 style={{ margin: 0 }}>Lleve GeoVía en su celular</h3>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Instálela como aplicación: queda el ícono en la pantalla de inicio, abre a pantalla completa y carga más rápido.
        </p>
      </div>
      {install.canPrompt ? (
        <button className="btn btn-navy" onClick={() => install.install()}><Smartphone size={18} />Instalar app</button>
      ) : (
        <InstructionsInline />
      )}
    </div>
  );
}

function InstructionsInline() {
  return isIOS() ? (
    <p className="small" style={{ margin: 0, maxWidth: 300 }}>
      En Safari toque <Share size={16} style={{ verticalAlign: 'text-bottom' }} /> <b>Compartir</b> y luego{' '}
      <b>Agregar a pantalla de inicio</b> <SquarePlus size={16} style={{ verticalAlign: 'text-bottom' }} />.
    </p>
  ) : (
    <p className="small" style={{ margin: 0, maxWidth: 300 }}>
      En Chrome abra el menú <EllipsisVertical size={16} style={{ verticalAlign: 'text-bottom' }} /> y elija{' '}
      <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.
    </p>
  );
}

export function InstallDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} className="card card-pad" style={{ maxWidth: 420, border: 0, boxShadow: 'var(--shadow-lg)' }}
      aria-labelledby="install-title">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h2 id="install-title" style={{ flex: 1, marginBottom: 8 }}>Instalar GeoVía Cali</h2>
        <button className="btn btn-ghost icon-btn" onClick={() => ref.current?.close()} aria-label="Cerrar"><X size={20} /></button>
      </div>
      {isIOS() ? (
        <ol className="prose" style={{ paddingLeft: '1.2em' }}>
          <li>Abra esta página en <b>Safari</b>.</li>
          <li>Toque el botón <b>Compartir</b> <Share size={16} style={{ verticalAlign: 'text-bottom' }} />.</li>
          <li>Elija <b>Agregar a pantalla de inicio</b> y confirme con <b>Agregar</b>.</li>
        </ol>
      ) : (
        <ol className="prose" style={{ paddingLeft: '1.2em' }}>
          <li>Abra esta página en <b>Chrome</b> o <b>Edge</b>.</li>
          <li>Toque el menú <EllipsisVertical size={16} style={{ verticalAlign: 'text-bottom' }} /> (arriba a la derecha).</li>
          <li>Elija <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.</li>
        </ol>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>El ícono de GeoVía quedará junto a sus otras aplicaciones.</p>
    </dialog>
  );
}
