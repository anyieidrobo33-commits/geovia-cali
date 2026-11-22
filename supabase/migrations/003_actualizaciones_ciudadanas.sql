-- =====================================================================
-- GeoVía Cali · Migración 003 · Actualizaciones ciudadanas y comunidad
-- Permite que cualquier ciudadano (con o sin cuenta) actualice el estado
-- observado de un reporte publicado, SOLO estando en el sitio:
--   · ubicación GPS con precisión ≤ 100 m y a ≤ 150 m del daño
--   · fotografía tomada en el momento con la cámara (la app no ofrece galería)
-- Agrega el feed comunitario con los últimos reportes y actualizaciones.
-- =====================================================================

do $$ begin
  create type public.update_condition as enum ('sigue_igual', 'empeoro', 'mejoro', 'reparado');
exception when duplicate_object then null; end $$;

create table if not exists public.report_updates (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports (id) on delete cascade,
  created_by   uuid references auth.users (id) on delete set null,
  condition    public.update_condition not null,
  comment      text check (comment is null or char_length(comment) <= 300),
  lat          double precision not null,
  lng          double precision not null,
  accuracy_m   real not null check (accuracy_m >= 0),
  distance_m   real not null check (distance_m >= 0),
  photo_path   text not null unique,
  created_at   timestamptz not null default now()
);
create index if not exists report_updates_report_idx on public.report_updates (report_id, created_at desc);
create index if not exists report_updates_created_idx on public.report_updates (created_at desc);

alter table public.report_updates enable row level security;

drop policy if exists "updates: si el reporte es visible" on public.report_updates;
create policy "updates: si el reporte es visible" on public.report_updates
  for select using (exists (select 1 from public.reports r where r.id = report_id));

-- Privacidad: la ubicación exacta y el autor de cada actualización NO se exponen.
revoke all on public.report_updates from anon, authenticated;
grant select (id, report_id, condition, comment, distance_m, photo_path, created_at)
  on public.report_updates to anon, authenticated;

-- Las fotos de actualizaciones se leen bajo las mismas reglas que las del reporte
drop policy if exists "evidencias: leer si el reporte es visible" on storage.objects;
create policy "evidencias: leer si el reporte es visible" on storage.objects
  for select using (
    bucket_id = 'evidencias'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.report_photos p where p.storage_path = name)
      or exists (select 1 from public.report_updates u where u.photo_path = name)
    )
  );

-- ---------------------------------------------------------------------
-- RPC: registrar una actualización ciudadana en el sitio
-- ---------------------------------------------------------------------
create or replace function public.submit_report_update(
  p_report_id  uuid,
  p_condition  public.update_condition,
  p_comment    text,
  p_lat        double precision,
  p_lng        double precision,
  p_accuracy   real,
  p_photo_path text,
  p_consent    boolean
)
returns table (id uuid, distance_m real)
language plpgsql security definer set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_report   public.reports;
  v_distance double precision;
  v_n        int;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Debe iniciar una sesión para actualizar.' using errcode = '42501';
  end if;
  if coalesce(p_consent, false) is not true then
    raise exception 'Debe aceptar el tratamiento de datos para enviar la actualización.' using errcode = '22023';
  end if;

  select * into v_report from public.reports r where r.id = p_report_id;
  if not found or not (v_report.status in ('validado', 'cerrado') or v_report.created_by = v_uid) then
    raise exception 'Solo se pueden actualizar reportes publicados en el mapa.' using errcode = '42501';
  end if;

  if p_lat is null or p_lng is null or p_accuracy is null then
    raise exception 'Se requiere la ubicación GPS del dispositivo.' using errcode = '22023';
  end if;
  if p_accuracy > 100 then
    raise exception 'La precisión del GPS es insuficiente (± % m). Busque cielo abierto e intente de nuevo.', round(p_accuracy)
      using errcode = '22023';
  end if;

  v_distance := extensions.st_distance(
    v_report.geom,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography);
  if v_distance > 150 then
    raise exception 'Debe estar a menos de 150 m del daño para actualizarlo (está a % m).', round(v_distance)
      using errcode = '22023';
  end if;

  if p_comment is not null and char_length(p_comment) > 300 then
    raise exception 'El comentario admite hasta 300 caracteres.' using errcode = '22023';
  end if;

  if p_photo_path is null or split_part(p_photo_path, '/', 1) <> v_uid::text then
    raise exception 'Fotografía no autorizada.' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'evidencias' and o.name = p_photo_path) then
    raise exception 'Fotografía no encontrada. Tómela de nuevo.' using errcode = '22023';
  end if;

  -- Antiabuso: una actualización por reporte cada hora y 20 por hora en total
  select count(*) into v_n from public.report_updates u
   where u.created_by = v_uid and u.report_id = p_report_id and u.created_at > now() - interval '1 hour';
  if v_n > 0 then
    raise exception 'Ya actualizó este reporte en la última hora.' using errcode = '54000';
  end if;
  select count(*) into v_n from public.report_updates u
   where u.created_by = v_uid and u.created_at > now() - interval '1 hour';
  if v_n >= 20 then
    raise exception 'Ha alcanzado el límite de actualizaciones por hora.' using errcode = '54000';
  end if;

  insert into public.report_updates (report_id, created_by, condition, comment, lat, lng, accuracy_m, distance_m, photo_path)
  values (p_report_id, v_uid, p_condition, nullif(btrim(coalesce(p_comment, '')), ''), p_lat, p_lng, p_accuracy, v_distance, p_photo_path)
  returning report_updates.id into v_id;

  return query select v_id, v_distance::real;
