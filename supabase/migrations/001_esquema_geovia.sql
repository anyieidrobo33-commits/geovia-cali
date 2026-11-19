-- =====================================================================
-- GeoVía Cali · Migración 001 · Esquema, reglas de negocio y seguridad
-- Ejecutar completo en Supabase → SQL Editor (una sola vez).
-- Requisitos cubiertos: RF01–RF10, RNF01, RNF02, RNF05.
-- =====================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------
do $$ begin
  create type public.report_status as enum
    ('recibido', 'en_revision', 'validado', 'duplicado', 'rechazado', 'cerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('ciudadano', 'revisor', 'admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------

-- Perfil mínimo (sin datos personales superfluos: RNF02)
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 60),
  role          public.user_role not null default 'ciudadano',
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Catálogo controlado de categorías
create table if not exists public.categories (
  code        text primary key,
  name        text not null,
  description text not null,
  sort        smallint not null default 0,
  active      boolean not null default true
);

-- Matriz de transiciones autorizadas (tabla 7.2 de la especificación)
create table if not exists public.status_transitions (
  from_status public.report_status not null,
  to_status   public.report_status not null,
  primary key (from_status, to_status)
);

-- Reporte de afectación vial
create table if not exists public.reports (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  created_by           uuid references auth.users (id) on delete set null,
  category_code        text not null references public.categories (code),
  severity             text not null default 'media' check (severity in ('baja', 'media', 'alta')),
  description          text not null check (char_length(description) between 15 and 1000),
  reference            text check (char_length(reference) <= 200),
  lat                  double precision not null check (lat between 3.25 and 3.58),
  lng                  double precision not null check (lng between -76.72 and -76.42),
  geom                 extensions.geography(Point, 4326),
  location_accuracy_m  real check (location_accuracy_m is null or location_accuracy_m >= 0),
  location_source      text not null default 'mapa' check (location_source in ('gps', 'mapa')),
  address              text check (char_length(address) <= 250),
  sector               text check (char_length(sector) <= 120),
  status               public.report_status not null default 'recibido',
  duplicate_of         uuid references public.reports (id),
  consent_at           timestamptz not null,
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint duplicate_not_self check (duplicate_of is null or duplicate_of <> id)
);

create index if not exists reports_geom_idx     on public.reports using gist (geom);
create index if not exists reports_status_idx   on public.reports (status);
create index if not exists reports_category_idx on public.reports (category_code);
create index if not exists reports_created_idx  on public.reports (created_at desc);
create index if not exists reports_owner_idx    on public.reports (created_by);

-- Evidencias fotográficas (archivo referenciado por ruta, nunca embebido)
create table if not exists public.report_photos (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.reports (id) on delete cascade,
  storage_path  text not null unique,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists report_photos_report_idx on public.report_photos (report_id);

-- Bitácora inmutable de estados (RF05, RF10, RNF05)
create table if not exists public.status_history (
  id            bigint generated always as identity primary key,
  report_id     uuid not null references public.reports (id) on delete cascade,
  from_status   public.report_status,
  to_status     public.report_status not null,
  changed_by    uuid references auth.users (id) on delete set null,
  actor_role    public.user_role,
  reason        text not null,
  created_at    timestamptz not null default now()
);
create index if not exists status_history_report_idx on public.status_history (report_id, created_at);

-- ---------------------------------------------------------------------
-- 3. Datos de catálogo
-- ---------------------------------------------------------------------
insert into public.categories (code, name, description, sort) values
  ('hueco',        'Hueco o bache',              'Cavidad en la capa de rodadura que afecta el tránsito.', 1),
  ('grieta',       'Grietas o fisuras',          'Fisuras longitudinales, transversales o en piel de cocodrilo.', 2),
  ('hundimiento',  'Hundimiento',                'Depresión o asentamiento de la calzada.', 3),
  ('desgaste',     'Desgaste de la capa',        'Pérdida de material superficial, descascaramiento o agregado suelto.', 4),
  ('alcantarilla', 'Tapa o sumidero dañado',     'Tapa de alcantarilla o rejilla de sumidero rota, hundida o ausente.', 5),
  ('senalizacion', 'Señalización vial borrada',  'Demarcación o señal vial deteriorada asociada a la calzada.', 6),
  ('anden',        'Andén o bordillo dañado',    'Daño en andén o bordillo contiguo a la vía.', 7),
  ('otro',         'Otra afectación',            'Afectación visible de la malla vial no listada.', 8)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, sort = excluded.sort;

insert into public.status_transitions (from_status, to_status) values
  ('recibido',    'en_revision'), ('recibido',    'rechazado'),
  ('en_revision', 'validado'),    ('en_revision', 'duplicado'), ('en_revision', 'rechazado'),
  ('validado',    'cerrado'),     ('validado',    'en_revision'),
  ('duplicado',   'cerrado'),     ('duplicado',   'en_revision'),
  ('rechazado',   'en_revision'),
  ('cerrado',     'en_revision')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Funciones auxiliares de seguridad
-- ---------------------------------------------------------------------
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'ciudadano'::public.user_role);
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('revisor', 'admin'));
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Código legible de reporte: GVC-AAMM-XXXXX (sin caracteres confundibles)
create or replace function public.generate_report_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := 'GVC-' || to_char(now() at time zone 'America/Bogota', 'YYMM') || '-';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.reports where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Disparadores
-- ---------------------------------------------------------------------

