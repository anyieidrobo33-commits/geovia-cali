import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Camera, Check, ChevronLeft, ChevronRight, CircleAlert, ImagePlus, Info, LocateFixed, MapPin, Send, Trash2, TriangleAlert,
} from 'lucide-react';
import LocationPicker from '../components/LocationPicker';
import { CategoryIcon, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOnline } from '../hooks/useInstallPrompt';
import { fetchNearby, rememberCode, submitReport, uploadPhoto, type NearbyReport } from '../lib/api';
import { follow } from '../lib/follow';
import {
  CATEGORIES, DESCRIPTION_MAX, DESCRIPTION_MIN, DUPLICATE_RADIUS_M, MAX_PHOTOS, REFERENCE_MAX, SEVERITIES,
  categoryMeta, isInsideCali, validateDraft, validatePhotoFile, type DraftErrors, type ReportDraft,
} from '../lib/domain';
import { fmtCoord, fmtDate } from '../lib/format';
import { reverseGeocode } from '../lib/geocode';
import { formatBytes, processPhoto, type ProcessedPhoto } from '../lib/image';
import { friendlyError } from '../lib/supabase';

const DRAFT_KEY = 'geovia-borrador';
const STEPS = ['Ubicación', 'Afectación', 'Fotos', 'Enviar'] as const;

const emptyDraft: ReportDraft = {
  lat: null, lng: null, accuracy: null, source: 'mapa', address: '', sector: '',
  category: '', severity: 'media', description: '', reference: '', photoCount: 0, consent: false,
};

function loadDraft(): ReportDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyDraft, ...JSON.parse(raw), photoCount: 0, consent: false };
  } catch { /* sin borrador */ }
  return emptyDraft;
}

interface PhotoItem { id: string; photo: ProcessedPhoto; }

