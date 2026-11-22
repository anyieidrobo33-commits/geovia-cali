-- =====================================================================
-- GeoVía Cali · Migración 006 · Apoyos ciudadanos y estadísticas públicas
-- · «Yo también lo vi»: un apoyo por persona y reporte (sesión anónima o cuenta)
-- · Contador de apoyos en el reporte (prioriza la revisión)
-- · public_stats(): indicadores agregados sin datos personales
-- =====================================================================

alter table public.reports add column if not exists supports_count integer not null default 0;

create table if not exists public.report_supports (
  report_id  uuid not null references public.reports (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
create index if not exists report_supports_user_idx on public.report_supports (user_id, created_at desc);

alter table public.report_supports enable row level security;
-- Sin políticas: la tabla solo se usa a través de funciones RPC.
revoke all on public.report_supports from anon, authenticated;

-- Un cambio en el contador de apoyos no altera la "última actualización" del reporte
create or replace function public.reports_before_write()
returns trigger
language plpgsql set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' and new.supports_count is distinct from old.supports_count
     and new.status = old.status and new.description = old.description then
    new.updated_at := old.updated_at;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.code := coalesce(new.code, public.generate_report_code());
    new.created_at := coalesce(new.created_at, now());
  end if;
  new.description := btrim(new.description);
  new.reference   := nullif(btrim(coalesce(new.reference, '')), '');
  new.geom        := extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography;
  new.updated_at  := now();
  return new;
end;
$$;
revoke execute on function public.reports_before_write() from public, anon, authenticated;

-- Apoyar / quitar apoyo
create or replace function public.toggle_support(p_report_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_report public.reports;
  v_exists boolean;
  v_n      int;
begin
  if v_uid is null then
    raise exception 'Debe iniciar una sesión para apoyar.' using errcode = '42501';
  end if;
  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found or v_report.status = 'rechazado' then
    raise exception 'Este reporte no se puede apoyar.' using errcode = '42501';
  end if;
  if v_report.created_by = v_uid then
    raise exception 'No puede apoyar su propio reporte.' using errcode = '22023';
  end if;

  select exists (select 1 from public.report_supports s where s.report_id = p_report_id and s.user_id = v_uid) into v_exists;
  if v_exists then
    delete from public.report_supports s where s.report_id = p_report_id and s.user_id = v_uid;
    update public.reports set supports_count = greatest(0, supports_count - 1) where id = p_report_id
      returning supports_count into v_n;
    return jsonb_build_object('supported', false, 'count', v_n);
  end if;

  if (select count(*) from public.report_supports s
       where s.user_id = v_uid and s.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Ha alcanzado el límite de apoyos por hora.' using errcode = '54000';
  end if;

  insert into public.report_supports (report_id, user_id) values (p_report_id, v_uid);
  update public.reports set supports_count = supports_count + 1 where id = p_report_id
    returning supports_count into v_n;
  return jsonb_build_object('supported', true, 'count', v_n);
end;
$$;
revoke all on function public.toggle_support(uuid) from public, anon;
grant execute on function public.toggle_support(uuid) to authenticated;

create or replace function public.my_supported_reports()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select s.report_id from public.report_supports s where s.user_id = auth.uid();
$$;
revoke all on function public.my_supported_reports() from public, anon;
grant execute on function public.my_supported_reports() to authenticated;

-- Feed comunitario con apoyos
create or replace function public.community_feed(p_limit integer default 40)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with visibles as (
    select r.*,
           (select p.storage_path from public.report_photos p where p.report_id = r.id order by p.created_at limit 1) as foto,
           (select count(*) from public.report_updates u where u.report_id = r.id) as n_updates,
           (select u.condition from public.report_updates u where u.report_id = r.id order by u.created_at desc limit 1) as ultima_condicion
      from public.reports r
     where r.status <> 'rechazado'
  ),
  eventos as (
    select 'reporte'::text as tipo, v.created_at as fecha, v.id as report_id, v.code, v.category_code, v.sector, v.address,
           left(v.description, 220) as texto, v.status::text as estado, null::text as condicion, v.foto,
           v.n_updates, v.ultima_condicion::text, v.is_demo, v.supports_count as apoyos
      from visibles v
    union all
    select 'validacion', h.created_at, v.id, v.code, v.category_code, v.sector, v.address,
           h.reason, v.status::text, null::text, v.foto,
           v.n_updates, v.ultima_condicion::text, v.is_demo, v.supports_count
      from public.status_history h join visibles v on v.id = h.report_id
     where h.to_status = 'validado'
    union all
    select 'actualizacion', u.created_at, v.id, v.code, v.category_code, v.sector, v.address,
           u.comment, v.status::text, u.condition::text, u.photo_path,
           v.n_updates, v.ultima_condicion::text, v.is_demo, v.supports_count
      from public.report_updates u join visibles v on v.id = u.report_id
  )
  select coalesce(jsonb_agg(to_jsonb(e) order by e.fecha desc), '[]'::jsonb)
    from (select * from eventos order by fecha desc limit greatest(1, least(p_limit, 100))) e;
$$;
grant execute on function public.community_feed(integer) to anon, authenticated;

-- Estadísticas públicas (solo agregados; excluye rechazados)
create or replace function public.public_stats()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with v as (select * from public.reports where status <> 'rechazado'),
  semanas as (
    select generate_series(
             date_trunc('week', (now() at time zone 'America/Bogota')) - interval '11 weeks',
             date_trunc('week', (now() at time zone 'America/Bogota')),
             interval '1 week') as semana
  ),
  validacion as (
    select extract(epoch from (min(h.created_at) - r.created_at)) / 3600.0 as horas
      from public.reports r join public.status_history h on h.report_id = r.id and h.to_status = 'validado'
     group by r.id, r.created_at
  )
  select jsonb_build_object(
    'total',           (select count(*) from v),
    'verificados',     (select count(*) from v where status in ('validado', 'cerrado')),
    'sin_verificar',   (select count(*) from v where status in ('recibido', 'en_revision')),
    'actualizaciones', (select count(*) from public.report_updates u join v on v.id = u.report_id),
    'apoyos',          (select coalesce(sum(supports_count), 0) from v),
    'reparados_segun_ciudadanos', (select count(distinct u.report_id) from public.report_updates u join v on v.id = u.report_id
                                    where u.condition = 'reparado'),
    'horas_validacion_mediana', (select round(percentile_cont(0.5) within group (order by horas)::numeric, 1) from validacion),
    'por_semana', (select coalesce(jsonb_agg(jsonb_build_object('semana', to_char(s.semana, 'YYYY-MM-DD'),
                      'n', (select count(*) from v where date_trunc('week', v.created_at at time zone 'America/Bogota') = s.semana))
                      order by s.semana), '[]'::jsonb) from semanas s),
    'por_categoria', coalesce((select jsonb_object_agg(category_code, n) from
                      (select category_code, count(*) n from v group by category_code) c), '{}'::jsonb),
    'por_estado', coalesce((select jsonb_object_agg(status, n) from
                      (select status, count(*) n from v group by status) s), '{}'::jsonb),
    'por_severidad', coalesce((select jsonb_object_agg(severity, n) from
                      (select severity, count(*) n from v group by severity) s), '{}'::jsonb),
    'top_sectores', coalesce((select jsonb_agg(jsonb_build_object('sector', sector, 'n', n) order by n desc, sector) from
                      (select sector, count(*) n from v where sector is not null group by sector order by count(*) desc, sector limit 8) t), '[]'::jsonb),
    'mas_apoyados', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'category_code', category_code, 'sector', sector,
                      'apoyos', supports_count, 'status', status) order by supports_count desc, created_at) from
                      (select * from v where supports_count > 0 order by supports_count desc, created_at limit 5) t), '[]'::jsonb),
    'condiciones', coalesce((select jsonb_object_agg(condition, n) from
                      (select u.condition, count(*) n from public.report_updates u join v on v.id = u.report_id group by u.condition) c), '{}'::jsonb)
  );
$$;
grant execute on function public.public_stats() to anon, authenticated;