-- Perfil automático al crear usuario (incluye sesiones anónimas)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_anonymous)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), ''),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Normalización e integridad de reportes
create or replace function public.reports_before_write()
returns trigger
language plpgsql set search_path = public, extensions
as $$
begin
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

drop trigger if exists reports_before_write on public.reports;
create trigger reports_before_write
  before insert or update on public.reports
  for each row execute function public.reports_before_write();

-- Primer hito de la bitácora
create or replace function public.reports_after_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.status_history (report_id, from_status, to_status, changed_by, actor_role, reason, created_at)
  values (new.id, null, new.status, new.created_by,
          case when new.created_by is null then null else 'ciudadano'::public.user_role end,
          'Reporte registrado con datos obligatorios completos.', new.created_at);
  return new;
end;
$$;

drop trigger if exists reports_after_insert on public.reports;
create trigger reports_after_insert
  after insert on public.reports
  for each row execute function public.reports_after_insert();

-- La bitácora no se edita (append-only). Tampoco se borra desde la API:
-- no existe política DELETE; solo el borrado en cascada de un reporte
-- ejecutado por el administrador de la base de datos la elimina.
create or replace function public.status_history_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'La bitácora de estados es inmutable.' using errcode = '42501';
end;
$$;

drop trigger if exists status_history_no_update on public.status_history;
create trigger status_history_no_update
  before update on public.status_history
  for each row execute function public.status_history_immutable();

-- ---------------------------------------------------------------------
-- 6. Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.status_transitions enable row level security;
alter table public.reports            enable row level security;
alter table public.report_photos      enable row level security;
alter table public.status_history     enable row level security;

drop policy if exists "profiles: propio o staff" on public.profiles;
create policy "profiles: propio o staff" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists "categories: lectura pública" on public.categories;
create policy "categories: lectura pública" on public.categories
  for select using (true);

drop policy if exists "transitions: lectura pública" on public.status_transitions;
create policy "transitions: lectura pública" on public.status_transitions
  for select using (true);

-- Público: solo reportes validados o cerrados. Autor: los suyos. Staff: todos.
drop policy if exists "reports: lectura según rol" on public.reports;
create policy "reports: lectura según rol" on public.reports
  for select using (
    status in ('validado', 'cerrado')
    or created_by = auth.uid()
    or public.is_staff()
  );
-- Sin políticas INSERT/UPDATE/DELETE: toda escritura pasa por funciones RPC
-- auditadas (submit_report, change_report_status). Nadie borra evidencia.

drop policy if exists "photos: si el reporte es visible" on public.report_photos;
create policy "photos: si el reporte es visible" on public.report_photos
  for select using (exists (select 1 from public.reports r where r.id = report_id));

drop policy if exists "history: si el reporte es visible" on public.status_history;
create policy "history: si el reporte es visible" on public.status_history
  for select using (exists (select 1 from public.reports r where r.id = report_id));

