-- =====================================================================
-- GeoVía Cali · Pruebas automatizadas de reglas de negocio y seguridad
-- Ejecutar en Supabase → SQL Editor DESPUÉS de las migraciones 001 y 002.
-- No deja rastro: todo se ejecuta dentro de un bloque que se revierte.
-- Resultado: una tabla con caso de prueba, esperado, observado y veredicto.
-- =====================================================================

create temp table if not exists resultados_pruebas (
  orden     int,
  caso      text,
  descripcion text,
  esperado  text,
  observado text,
  veredicto text
);
truncate resultados_pruebas;

do $$
declare
  v_ciudadano uuid := gen_random_uuid();
  v_otro      uuid := gen_random_uuid();
  v_revisor   uuid := gen_random_uuid();
  v_report    uuid;
  v_code      text;
  v_path      text;
  v_res       text[][] := array[]::text[][];
  v_n         int;
  v_txt       text;
  v_json      jsonb;
begin
  begin -- bloque revertible --------------------------------------------

    -- Usuarios de prueba (perfil creado por disparador)
    insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values (v_ciudadano, 'ciudadano.prueba@geovia.test', 'authenticated', 'authenticated', '{"display_name":"Ciudadano prueba"}'),
           (v_otro,      'otro.prueba@geovia.test',      'authenticated', 'authenticated', '{}'),
           (v_revisor,   'revisor.prueba@geovia.test',   'authenticated', 'authenticated', '{}');
    update public.profiles set role = 'revisor' where id = v_revisor;

    v_path := v_ciudadano::text || '/prueba/foto-1.jpg';
    insert into storage.objects (bucket_id, name, owner) values ('evidencias', v_path, v_ciudadano);

    -- === Actuar como ciudadano =========================================
    perform set_config('request.jwt.claims', json_build_object('sub', v_ciudadano, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    -- TC01 Registro válido
    begin
      select s.id, s.code into v_report, v_code
        from public.submit_report('hueco', 'alta', 'Hueco de prueba automatizada frente al paradero.', 'Frente al paradero',
                                  3.4516, -76.5320, 8, 'gps', 'Calle 12 con Carrera 5', 'San Pedro',
                                  array[v_path], true) s;
      v_res := v_res || array[['TC01', 'Registrar reporte válido con foto y ubicación', 'Código GVC-AAMM-XXXXX',
                               coalesce(v_code, 'sin código'),
                               case when v_code ~ '^GVC-\d{4}-[2-9A-HJ-NP-Z]{5}$' then 'APROBADO' else 'FALLIDO' end]];
    exception when others then
      v_res := v_res || array[['TC01', 'Registrar reporte válido con foto y ubicación', 'Código GVC-AAMM-XXXXX', sqlerrm, 'FALLIDO']];
    end;

    -- TC09a Descripción insuficiente
    begin
      perform public.submit_report('hueco', 'media', 'corto', null, 3.45, -76.53, null, 'mapa', null, null, array[v_path], true);
      v_res := v_res || array[['TC09', 'Rechazar descripción con menos de 15 caracteres', 'Error de validación', 'Aceptado', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC09', 'Rechazar descripción con menos de 15 caracteres', 'Error de validación', sqlerrm, 'APROBADO']];
    end;

    -- TC09b Coordenadas fuera de Cali (Bogotá)
    begin
      perform public.submit_report('hueco', 'media', 'Descripción suficientemente larga.', null, 4.711, -74.072, null, 'mapa', null, null, array[v_path], true);
      v_res := v_res || array[['TC09', 'Rechazar coordenadas fuera de Santiago de Cali', 'Error de validación', 'Aceptado', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC09', 'Rechazar coordenadas fuera de Santiago de Cali', 'Error de validación', sqlerrm, 'APROBADO']];
    end;

    -- TC09c Sin consentimiento
    begin
      perform public.submit_report('hueco', 'media', 'Descripción suficientemente larga.', null, 3.45, -76.53, null, 'mapa', null, null, array[v_path], false);
      v_res := v_res || array[['TC09', 'Exigir consentimiento de tratamiento de datos', 'Error de validación', 'Aceptado', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC09', 'Exigir consentimiento de tratamiento de datos', 'Error de validación', sqlerrm, 'APROBADO']];
    end;

    -- TC02 Foto ausente / foto de otra carpeta
    begin
      perform public.submit_report('hueco', 'media', 'Descripción suficientemente larga.', null, 3.45, -76.53, null, 'mapa', null, null, array[]::text[], true);
      v_res := v_res || array[['TC02', 'Exigir al menos una fotografía', 'Error de validación', 'Aceptado', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC02', 'Exigir al menos una fotografía', 'Error de validación', sqlerrm, 'APROBADO']];
    end;
    begin
      perform public.submit_report('hueco', 'media', 'Descripción suficientemente larga.', null, 3.45, -76.53, null, 'mapa', null, null,
                                   array[v_otro::text || '/x/robada.jpg'], true);
      v_res := v_res || array[['TC02', 'Impedir usar fotografías de otra persona', 'Acceso denegado', 'Aceptado', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC02', 'Impedir usar fotografías de otra persona', 'Acceso denegado', sqlerrm, 'APROBADO']];
    end;

    -- TC06a Ciudadano intenta cambiar estado por RPC
    begin
      perform public.change_report_status(v_report, 'validado', 'Intento no autorizado de validación.');
      v_res := v_res || array[['TC06', 'Ciudadano no puede cambiar estados (RPC)', 'Acceso denegado', 'Permitido', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC06', 'Ciudadano no puede cambiar estados (RPC)', 'Acceso denegado', sqlerrm, 'APROBADO']];
    end;

    -- TC06b Ciudadano intenta UPDATE directo
    begin
      update public.reports set status = 'validado' where id = v_report;
      get diagnostics v_n = row_count;
      v_res := v_res || array[['TC06', 'Ciudadano no puede modificar la tabla directamente', '0 filas modificadas',
                               v_n || ' filas modificadas', case when v_n = 0 then 'APROBADO' else 'FALLIDO' end]];
    exception when others then
      v_res := v_res || array[['TC06', 'Ciudadano no puede modificar la tabla directamente', '0 filas modificadas', sqlerrm, 'APROBADO']];
    end;

    -- TC05 Consulta por código con historial
    v_json := public.get_report_by_code(v_code);
    v_res := v_res || array[['TC05', 'Consultar ficha e historial por código', 'Estado recibido y 1 hito',
                             coalesce(v_json ->> 'status', 'null') || ', ' || coalesce(jsonb_array_length(v_json -> 'history'), 0) || ' hito(s)',
                             case when v_json ->> 'status' = 'recibido' and jsonb_array_length(v_json -> 'history') = 1 then 'APROBADO' else 'FALLIDO' end]];

    -- TC07 Advertencia de duplicado cercano (punto a ~15 m)
    select count(*) into v_n from public.nearby_reports(3.45173, -76.53206, 30, 120, null) n where n.id = v_report;
    v_res := v_res || array[['TC07', 'Detectar reporte cercano en radio de 30 m', 'Reporte detectado',
                             case when v_n > 0 then 'Detectado' else 'No detectado' end,
                             case when v_n > 0 then 'APROBADO' else 'FALLIDO' end]];

    -- === Actuar como otro ciudadano ====================================
    perform set_config('request.jwt.claims', json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
    select count(*) into v_n from public.reports where id = v_report;
    v_res := v_res || array[['RNF02', 'Otro ciudadano no ve reportes pendientes ajenos', '0 filas visibles',
                             v_n || ' filas visibles', case when v_n = 0 then 'APROBADO' else 'FALLIDO' end]];

    -- === Actuar como visitante anónimo =================================
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
    select count(*) into v_n from public.reports where status not in ('validado', 'cerrado');
    v_res := v_res || array[['TC03', 'Visitante solo ve reportes validados o cerrados', '0 no publicados visibles',
                             v_n || ' no publicados visibles', case when v_n = 0 then 'APROBADO' else 'FALLIDO' end]];

    -- === Actuar como revisor ===========================================
    perform set_config('request.jwt.claims', json_build_object('sub', v_revisor, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    begin
      perform public.change_report_status(v_report, 'cerrado', 'Intento de saltar etapas de revisión.');
      v_res := v_res || array[['TC10', 'Bloquear transición no permitida (recibido → cerrado)', 'Error de transición', 'Permitido', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC10', 'Bloquear transición no permitida (recibido → cerrado)', 'Error de transición', sqlerrm, 'APROBADO']];
    end;

    begin
      perform public.change_report_status(v_report, 'en_revision', '');
      v_res := v_res || array[['TC10', 'Exigir motivo en cada cambio de estado', 'Error de validación', 'Permitido', 'FALLIDO']];
    exception when others then
      v_res := v_res || array[['TC10', 'Exigir motivo en cada cambio de estado', 'Error de validación', sqlerrm, 'APROBADO']];
    end;

    begin
      perform public.change_report_status(v_report, 'en_revision', 'Inicio de revisión de la prueba automatizada.');
      perform public.change_report_status(v_report, 'validado', 'Ubicación y evidencia consistentes en la prueba.');
      select count(*) into v_n from public.status_history h
       where h.report_id = v_report and h.actor_role = 'revisor' and h.changed_by = v_revisor;
      v_res := v_res || array[['TC10', 'Revisor cambia estado y queda en bitácora con autor, rol y fecha', '2 hitos del revisor',
                               v_n || ' hitos del revisor', case when v_n = 2 then 'APROBADO' else 'FALLIDO' end]];
    exception when others then
      v_res := v_res || array[['TC10', 'Revisor cambia estado y queda en bitácora con autor, rol y fecha', '2 hitos del revisor', sqlerrm, 'FALLIDO']];
    end;

    begin
      update public.status_history set reason = 'alterado' where report_id = v_report;
      get diagnostics v_n = row_count;
      v_res := v_res || array[['RNF05', 'La bitácora no puede alterarse', '0 filas alteradas',
                               v_n || ' filas alteradas', case when v_n = 0 then 'APROBADO' else 'FALLIDO' end]];
    exception when others then
      v_res := v_res || array[['RNF05', 'La bitácora no puede alterarse', '0 filas alteradas', sqlerrm, 'APROBADO']];
    end;

    -- Visitante ahora sí ve el reporte validado
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
    select count(*) into v_n from public.reports where id = v_report;
    v_res := v_res || array[['TC03', 'Reporte validado aparece en la consulta pública', '1 fila visible',
                             v_n || ' fila visible', case when v_n = 1 then 'APROBADO' else 'FALLIDO' end]];

    raise exception 'GEOVIA_ROLLBACK';
  exception when others then
    if sqlerrm <> 'GEOVIA_ROLLBACK' then
      v_res := v_res || array[['ERROR', 'Error no controlado en la batería', '-', sqlerrm, 'FALLIDO']];
    end if;
  end; -- todo lo anterior queda revertido ------------------------------

  for v_n in 1 .. coalesce(array_length(v_res, 1), 0) loop
    insert into resultados_pruebas values (v_n, v_res[v_n][1], v_res[v_n][2], v_res[v_n][3], v_res[v_n][4], v_res[v_n][5]);
  end loop;
end $$;

select orden, caso, descripcion, esperado, observado, veredicto
  from resultados_pruebas order by orden;
