import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, SwitchCamera } from 'lucide-react';

/**
 * Cámara en vivo (getUserMedia). La foto se toma en el momento desde el visor:
 * no existe opción de elegir imágenes de la galería. La captura se redimensiona
 * a máx. 1600 px y se codifica en JPEG desde el lienzo, por lo que no contiene EXIF.
 */
export interface LiveShot { blob: Blob; url: string; takenAt: string; }

const MAX_SIDE = 1600;

export default function LiveCamera({ onShot }: { onShot: (shot: LiveShot | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'shot' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<LiveShot | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (mode: 'environment' | 'user' = facing) => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError('Este navegador no permite usar la cámara. Abra GeoVía en Chrome o Safari desde su celular.');
      return;
    }
    setState('starting');
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState('live');
    } catch (e) {
      const name = (e as DOMException)?.name;
      setState('error');
      setError(
        name === 'NotAllowedError'
          ? 'No se concedió permiso para usar la cámara. Actívelo en la configuración del navegador (candado junto a la dirección) e intente de nuevo.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No se encontró una cámara en este dispositivo. Las actualizaciones solo se aceptan con una foto tomada en el sitio.'
            : 'No fue posible iniciar la cámara. Cierre otras aplicaciones que la estén usando e intente de nuevo.',
      );
    }
  }, [facing, stop]);

  useEffect(() => () => { stop(); if (shot) URL.revokeObjectURL(shot.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    if (!blob) return;
    const s: LiveShot = { blob, url: URL.createObjectURL(blob), takenAt: new Date().toISOString() };
    stop();
    setShot(s);
    setState('shot');
    onShot(s);
  };

  const retake = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    onShot(null);
    start();
  };

  const flip = () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    start(next);
  };

  return (
    <div className="live-cam">
      <div className="live-cam-frame">
        {state === 'shot' && shot ? (
          <img src={shot.url} alt="Fotografía tomada" />
        ) : (
          <video ref={videoRef} playsInline muted autoPlay aria-label="Visor de la cámara" style={{ display: state === 'live' ? 'block' : 'none' }} />
        )}
        {(state === 'idle' || state === 'starting') && (
          <button type="button" className="live-cam-start" onClick={() => start()} disabled={state === 'starting'}>
            <Camera size={40} />
            <span>{state === 'starting' ? 'Abriendo cámara…' : 'Abrir cámara'}</span>
          </button>
        )}
        {state === 'error' && (
          <div className="live-cam-start" role="alert">
            <CameraOff size={40} />
            <span className="small" style={{ maxWidth: 300 }}>{error}</span>
          </div>
        )}
        {state === 'live' && <span className="live-badge"><span className="dot" />EN VIVO</span>}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {state === 'live' && (
          <>
            <button type="button" className="btn btn-ghost icon-btn" onClick={flip} aria-label="Cambiar de cámara"><SwitchCamera size={22} /></button>
            <button type="button" className="shutter" onClick={capture} aria-label="Tomar foto" />
            <span style={{ width: 44 }} />
          </>
        )}
        {state === 'shot' && <button type="button" className="btn" onClick={retake}><RefreshCw size={18} />Tomar otra</button>}
        {state === 'error' && <button type="button" className="btn" onClick={() => start()}><RefreshCw size={18} />Reintentar</button>}
      </div>
    </div>
  );
}
