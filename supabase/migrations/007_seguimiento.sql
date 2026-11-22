-- =====================================================================
-- GeoVía Cali · Migración 007 · Seguimiento de reportes (notificaciones)
-- Devuelve el estado resumido de los reportes que una persona sigue, para
-- detectar cambios (estado, verificación, actualizaciones ciudadanas).
-- Solo datos que ya son públicos por código; sin datos personales.
-- =====================================================================
create or replace function public.follow_status(p_ids uuid[])
returns table (id uuid, code text, category_code text, sector text, status public.report_status,
               history_count bigint, updates_count bigint, last_update_condition public.update_condition,
               last_change_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select r.id, r.code, r.category_code, r.sector, r.status,
         (select count(*) from public.status_history h where h.report_id = r.id),
         (select count(*) from public.report_updates u where u.report_id = r.id),
         (select u.condition from public.report_updates u where u.report_id = r.id order by u.created_at desc limit 1),
         greatest(r.updated_at,
                  coalesce((select max(u.created_at) from public.report_updates u where u.report_id = r.id), r.updated_at))
    from public.reports r
   where r.id = any (p_ids[1:50]);
$$;
grant execute on function public.follow_status(uuid[]) to anon, authenticated;
