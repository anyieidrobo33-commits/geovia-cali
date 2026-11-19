-- =====================================================================
-- GeoVía Cali · Migración 002 · Datos de demostración (opcional)
-- Registros SIMULADOS, marcados con is_demo = true, para que el mapa
-- no esté vacío en la socialización. La interfaz los identifica como
-- "Dato de demostración" y pueden eliminarse con el bloque del final.
-- Coordenadas reales de vías de Santiago de Cali; las afectaciones son
-- ficticias y no corresponden a inspecciones oficiales.
-- =====================================================================

do $$
declare
  rec record;
  v_id uuid;
  v_created timestamptz;
  v_reasons constant jsonb := '{
    "en_revision": "Revisión de ubicación, descripción y coherencia de la evidencia.",
    "validado":    "Registro consistente: ubicación verificada sobre el mapa y descripción completa.",
    "cerrado":     "Seguimiento académico finalizado para el periodo de prueba.",
    "rechazado":   "La ubicación no corresponde a la malla vial (zona privada)."
  }';
  v_step text;
  v_prev public.report_status;
  v_t timestamptz;
begin
  if exists (select 1 from public.reports where is_demo) then
    raise notice 'Los datos de demostración ya existen; no se insertan de nuevo.';
    return;
  end if;

  for rec in
    select * from (values
      -- lat, lng, categoría, severidad, sector, dirección, descripción, estado final, días atrás
      (3.45161, -76.53195, 'hueco',        'alta',  'San Pedro (Comuna 3)',        'Calle 12 con Carrera 5',          'Hueco profundo en el carril derecho junto al semáforo; los vehículos lo esquivan invadiendo el otro carril.', 'validado', 52),
      (3.43702, -76.54418, 'grieta',       'media', 'San Fernando (Comuna 19)',    'Calle 5 con Carrera 34',          'Grietas en piel de cocodrilo sobre aproximadamente seis metros del carril lento.', 'validado', 47),
      (3.45903, -76.53318, 'desgaste',     'baja',  'Granada (Comuna 2)',          'Avenida 8 Norte con Calle 15',    'Desgaste superficial con agregado suelto en la zona de giro hacia la avenida.', 'cerrado', 58),
      (3.36021, -76.53082, 'hundimiento',  'alta',  'Ciudad Jardín (Comuna 22)',   'Carrera 105 con Calle 16',        'Hundimiento de la calzada cerca de la cámara de inspección, con empozamiento cuando llueve.', 'validado', 33),
      (3.37402, -76.52497, 'hueco',        'media', 'Valle del Lili (Comuna 17)',  'Carrera 98 con Calle 42',         'Dos baches consecutivos frente al paradero; afectan especialmente a motociclistas.', 'validado', 21),
      (3.38710, -76.53004, 'alcantarilla', 'alta',  'El Ingenio (Comuna 17)',      'Carrera 85 con Calle 13',         'Tapa de alcantarilla hundida unos cinco centímetros respecto al nivel de la vía.', 'en_revision', 6),
      (3.47603, -76.52811, 'senalizacion', 'baja',  'Chipichape (Comuna 2)',       'Calle 38 Norte con Avenida 6',    'Demarcación del paso peatonal casi borrada después de la última lluvia fuerte.', 'validado', 40),
      (3.48702, -76.52503, 'grieta',       'media', 'La Flora (Comuna 2)',         'Calle 52 Norte con Avenida 4',    'Fisura transversal que atraviesa los dos carriles a la salida del colegio.', 'validado', 29),
      (3.44302, -76.53203, 'hueco',        'alta',  'Alameda (Comuna 9)',          'Calle 9 con Carrera 24',          'Hueco amplio con bordes fracturados frente a la galería; genera trancones en hora pico.', 'validado', 15),
      (3.42501, -76.56004, 'desgaste',     'media', 'Siloé (Comuna 20)',           'Carrera 52 con Calle 2 Oeste',    'Pérdida de la capa de rodadura en la pendiente; se observa la base granular.', 'validado', 37),
      (3.42204, -76.48902, 'hueco',        'alta',  'Mojica (Comuna 15)',          'Carrera 28F con Calle 72',        'Bache grande que acumula agua y obliga a los buses a frenar bruscamente.', 'validado', 12),
      (3.43003, -76.47004, 'hundimiento',  'media', 'Potrero Grande (Comuna 21)',  'Calle 121 con Carrera 28D',       'Asentamiento leve de la calzada a lo largo del separador.', 'recibido', 2),
      (3.41604, -76.49503, 'anden',        'baja',  'El Vallado (Comuna 15)',      'Calle 48 con Carrera 40',         'Bordillo partido en la esquina, con escombros sobre la vía.', 'validado', 25),
      (3.43301, -76.47904, 'grieta',       'media', 'Marroquín (Comuna 14)',       'Calle 96 con Carrera 26',         'Grietas longitudinales paralelas a la cuneta en el costado oriental.', 'validado', 19),
      (3.48103, -76.50504, 'hueco',        'media', 'Calima (Comuna 4)',           'Calle 70 con Carrera 1',          'Hueco mediano junto a la tapa del sumidero, visible solo de día.', 'cerrado', 55),
      (3.47003, -76.49004, 'alcantarilla', 'alta',  'Alfonso López (Comuna 7)',    'Carrera 7 con Calle 77',          'Rejilla de sumidero ausente; el hueco queda expuesto en el carril.', 'validado', 9),
      (3.49503, -76.49204, 'desgaste',     'baja',  'Floralia (Comuna 6)',         'Calle 84 con Carrera 3N',         'Desgaste generalizado del pavimento en la vía de acceso al parque.', 'en_revision', 4),
      (3.38304, -76.54404, 'hueco',        'media', 'Meléndez (Comuna 18)',        'Calle 1 con Carrera 94',          'Bache en la entrada del barrio, frente a la tienda de la esquina.', 'validado', 31),
      (3.41003, -76.52004, 'grieta',       'alta',  'Autopista Sur (Comuna 10)',   'Autopista Sur Oriental con Carrera 44', 'Fisuras en bloque en el carril rápido de la autopista.', 'validado', 17),
      (3.41005, -76.54004, 'hundimiento',  'media', 'Pasoancho (Comuna 19)',       'Calle 13 con Carrera 56',         'Depresión en la calzada que forma un charco permanente.', 'duplicado', 11),
      (3.41803, -76.54003, 'hueco',        'baja',  'Tequendama (Comuna 19)',      'Calle 9A con Carrera 50',         'Bache pequeño en crecimiento junto al reductor de velocidad.', 'validado', 8),
      (3.44403, -76.51804, 'senalizacion', 'media', 'Junín (Comuna 9)',            'Calle 15 con Carrera 15',         'Línea de pare borrada en el cruce; los conductores no la perciben.', 'validado', 44),
      (3.41803, -76.47604, 'hueco',        'alta',  'El Poblado (Comuna 13)',      'Carrera 28 con Calle 73',         'Varios huecos encadenados en la vía principal del barrio.', 'validado', 14),
      (3.39904, -76.50004, 'desgaste',     'media', 'Ciudad Córdoba (Comuna 15)',  'Calle 54 con Carrera 47',         'Capa asfáltica desprendida en el carril derecho por unos diez metros.', 'recibido', 1),
      (3.46504, -76.52304, 'grieta',       'baja',  'Versalles (Comuna 2)',        'Avenida 4 Norte con Calle 23',    'Fisura capilar en la zona del paso de cebra; se sugiere seguimiento.', 'rechazado', 26),
      (3.45004, -76.54504, 'hueco',        'media', 'El Peñón (Comuna 3)',         'Avenida 4 Oeste con Calle 3',     'Bache sobre la avenida en el sentido hacia el oeste, cerca del puente.', 'validado', 23),
      (3.43004, -76.52004, 'alcantarilla', 'media', 'Santa Elena (Comuna 10)',     'Carrera 33 con Calle 25',         'Tapa de alcantarilla agrietada que suena al paso de vehículos pesados.', 'validado', 36),
      (3.40404, -76.55004, 'anden',        'media', 'Caney (Comuna 17)',           'Calle 16 con Carrera 70',         'Andén levantado por raíces junto al borde de la vía.', 'en_revision', 3)
    ) as t(lat, lng, cat, sev, sector, addr, descr, final_status, days_ago)
  loop
    v_created := now() - make_interval(days => rec.days_ago, hours => (random() * 10)::int);

    insert into public.reports (created_by, category_code, severity, description, lat, lng,
                                location_source, address, sector, status, consent_at, is_demo, created_at)
    values (null, rec.cat, rec.sev, rec.descr, rec.lat, rec.lng, 'mapa', rec.addr, rec.sector,
            'recibido', v_created, true, v_created)
    returning id into v_id;

    v_prev := 'recibido';
    v_t := v_created;
    foreach v_step in array (case rec.final_status
        when 'en_revision' then array['en_revision']
        when 'validado'    then array['en_revision', 'validado']
        when 'cerrado'     then array['en_revision', 'validado', 'cerrado']
        when 'rechazado'   then array['en_revision', 'rechazado']
        when 'duplicado'   then array['en_revision', 'duplicado']
        else array[]::text[] end)
    loop
      v_t := v_t + make_interval(hours => 6 + (random() * 40)::int);
      insert into public.status_history (report_id, from_status, to_status, actor_role, reason, created_at)
      values (v_id, v_prev, v_step::public.report_status, 'revisor',
              case when v_step = 'duplicado'
                   then 'Coincide con otro reporte cercano de la misma afectación.'
                   else v_reasons ->> v_step end,
              v_t);
      v_prev := v_step::public.report_status;
    end loop;

    update public.reports
       set status = v_prev,
           duplicate_of = case when v_prev = 'duplicado'
                               then (select r2.id from public.reports r2
                                      where r2.is_demo and r2.id <> v_id and r2.status = 'validado'
                                      order by r2.created_at limit 1)
                               else null end
     where id = v_id;
  end loop;
end $$;

-- Para eliminar los datos de demostración antes de un piloto real:
-- delete from public.reports where is_demo;