-- ---------------------------------------------------------------------
-- 7. Almacenamiento de fotografías (bucket privado, URLs firmadas)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "evidencias: subir en carpeta propia" on storage.objects;
create policy "evidencias: subir en carpeta propia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists "evidencias: leer si el reporte es visible" on storage.objects;
create policy "evidencias: leer si el reporte es visible" on storage.objects
  for select using (
    bucket_id = 'evidencias'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.report_photos p where p.storage_path = name)
    )
  );

-- ---------------------------------------------------------------------
-- 8. Funciones RPC (lógica de aplicación protegida en servidor)
-- ---------------------------------------------------------------------

-- RF01, RF02, RF09: registrar reporte de forma atómica
create or replace function public.submit_report(
  p_category     text,
  p_severity     text,
  p_description  text,
  p_reference    text,
  p_lat          double precision,
  p_lng          double precision,
  p_accuracy     real,
  p_source       text,
  p_address      text,
  p_sector       text,
  p_photo_paths  text[],
  p_consent      boolean
)
returns table (id uuid, code text)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_report public.reports;
  v_path   text;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'Debe iniciar una sesión para reportar.' using errcode = '42501';
  end if;
  if coalesce(p_consent, false) is not true then
    raise exception 'Debe aceptar el tratamiento de datos para enviar el reporte.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories c where c.code = p_category and c.active) then
    raise exception 'Categoría no válida.' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between 3.25 and 3.58 or p_lng not between -76.72 and -76.42 then
    raise exception 'La ubicación debe estar dentro de Santiago de Cali.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) < 15 then
    raise exception 'La descripción debe tener al menos 15 caracteres.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_photo_paths, 1), 0) < 1 or array_length(p_photo_paths, 1) > 3 then
    raise exception 'Adjunte entre 1 y 3 fotografías.' using errcode = '22023';
  end if;

  -- Límite anti-abuso: 10 reportes por hora por sesión
  select count(*) into v_recent from public.reports r
   where r.created_by = v_uid and r.created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'Ha alcanzado el límite de reportes por hora. Intente más tarde.' using errcode = '54000';
  end if;

  -- Cada foto debe existir en el bucket y pertenecer a la carpeta del usuario
  foreach v_path in array p_photo_paths loop
    if split_part(v_path, '/', 1) <> v_uid::text then
      raise exception 'Fotografía no autorizada.' using errcode = '42501';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'evidencias' and o.name = v_path) then
      raise exception 'Fotografía no encontrada. Intente subirla de nuevo.' using errcode = '22023';
    end if;
  end loop;

  insert into public.reports (created_by, category_code, severity, description, reference,
                              lat, lng, location_accuracy_m, location_source, address, sector,
                              status, consent_at, is_demo)
  values (v_uid, p_category, coalesce(p_severity, 'media'), p_description, p_reference,
          p_lat, p_lng, p_accuracy, coalesce(p_source, 'mapa'),
          left(p_address, 250), left(p_sector, 120), 'recibido', now(), false)
  returning * into v_report;

  insert into public.report_photos (report_id, storage_path, created_by)
  select v_report.id, unnest(p_photo_paths), v_uid;

  return query select v_report.id, v_report.code;
end;
$$;

-- RF06, RF10: cambio de estado autorizado, validado y auditado
create or replace function public.change_report_status(
  p_report_id    uuid,
  p_new_status   public.report_status,
  p_reason       text,
  p_duplicate_of uuid default null
)
returns public.status_history
language plpgsql security definer set search_path = public
as $$
declare
  v_report public.reports;
  v_role   public.user_role := public.app_role();
  v_row    public.status_history;
