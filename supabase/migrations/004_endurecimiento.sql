-- =====================================================================
-- GeoVía Cali · Migración 004 · Endurecimiento (asesor de seguridad Supabase)
-- Las funciones de disparador no deben poder invocarse por la API REST.
-- (Los disparadores siguen funcionando: el permiso EXECUTE solo se
--  verifica al crear el disparador, no al ejecutarse.)
-- =====================================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.reports_after_insert() from public, anon, authenticated;
revoke execute on function public.reports_before_write() from public, anon, authenticated;
revoke execute on function public.status_history_immutable() from public, anon, authenticated;
revoke execute on function public.generate_report_code() from public, anon, authenticated;

alter function public.status_history_immutable() set search_path = public;

-- Nota: app_role(), is_staff() e is_admin() permanecen ejecutables porque las
-- políticas RLS las evalúan con el rol de quien consulta; solo revelan el rol
-- de la propia sesión. get_report_by_code, nearby_reports, community_feed y
-- report_stats son públicas por diseño y no exponen datos personales.