end;
$$;

revoke all on function public.submit_report_update(uuid, public.update_condition, text, double precision, double precision, real, text, boolean) from public, anon;
grant execute on function public.submit_report_update(uuid, public.update_condition, text, double precision, double precision, real, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- RPC: feed comunitario (solo reportes publicados, sin datos personales)
-- ---------------------------------------------------------------------
create or replace function public.community_feed(p_limit integer default 40)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with publicos as (
    select r.*,
           coalesce((select max(h.created_at) from public.status_history h
                      where h.report_id = r.id and h.to_status = 'validado'), r.created_at) as publicado_en,
           (select p.storage_path from public.report_photos p where p.report_id = r.id order by p.created_at limit 1) as foto,
           (select count(*) from public.report_updates u where u.report_id = r.id) as n_updates,
           (select u.condition from public.report_updates u where u.report_id = r.id order by u.created_at desc limit 1) as ultima_condicion
      from public.reports r
     where r.status in ('validado', 'cerrado')
  ),
  eventos as (
    select 'reporte'::text as tipo, p.publicado_en as fecha, p.id as report_id, p.code, p.category_code, p.sector, p.address,
           left(p.description, 220) as texto, p.status::text as estado, null::text as condicion, p.foto,
           p.n_updates, p.ultima_condicion::text, p.is_demo
      from publicos p
    union all
    select 'actualizacion', u.created_at, p.id, p.code, p.category_code, p.sector, p.address,
           u.comment, p.status::text, u.condition::text, u.photo_path,
           p.n_updates, p.ultima_condicion::text, p.is_demo
      from public.report_updates u join publicos p on p.id = u.report_id
  )
  select coalesce(jsonb_agg(to_jsonb(e) order by e.fecha desc), '[]'::jsonb)
    from (select * from eventos order by fecha desc limit greatest(1, least(p_limit, 100))) e;
$$;
grant execute on function public.community_feed(integer) to anon, authenticated;

-- Indicadores: incluye el número de actualizaciones ciudadanas
create or replace function public.report_stats()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'total',       (select count(*) from public.reports),
    'publicos',    (select count(*) from public.reports where status in ('validado', 'cerrado')),
    'ultimos_7d',  (select count(*) from public.reports where created_at > now() - interval '7 days'),
    'actualizaciones', (select count(*) from public.report_updates),
    'por_estado',  coalesce((select jsonb_object_agg(status, n) from
                     (select status, count(*) n from public.reports group by status) s), '{}'::jsonb),
    'por_categoria', coalesce((select jsonb_object_agg(category_code, n) from
                     (select category_code, count(*) n from public.reports group by category_code) c), '{}'::jsonb)
  );
$$;