begin
  if auth.uid() is null or v_role not in ('revisor', 'admin') then
    raise exception 'Solo un revisor autorizado puede cambiar estados.' using errcode = '42501';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Reporte no encontrado.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.status_transitions t
                  where t.from_status = v_report.status and t.to_status = p_new_status) then
    raise exception 'Transición no permitida: % → %.', v_report.status, p_new_status using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Registre un motivo de al menos 10 caracteres.' using errcode = '22023';
  end if;

  if p_new_status = 'duplicado' then
    if p_duplicate_of is null or p_duplicate_of = p_report_id
       or not exists (select 1 from public.reports where id = p_duplicate_of) then
      raise exception 'Indique el reporte principal del duplicado.' using errcode = '22023';
    end if;
  end if;

  update public.reports
     set status = p_new_status,
         duplicate_of = case when p_new_status = 'duplicado' then p_duplicate_of else duplicate_of end
   where id = p_report_id;

  insert into public.status_history (report_id, from_status, to_status, changed_by, actor_role, reason)
  values (p_report_id, v_report.status, p_new_status, auth.uid(), v_role, btrim(p_reason))
  returning * into v_row;

  return v_row;
end;
$$;

-- Seguimiento por código (no expone autor ni datos privados)
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
  v_visible := v_report.status in ('validado', 'cerrado')
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

-- RF07: posibles duplicados cercanos (ST_DWithin sobre geography, metros)
create or replace function public.nearby_reports(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 30,
  p_days integer default 120,
  p_exclude uuid default null
)
returns table (id uuid, code text, category_code text, status public.report_status,
               distance_m double precision, created_at timestamptz)
language sql stable security definer set search_path = public, extensions
as $$
  select r.id, r.code, r.category_code, r.status,
         round(extensions.st_distance(r.geom,
               extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)::numeric, 1)::double precision,
         r.created_at
    from public.reports r
   where r.status not in ('rechazado')
     and (p_exclude is null or r.id <> p_exclude)
     and r.created_at > now() - make_interval(days => greatest(1, least(p_days, 730)))
     and extensions.st_dwithin(r.geom,
           extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
           greatest(5, least(p_radius_m, 500)))
   order by 5
   limit 10;
$$;

-- Indicadores agregados (sin datos personales)
create or replace function public.report_stats()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'total',       (select count(*) from public.reports),
    'publicos',    (select count(*) from public.reports where status in ('validado', 'cerrado')),
    'ultimos_7d',  (select count(*) from public.reports where created_at > now() - interval '7 days'),
    'por_estado',  coalesce((select jsonb_object_agg(status, n) from
                     (select status, count(*) n from public.reports group by status) s), '{}'::jsonb),
    'por_categoria', coalesce((select jsonb_object_agg(category_code, n) from
                     (select category_code, count(*) n from public.reports group by category_code) c), '{}'::jsonb)
  );
$$;

-- Administración de roles (solo administrador)
create or replace function public.list_users()
returns table (id uuid, email text, display_name text, role public.user_role,
               is_anonymous boolean, created_at timestamptz, reports_count bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede consultar usuarios.' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.is_anonymous, p.created_at,
           (select count(*) from public.reports r where r.created_by = p.id)
      from public.profiles p join auth.users u on u.id = p.id
     where not p.is_anonymous
     order by p.created_at desc;
end;
$$;

create or replace function public.set_user_role(p_user uuid, p_role public.user_role)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede asignar roles.' using errcode = '42501';
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'No puede retirarse su propio rol de administrador.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where id = p_user and is_anonymous) then
    raise exception 'Las sesiones anónimas no pueden recibir roles.' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Permisos de ejecución
-- ---------------------------------------------------------------------
revoke all on function public.submit_report(text, text, text, text, double precision, double precision, real, text, text, text, text[], boolean) from public, anon;
grant execute on function public.submit_report(text, text, text, text, double precision, double precision, real, text, text, text, text[], boolean) to authenticated;

revoke all on function public.change_report_status(uuid, public.report_status, text, uuid) from public, anon;
grant execute on function public.change_report_status(uuid, public.report_status, text, uuid) to authenticated;

revoke all on function public.list_users() from public, anon;
grant execute on function public.list_users() to authenticated;

revoke all on function public.set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

grant execute on function public.get_report_by_code(text) to anon, authenticated;
grant execute on function public.nearby_reports(double precision, double precision, integer, integer, uuid) to anon, authenticated;
grant execute on function public.report_stats() to anon, authenticated;

grant select on public.categories, public.status_transitions, public.reports,
                public.report_photos, public.status_history to anon, authenticated;
grant select on public.profiles to authenticated;
