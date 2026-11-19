<p align="center"><img src="public/icons/icon-192.png" width="96" alt="GeoVía Cali"></p>

<h1 align="center">GeoVía Cali</h1>
<p align="center"><i>Cada reporte, una ubicación; cada cambio, una historia.</i></p>

Prototipo funcional **TRL 5** de una plataforma web georreferenciada e instalable (PWA) para **registrar, clasificar, visualizar y hacer seguimiento** a reportes ciudadanos de afectaciones de la malla vial de Santiago de Cali.

Proyecto de grado · Ingeniería de Sistemas · Universidad Nacional Abierta y a Distancia (UNAD) · Metodología CDIO.

> Prototipo académico. No es un canal oficial de la Alcaldía de Santiago de Cali ni garantiza reparaciones.

## Funcionalidades

| Módulo | Descripción | Req. |
|---|---|---|
| Reporte ciudadano | Asistente de 4 pasos: ubicación por GPS o mapa (arrastrable), categoría, severidad orientativa, descripción, 1–3 fotos y consentimiento. Sin cuenta obligatoria (sesión anónima). | RF01, RF02, RF09 |
| Fotografías | Comprimidas en el dispositivo (máx. 1600 px) y **sin metadatos EXIF** (se elimina la ubicación GPS del teléfono). Bucket privado con URLs firmadas. | RF02, RNF02 |
| Mapa público | Marcadores por categoría (forma + ícono + color), filtros por tipo/estado/fecha/barrio, vista de lista alternativa, ubicación del usuario. | RF03, RF04, RNF04 |
| Duplicados | Aviso de reportes a menos de 30 m con PostGIS `ST_DWithin`. | RF07 |
| Seguimiento | Código legible `GVC-AAMM-XXXXX`, ficha con fotos, mini-mapa e historial de estados. | RF05 |
| Moderación | Panel de revisor: cola FIFO, indicadores, matriz de transiciones, motivo obligatorio, vinculación de duplicados. | RF06, RF10 |
| Bitácora | Cada cambio registra estado anterior/nuevo, rol, autor, fecha y motivo. Inmutable. | RF10, RNF05 |
| Exportación | CSV sin datos personales, compatible con Excel, protegido contra inyección de fórmulas. | RF08 |
| Roles | Visitante, ciudadano, revisor académico y administrador técnico (gestión de roles desde la app). | RNF01 |
| PWA | Instalable en Android e iPhone (ícono en la pantalla de inicio), caché sin conexión, borrador del reporte guardado localmente. | RNF08 |

## Arquitectura

```
┌───────────────────────────┐      HTTPS       ┌──────────────────────────────────────────┐
│  Presentación (PWA)       │ ───────────────▶ │  Supabase                                │
│  React + TypeScript +     │                  │  ├─ Auth (anónimo + correo/contraseña)    │
│  Vite · Leaflet (OSM)     │   supabase-js    │  ├─ PostgREST + RPC (lógica en servidor)  │
│  Service worker (Workbox) │ ◀─────────────── │  ├─ PostgreSQL 16 + PostGIS (geography)   │
└───────────────────────────┘                  │  ├─ Row Level Security por rol            │
          Vercel (CDN)                         │  └─ Storage privado (URLs firmadas)       │
                                               └──────────────────────────────────────────┘
```

- **Toda escritura pasa por funciones RPC auditadas** (`submit_report`, `change_report_status`): no existen políticas de INSERT/UPDATE/DELETE directas sobre los reportes.
- Las reglas se aplican en el servidor y se replican en la interfaz para dar retroalimentación inmediata; las pruebas verifican que ambas coincidan.

### Modelo de datos

`profiles` (rol) · `categories` (catálogo) · `reports` (geom `geography(Point,4326)`) · `report_photos` · `status_history` (bitácora) · `status_transitions` (matriz 7.2).

### Estructura del repositorio

```
src/
  pages/        Pantallas (inicio, mapa, reportar, seguimiento, panel, cuenta…)
  components/   Componentes reutilizables (selector de ubicación, bitácora, moderación…)
  lib/          Dominio, servicios Supabase, imágenes, geocodificación, CSV
  context/      Sesión y notificaciones
supabase/
  migrations/   001 esquema + seguridad · 002 datos de demostración
  tests/        Batería SQL de reglas y seguridad
tests/          Pruebas unitarias (Vitest)
docs/           Guía de despliegue, plan de pruebas y guion del video
```

## Ejecución local

```bash
npm install
cp .env.example .env.local   # complete con los datos de su proyecto Supabase
npm run dev                  # http://localhost:5173
npm test                     # pruebas unitarias
npm run build                # compilación de producción
```

El despliegue completo (Supabase + Vercel + administrador + instalación en el celular) está en **[docs/GUIA_DESPLIEGUE.md](docs/GUIA_DESPLIEGUE.md)**.

## Pruebas y evidencia TRL 5

- **27 pruebas unitarias** (validaciones, matriz de transiciones sincronizada con SQL, contraste WCAG, exportación sin datos personales).
- **17 casos SQL** de reglas y seguridad (registro válido, validaciones, permisos por rol, RLS, bitácora inmutable, duplicados).
- **GitHub Actions** ejecuta ambas baterías en cada cambio (PostgreSQL + PostGIS reales).
- Casos funcionales TC01–TC10 y sesiones de usabilidad: **[docs/PLAN_DE_PRUEBAS.md](docs/PLAN_DE_PRUEBAS.md)**.

## Privacidad y seguridad

Ley 1581 de 2012: consentimiento explícito, minimización (reportar no requiere datos personales), eliminación de EXIF, publicación solo de reportes validados sin identificar al autor, bucket privado, contraseñas con derivación criptográfica (Supabase Auth), RLS y límite de 10 reportes por hora por sesión.

## Trabajo futuro

Empaquetado Android con Capacitor (APK/AAB) y publicación en Google Play · notificaciones de cambio de estado · capa de comunas oficiales (Datos Abiertos Cali) · proveedor de mosaicos con clave para alto tráfico · integración con procesos institucionales.

## Créditos

Cartografía © colaboradores de OpenStreetMap. Geocodificación inversa: Nominatim. Íconos: Lucide.
