# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

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
