import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Eye, MapPin, MessagesSquare, RefreshCw, Users } from 'lucide-react';
import { fetchFeed, signedPhotoUrls, type FeedItem } from '../lib/api';
import { categoryMeta } from '../lib/domain';
import { fmtRelative } from '../lib/format';
import { friendlyError } from '../lib/supabase';
import { CategoryIcon, CenterState, ConditionBadge, DemoBadge, Spinner, StatusBadge } from '../components/ui';

type Filter = 'todo' | 'reporte' | 'actualizacion';

export default function CommunityPage() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todo');

  const load = async () => {
    setError(null);
    try {
      const feed = await fetchFeed(50);
      setItems(feed);
      const paths = [...new Set(feed.map((f) => f.foto).filter(Boolean) as string[])];
      setPhotos(await signedPhotoUrls(paths).catch(() => ({})));
    } catch (e) {
      setError(friendlyError(e));
      setItems([]);
    }
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (items ?? []).filter((i) => filter === 'todo' || i.tipo === filter), [items, filter]);
  const nUpdates = (items ?? []).filter((i) => i.tipo === 'actualizacion').length;

  return (
    <div className="container container-narrow page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 10 }}><Users size={30} />Comunidad</h1>
          <p>Últimos daños publicados y actualizaciones de ciudadanos en el sitio. ¿Pasa por uno? Cuéntenos cómo está hoy.</p>
        </div>
        <button className="btn" onClick={load} aria-label="Actualizar el muro"><RefreshCw size={18} /></button>
      </div>

      <div className="segmented" role="group" aria-label="Filtrar publicaciones" style={{ marginBottom: 14 }}>
        <button aria-pressed={filter === 'todo'} onClick={() => setFilter('todo')}>Todo</button>
        <button aria-pressed={filter === 'reporte'} onClick={() => setFilter('reporte')}>Reportes</button>
        <button aria-pressed={filter === 'actualizacion'} onClick={() => setFilter('actualizacion')}>Actualizaciones{nUpdates ? ` (${nUpdates})` : ''}</button>
      </div>

      {error && <div className="alert alert-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {items === null ? <Spinner label="Cargando la comunidad…" /> : shown.length === 0 ? (
        <CenterState icon={<MessagesSquare size={30} />} title="Aún no hay publicaciones">
          <p>Cuando un reporte sea validado o alguien lo actualice, aparecerá aquí.</p>
          <Link to="/reportar" className="btn btn-primary">Reportar un daño</Link>
        </CenterState>
      ) : (
        <div className="feed">
          {shown.map((it, i) => {
            const cat = categoryMeta(it.category_code);
            const isUpdate = it.tipo === 'actualizacion';
            const photo = it.foto ? photos[it.foto] : undefined;
            return (
              <article key={`${it.tipo}-${it.code}-${it.fecha}-${i}`} className="post">
                <header className="post-head">
                  <CategoryIcon code={cat.code} size={40} />
                  <div className="who">
                    <b>{isUpdate ? 'Actualización ciudadana' : 'Nuevo daño publicado'} · {cat.name}</b>
                    <span><MapPin size={12} style={{ verticalAlign: '-1px' }} /> {it.sector || it.address || 'Cali'} · {fmtRelative(it.fecha)}</span>
                  </div>
                </header>
                {photo ? <img className="post-photo" src={photo} alt={`Foto: ${cat.name} en ${it.sector ?? 'Cali'}`} loading="lazy" />
                  : it.foto ? <div className="post-photo skeleton" /> : null}
                <div className="post-body">
                  <div className="row" style={{ gap: 6 }}>
                    {isUpdate && it.condicion ? <ConditionBadge condition={it.condicion} /> : <StatusBadge status={it.estado} />}
                    {isUpdate && <span className="badge tone-info"><Camera size={12} />Foto en el sitio</span>}
                    {it.is_demo && <DemoBadge />}
                  </div>
                  {it.texto && <p>{it.texto}</p>}
                  {!isUpdate && it.n_updates > 0 && it.ultima_condicion && (
                    <p className="small">Última actualización ciudadana: <ConditionBadge condition={it.ultima_condicion} /> · {it.n_updates} en total</p>
                  )}
                  <span className="small code-display">{it.code}</span>
                </div>
                <div className="post-actions">
                  <Link to={`/r/${it.code}`} className="btn btn-sm"><Eye size={16} />Ver detalle</Link>
                  <Link to={`/r/${it.code}/actualizar`} className="btn btn-sm btn-navy"><Camera size={16} />Actualizar</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
