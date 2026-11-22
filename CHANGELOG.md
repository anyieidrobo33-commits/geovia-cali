# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

## [1.3.0] — 2026-11-22

### Agregado
- **Estadísticas de la ciudad** (`/estadisticas`): indicadores, tendencia semanal, tipos de daño, barrios con más reportes, estado de verificación, severidad, observaciones en sitio, mediana de horas hasta la verificación y los reportes más apoyados.
- **Apoyos «Yo también lo vi»**: un toque para respaldar un reporte (sin cuenta). El panel de revisión prioriza los pendientes más apoyados.
- **Zonas críticas**: mapa de calor ponderado por severidad y apoyos.
- **Compartir** un reporte (hoja nativa del celular o WhatsApp).
- **Datos abiertos**: descarga en GeoJSON y CSV (CC BY 4.0), sin datos personales.
- Migración 006 y 4 pruebas SQL nuevas (27 en total); 4 pruebas unitarias nuevas (36 en total).

### Cambiado
- **Visibilidad pública desde la recepción** (migración 005): los reportes aparecen en el mapa y en la comunidad apenas se envían, marcados «sin verificar»; solo los rechazados se ocultan. Las actualizaciones ciudadanas se permiten en cualquier reporte no rechazado.
- La comunidad muestra también cuándo un revisor verifica un reporte.

## [1.2.0] — 2026-11-22

### Agregado
- **Comunidad** (`/comunidad`): muro con los últimos daños publicados y las actualizaciones ciudadanas, con foto.
- **Actualizar reporte** (`/r/:código/actualizar`): cualquier persona, con o sin cuenta, informa si el daño sigue igual, empeoró, mejoró o ya fue reparado. Solo se acepta:
  - ubicación GPS a ≤ 150 m del daño con precisión ≤ 100 m (verificada en la app y en el servidor);
  - foto tomada en el momento con la **cámara en vivo**, sin opción de galería.
- La ubicación exacta y la identidad de quien actualiza no se publican (permisos por columna).
- Foto del daño y botón «Actualizar» en la ventana de cada marcador del mapa.
- Migración 003 (actualizaciones y muro) y 004 (endurecimiento según el asesor de seguridad de Supabase).
- 5 pruebas SQL nuevas (TC11 y privacidad) y 5 pruebas unitarias nuevas.

### Cambiado
- Barra inferior del celular: Mapa · Comunidad · Reportar · Seguimiento · Mis reportes.
- Plataforma en producción: Supabase (proyecto `geovia-cali`) y Vercel (`geovia-cali.vercel.app`), con 4 de los 9 reportes de campo publicados.

## [1.1.0] — 2026-11-22

### Agregado
- 9 reportes reales de campo en Cali (fotografías y coordenadas) y el cargador `npm run cargar:reportes`, que los envía como ciudadanos sin cuenta, cada uno con su propia sesión anónima.
- Centro de ayuda en la app (`/ayuda`): guía rápida, estados y preguntas frecuentes.
- Manual de usuario con capturas de todas las pantallas.
- Créditos de los autores en la app, el README y la licencia.

### Cambiado
- Al crear una cuenta desde una sesión anónima, la sesión se cierra antes del registro (Supabase exige verificar el correo para vincular identidades); los reportes previos siguen disponibles por su código.
- Cada pantalla nueva se abre desde arriba.
- La ventana de detalle de un marcador ya no queda oculta bajo la barra de filtros del mapa.

## [1.0.0] — 2026-11-19

### Agregado
- Reporte ciudadano en 4 pasos con GPS o mapa, fotos sin EXIF y borrador local.
- Mapa público con filtros, vista de lista y aviso de duplicados (PostGIS).
- Seguimiento por código con historial de estados.
- Panel de revisión con matriz de transiciones, bitácora inmutable, exportación CSV y gestión de roles.
- Esquema PostgreSQL con RLS, funciones RPC auditadas y bucket privado.
- PWA instalable (Android e iPhone).
- 27 pruebas unitarias, 17 pruebas SQL de seguridad e integración continua.