export default function ReportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const { ensureSession } = useAuth();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ReportDraft>(loadDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [nearby, setNearby] = useState<NearbyReport[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const restored = useMemo(() => draft.lat !== null || draft.description.length > 0, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Borrador local (sin fotos) para no perder el trabajo si se cierra la app o falla la señal
  useEffect(() => {
    const { photoCount: _p, consent: _c, ...rest } = draft;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(rest)); } catch { /* lleno */ }
  }, [draft]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.photo.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<ReportDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const pos: [number, number] | null = draft.lat !== null && draft.lng !== null ? [draft.lat, draft.lng] : null;

  // Geocodificación inversa + búsqueda de duplicados cuando cambia la ubicación
  useEffect(() => {
    if (!pos || !isInsideCali(pos[0], pos[1])) { setNearby([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setGeoBusy(true);
      const [place, near] = await Promise.all([
        reverseGeocode(pos[0], pos[1], ctrl.signal),
        fetchNearby(pos[0], pos[1], DUPLICATE_RADIUS_M).catch(() => [] as NearbyReport[]),
      ]);
      if (ctrl.signal.aborted) return;
      if (place) setDraft((d) => ({ ...d, address: place.address || d.address, sector: place.sector || d.sector }));
      setNearby(near);
      setGeoBusy(false);
    }, 450);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [draft.lat, draft.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapPick = useCallback((p: [number, number]) => {
    setDraft((d) => ({ ...d, lat: p[0], lng: p[1], source: 'mapa', accuracy: null, address: '', sector: '' }));
    setErrors((e) => ({ ...e, location: undefined }));
  }, []);

  const useGps = () => {
    if (!('geolocation' in navigator)) { setGpsState('error'); setGpsMsg('Este dispositivo no permite obtener la ubicación. Marque el punto en el mapa.'); return; }
    setGpsState('busy'); setGpsMsg(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude, longitude, accuracy } = p.coords;
        if (!isInsideCali(latitude, longitude)) {
          setGpsState('error');
          setGpsMsg('Su ubicación actual está fuera de Santiago de Cali. Marque el punto del daño directamente en el mapa.');
          return;
        }
        setGpsState('idle');
        setDraft((d) => ({ ...d, lat: latitude, lng: longitude, accuracy: Math.round(accuracy), source: 'gps', address: '', sector: '' }));
        setErrors((e) => ({ ...e, location: undefined }));
        if (accuracy > 50) setGpsMsg(`Precisión aproximada de ${Math.round(accuracy)} m. Arrastre el marcador al punto exacto si es necesario.`);
      },
      (err) => {
        setGpsState('error');
        setGpsMsg(err.code === err.PERMISSION_DENIED
          ? 'No se concedió permiso de ubicación. Puede marcar el punto tocando el mapa.'
          : 'No fue posible obtener la ubicación. Intente de nuevo o marque el punto en el mapa.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { setPhotoError(`Máximo ${MAX_PHOTOS} fotografías.`); return; }
    setPhotoBusy(true);
    const added: PhotoItem[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const invalid = validatePhotoFile(file);
      if (invalid) { setPhotoError(`${file.name}: ${invalid}`); continue; }
      try {
        added.push({ id: crypto.randomUUID(), photo: await processPhoto(file) });
      } catch (e) {
        setPhotoError(e instanceof Error ? e.message : 'No se pudo procesar la imagen.');
      }
    }
    if (files.length > room) setPhotoError(`Solo se agregaron ${room}; el máximo es ${MAX_PHOTOS} fotografías.`);
    setPhotos((p) => [...p, ...added]);
    setPhotoBusy(false);
    setErrors((e) => ({ ...e, photos: undefined }));
  };

  const removePhoto = (id: string) => setPhotos((list) => {
    const target = list.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.photo.previewUrl);
    return list.filter((p) => p.id !== id);
  });

  const currentDraft = { ...draft, photoCount: photos.length };

  const goTo = (next: number) => {
    setStep(next);
    setTimeout(() => { headingRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 30);
  };

  const next = () => {
    const scope = (['location', 'details', 'photos'] as const)[step];
    const e = validateDraft(currentDraft, scope);
    setErrors(e);
    if (Object.keys(e).length) return;
    goTo(step + 1);
  };

  const submit = async () => {
    const e = validateDraft(currentDraft, 'all');
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!online) { setSubmitError('No hay conexión. Su borrador está guardado; envíelo cuando vuelva la señal (las fotos deben adjuntarse de nuevo si cierra la app).'); return; }
    setSubmitError(null);
    try {
      setSubmitting('Preparando sesión segura…');
      const user = await ensureSession();
      const folder = crypto.randomUUID();
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setSubmitting(`Subiendo fotografía ${i + 1} de ${photos.length}…`);
        paths.push(await uploadPhoto(user.id, folder, photos[i].photo.blob));
      }
      setSubmitting('Registrando el reporte…');
      const res = await submitReport({
        category: draft.category as Exclude<ReportDraft['category'], ''>,
        severity: draft.severity,
        description: draft.description,
        reference: draft.reference,
        lat: draft.lat!, lng: draft.lng!,
        accuracy: draft.accuracy,
        source: draft.source,
        address: draft.address,
        sector: draft.sector,
        photoPaths: paths,
        consent: draft.consent,
      });
      rememberCode(res.code);
      follow(res.id, res.code, { status: 'recibido', history_count: 1, updates_count: 0 });
      localStorage.removeItem(DRAFT_KEY);
      toast('Reporte enviado correctamente');
      navigate(`/confirmacion/${res.code}`, { replace: true });
    } catch (err) {
      setSubmitError(friendlyError(err));
      setSubmitting(null);
    }
  };

  const discard = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraft(emptyDraft);
    setPhotos([]);
    setErrors({});
    goTo(0);
  };

  const descLen = draft.description.trim().length;

  return (
    <div className="container container-narrow page wizard">
      <div>
        <h1 ref={headingRef} tabIndex={-1} style={{ outline: 'none' }}>Reportar una afectación</h1>
        <p className="muted" style={{ margin: 0 }}>Paso {step + 1} de 4 · {STEPS[step]}</p>
      </div>

      <ol className="progress" aria-label="Progreso del reporte" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {STEPS.map((s, i) => (
          <li key={s} className={`progress-step ${i < step ? 'done' : ''} ${i === step ? 'current' : ''}`} aria-current={i === step ? 'step' : undefined}>
            <span className="bar" />{s}
          </li>
        ))}
      </ol>

      {restored && step === 0 && (draft.lat !== null || draft.description) && (
        <div className="alert alert-info">
          <Info size={18} />
          <div className="row" style={{ flex: 1 }}>
            <span style={{ flex: 1 }}>Recuperamos su borrador anterior.</span>
            <button className="btn btn-sm" onClick={discard}>Empezar de nuevo</button>
          </div>
        </div>
      )}

      {/* ---------------- Paso 1: Ubicación ---------------- */}
      {step === 0 && (
        <section className="card card-pad stack" aria-labelledby="s1">
          <div className="card-title"><MapPin size={20} color="var(--navy)" /><h2 id="s1">¿Dónde está el daño?</h2></div>
          <button className="btn btn-navy btn-lg" onClick={useGps} disabled={gpsState === 'busy'}>
            {gpsState === 'busy' ? <Spinner label="Obteniendo ubicación…" /> : <><LocateFixed size={20} />Usar mi ubicación actual</>}
          </button>
          {gpsMsg && <div className={`alert ${gpsState === 'error' ? 'alert-warning' : 'alert-info'}`} role="status"><Info size={18} />{gpsMsg}</div>}
          <p className="help" style={{ margin: 0 }}>O toque el mapa en el punto exacto. Puede arrastrar el marcador para ajustarlo.</p>
          <div className="picker-map">
            {!pos && <div className="picker-hint floating">Toque el mapa para ubicar el daño</div>}
            <LocationPicker value={pos} accuracy={draft.source === 'gps' ? draft.accuracy : null} onChange={onMapPick} />
          </div>
          {errors.location && <p className="error-text" role="alert"><CircleAlert size={16} />{errors.location}</p>}
          {pos && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="small muted row" style={{ gap: 6 }}>
                <MapPin size={14} /> {fmtCoord(pos[0], pos[1])} · {draft.source === 'gps' ? 'GPS' : 'marcado en el mapa'}
                {geoBusy && <Spinner size={14} label="buscando dirección…" />}
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="label" htmlFor="addr">Dirección aproximada <span className="opt">(editable)</span></label>
                  <input id="addr" className="input" value={draft.address} maxLength={250} onChange={(e) => update({ address: e.target.value })} placeholder="Ej.: Calle 5 con Carrera 34" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="sector">Barrio o sector <span className="opt">(editable)</span></label>
                  <input id="sector" className="input" value={draft.sector} maxLength={120} onChange={(e) => update({ sector: e.target.value })} placeholder="Ej.: San Fernando" />
                </div>
              </div>
            </div>
          )}
          {nearby.length > 0 && (
            <div className="alert alert-warning" role="status">
              <TriangleAlert size={20} />
              <div>
                <p><b>Posible duplicado:</b> {nearby.length === 1 ? 'existe un reporte' : `existen ${nearby.length} reportes`} a menos de {DUPLICATE_RADIUS_M} m.
                  Si es la misma afectación, no es necesario reportarla de nuevo.</p>
                <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
                  {nearby.slice(0, 3).map((n) => (
                    <li key={n.id} className="small">
                      <Link to={`/r/${n.code}`} target="_blank" className="code-display">{n.code}</Link> · {categoryMeta(n.category_code).name} · a {Math.round(n.distance_m)} m · <StatusBadge status={n.status} />
                    </li>
                  ))}
                </ul>
                <p className="small" style={{ marginTop: 6 }}>Si es un daño distinto, continúe normalmente.</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------------- Paso 2: Afectación ---------------- */}
      {step === 1 && (
        <section className="card card-pad stack" aria-labelledby="s2" style={{ gap: 18 }}>
          <div className="card-title"><h2 id="s2">¿Qué tipo de afectación es?</h2></div>
          <div className="cat-grid" role="radiogroup" aria-label="Tipo de afectación" aria-describedby={errors.category ? 'err-cat' : undefined}>
            {CATEGORIES.map((c) => (
              <button key={c.code} type="button" role="radio" aria-checked={draft.category === c.code} className="cat-option"
                onClick={() => { update({ category: c.code }); setErrors((e) => ({ ...e, category: undefined })); }}>
                <CategoryIcon code={c.code} size={34} />
                <b>{c.name}</b>
                <span>{c.hint}</span>
              </button>
            ))}
          </div>
          {errors.category && <p id="err-cat" className="error-text" role="alert"><CircleAlert size={16} />{errors.category}</p>}

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 6 }}>Severidad percibida <span className="opt">(orientativa)</span></legend>
            <div className="segmented" role="radiogroup" aria-label="Severidad">
              {SEVERITIES.map((s) => (
                <button key={s.code} type="button" role="radio" aria-checked={draft.severity === s.code} aria-pressed={draft.severity === s.code} onClick={() => update({ severity: s.code })}>{s.label}</button>
              ))}
            </div>
            <span className="help">{SEVERITIES.find((s) => s.code === draft.severity)?.hint} No es una clasificación técnica oficial.</span>
          </fieldset>

          <div className="field">
            <label className="label" htmlFor="desc">Descripción del daño</label>
            <textarea id="desc" className="textarea" value={draft.description} maxLength={DESCRIPTION_MAX}
              aria-invalid={Boolean(errors.description)} aria-describedby="desc-help desc-count"
              onChange={(e) => { update({ description: e.target.value }); if (errors.description) setErrors((x) => ({ ...x, description: undefined })); }}
              placeholder="Ej.: Hueco de aproximadamente un metro en el carril derecho, frente al paradero. Los carros lo esquivan invadiendo el otro carril." />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span id="desc-help" className="help">Tamaño aproximado, carril, riesgo observado. No incluya nombres ni placas.</span>
              <span id="desc-count" className="counter" style={{ color: descLen < DESCRIPTION_MIN ? 'var(--amber-700)' : undefined }}>
                {descLen}/{DESCRIPTION_MAX}{descLen < DESCRIPTION_MIN ? ` · mínimo ${DESCRIPTION_MIN}` : ''}
              </span>
            </div>
            {errors.description && <p className="error-text" role="alert"><CircleAlert size={16} />{errors.description}</p>}
          </div>

          <div className="field">
            <label className="label" htmlFor="ref">Punto de referencia <span className="opt">(opcional)</span></label>
            <input id="ref" className="input" value={draft.reference} maxLength={REFERENCE_MAX} onChange={(e) => update({ reference: e.target.value })} placeholder="Ej.: Frente a la panadería, junto al semáforo" />
            {errors.reference && <p className="error-text" role="alert"><CircleAlert size={16} />{errors.reference}</p>}
          </div>
        </section>
      )}

      {/* ---------------- Paso 3: Fotos ---------------- */}
      {step === 2 && (
        <section className="card card-pad stack" aria-labelledby="s3">
          <div className="card-title"><Camera size={20} color="var(--navy)" /><h2 id="s3">Fotografías del daño</h2></div>
          <p className="muted" style={{ margin: 0 }}>Adjunte entre 1 y {MAX_PHOTOS} fotos donde se vea claramente la afectación. Evite rostros y placas.</p>
          <div className="row">
            <button className="btn btn-navy" onClick={() => cameraInput.current?.click()} disabled={photos.length >= MAX_PHOTOS || photoBusy}><Camera size={18} />Tomar foto</button>
            <button className="btn" onClick={() => galleryInput.current?.click()} disabled={photos.length >= MAX_PHOTOS || photoBusy}><ImagePlus size={18} />Elegir de la galería</button>
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={p.id} className="photo-tile">
                <img src={p.photo.previewUrl} alt={`Fotografía ${i + 1}`} />
                <button className="remove" onClick={() => removePhoto(p.id)} aria-label={`Quitar fotografía ${i + 1}`}><Trash2 size={16} /></button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button className="photo-add" onClick={() => galleryInput.current?.click()} disabled={photoBusy}>
                {photoBusy ? <Spinner label="Procesando" /> : <><ImagePlus size={26} />Agregar</>}
              </button>
            )}
          </div>
          {photos.length > 0 && (
            <p className="help" style={{ margin: 0 }}>
              <Check size={14} style={{ verticalAlign: 'text-bottom' }} /> Fotos optimizadas: {formatBytes(photos.reduce((a, p) => a + p.photo.originalBytes, 0))} → {formatBytes(photos.reduce((a, p) => a + p.photo.blob.size, 0))}. Se eliminaron los metadatos (EXIF) de ubicación y dispositivo.
            </p>
          )}
          {(photoError || errors.photos) && <p className="error-text" role="alert"><CircleAlert size={16} />{photoError ?? errors.photos}</p>}
        </section>
      )}

      {/* ---------------- Paso 4: Revisar y enviar ---------------- */}
      {step === 3 && (
        <section className="card card-pad stack" aria-labelledby="s4">
          <div className="card-title"><h2 id="s4">Revise y envíe</h2></div>
          <dl className="summary" style={{ margin: 0 }}>
            <div><dt>Afectación</dt><dd className="row" style={{ gap: 8 }}><CategoryIcon code={draft.category} size={24} />{categoryMeta(draft.category).name} · severidad {draft.severity}</dd></div>
            <div><dt>Ubicación</dt><dd>{draft.address || 'Sin dirección'}{draft.sector ? ` · ${draft.sector}` : ''}<br /><span className="small muted">{pos && fmtCoord(pos[0], pos[1])} ({draft.source === 'gps' ? 'GPS' : 'mapa'})</span></dd></div>
            <div><dt>Descripción</dt><dd>{draft.description}</dd></div>
            {draft.reference && <div><dt>Referencia</dt><dd>{draft.reference}</dd></div>}
            <div><dt>Fotografías</dt><dd className="row">{photos.map((p, i) => <img key={p.id} src={p.photo.previewUrl} alt={`Fotografía ${i + 1}`} className="thumb" />)}</dd></div>
            <div><dt>Fecha</dt><dd>{fmtDate(new Date().toISOString())}</dd></div>
          </dl>
          <label className="check">
            <input type="checkbox" checked={draft.consent} onChange={(e) => { update({ consent: e.target.checked }); setErrors((x) => ({ ...x, consent: undefined })); }} aria-invalid={Boolean(errors.consent)} />
            <span className="small">
              Autorizo el tratamiento de la ubicación, la descripción y las fotografías de este reporte con fines académicos, conforme a la
              Ley 1581 de 2012 y la <Link to="/acerca#privacidad" target="_blank">política de privacidad</Link>. Entiendo que GeoVía Cali
              no es un canal oficial de la Alcaldía.
            </span>
          </label>
          {errors.consent && <p className="error-text" role="alert"><CircleAlert size={16} />{errors.consent}</p>}
          {submitError && <div className="alert alert-danger" role="alert"><CircleAlert size={18} />{submitError}</div>}
        </section>
      )}

      <div className="wizard-nav">
        {step > 0 && (
          <button className="btn" onClick={() => goTo(step - 1)} disabled={Boolean(submitting)}><ChevronLeft size={18} />Atrás</button>
        )}
        {step < 3 ? (
          <button className="btn btn-primary" onClick={next}>Continuar<ChevronRight size={18} /></button>
        ) : (
          <button className="btn btn-primary" onClick={submit} disabled={Boolean(submitting)} aria-busy={Boolean(submitting)}>
            {submitting ? <Spinner label={submitting} /> : <><Send size={18} />Enviar reporte</>}
          </button>
        )}
      </div>
    </div>
  );
}
