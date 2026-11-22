-- =====================================================================
-- GeoVía Cali · Migración 005 · Visibilidad pública desde la recepción
-- Los reportes se muestran públicamente desde que se reciben (marcados como
-- «sin verificar» hasta la validación). Solo los RECHAZADOS se ocultan al
-- público; su autor y los revisores los siguen viendo.
-- El autor nunca se expone (created_by es un identificador seudónimo y la
-- interfaz no lo muestra).
-- =====================================================================

drop policy if exists "reports: lectura según rol" on public.reports;
create policy "reports: lectura según rol" on public.reports
  for select using (
    status <> 'rechazado'
    or created_by = auth.uid()
    or public.is_staff()
  );

-- Seguimiento por código: acceso completo salvo reportes rechazados ajenos
create or replace function public.get_report_by_code(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_report public.reports;
  v_visible boolean;
begin
  select * into v_report from public.reports where code = upper(btrim(p_code));
  if not found then
    return null;
  end if;
  v_visible := v_report.status <> 'rechazado'
               or v_report.created_by = auth.uid() or public.is_staff();
  return jsonb_build_object(
    'id', v_report.id,
    'code', v_report.code,
    'category_code', v_report.category_code,
    'severity', v_report.severity,
    'status', v_report.status,
    'sector', v_report.sector,
    'created_at', v_report.created_at,
    'updated_at', v_report.updated_at,
    'is_demo', v_report.is_demo,
    'full_access', v_visible,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'from_status', h.from_status, 'to_status', h.to_status,
               'actor_role', h.actor_role, 'reason', h.reason, 'created_at', h.created_at)
             order by h.created_at)
        from public.status_history h where h.report_id = v_report.id), '[]'::jsonb)
  );
end;
$$;

-- Actualizaciones ciudadanas: permitidas en cualquier reporte visible (no rechazado)
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
  if not found or v_report.status = 'rechazado' then
    raise exception 'Este reporte no se puede actualizar.' using errcode = '42501';
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

-- Feed comunitario: todos los reportes visibles (no rechazados)
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
           v.n_updates, v.ultima_condicion::text, v.is_demo
      from visibles v
    union all
    select 'validacion', h.created_at, v.id, v.code, v.category_code, v.sector, v.address,
           h.reason, v.status::text, null::text, v.foto,
           v.n_updates, v.ultima_condicion::text, v.is_demo
      from public.status_history h join visibles v on v.id = h.report_id
     where h.to_status = 'validado'
    union all
    select 'actualizacion', u.created_at, v.id, v.code, v.category_code, v.sector, v.address,
           u.comment, v.status::text, u.condition::text, u.photo_path,
           v.n_updates, v.ultima_condicion::text, v.is_demo
      from public.report_updates u join visibles v on v.id = u.report_id
  )
  select coalesce(jsonb_agg(to_jsonb(e) order by e.fecha desc), '[]'::jsonb)
    from (select * from eventos order by fecha desc limit greatest(1, least(p_limit, 100))) e;
$$;
grant execute on function public.community_feed(integer) to anon, authenticated;
