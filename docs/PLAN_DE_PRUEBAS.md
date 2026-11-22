# Plan y registro de pruebas — GeoVía Cali (TRL 5)

Las pruebas combinan tres niveles, tal como lo define la sección 8.4 del documento maestro:

| Nivel | Herramienta | Cómo se ejecuta | Resultado esperado |
|---|---|---|---|
| Unitarias (frontend) | Vitest — `tests/*.test.ts` | `npm test` (y automáticamente en GitHub Actions) | 44 pruebas aprobadas |
| Reglas de negocio y seguridad (servidor) | SQL — `supabase/tests/pruebas_seguridad_y_reglas.sql` | SQL Editor de Supabase o GitHub Actions | 31 casos con veredicto APROBADO |
| Funcionales de extremo a extremo | Manual, en la app publicada y en celular | Tabla de la sección 2 | Diligenciar resultado observado |

> Resultados: **41/41 pruebas unitarias** y **27/27 casos SQL** aprobados (PostgreSQL 16 + PostGIS 3.4 local). En el Supabase de producción (PostgreSQL 17) se ejecutaron los 17 casos base el 22/11/2026: **17/17 APROBADO**.

## 1. Trazabilidad requisito → prueba automatizada

| Req. | Caso | Prueba automatizada que lo cubre |
|---|---|---|
| RF01 | TC01 | SQL: *Registrar reporte válido con foto y ubicación* |
| RF02 | TC02 | SQL: *Exigir al menos una fotografía*, *Impedir usar fotografías de otra persona*; Vitest: *Fotografías* |
| RF03 | TC03 | SQL: *Visitante solo ve reportes validados o cerrados*, *Reporte validado aparece en la consulta pública* |
| RF04 | TC04 | Manual (filtros en interfaz) |
| RF05 | TC05 | SQL: *Consultar ficha e historial por código* |
| RF06 | TC06 | SQL: *Ciudadano no puede cambiar estados (RPC)*, *…modificar la tabla directamente* |
| RF07 | TC07 | SQL: *Detectar reporte cercano en radio de 30 m*; Vitest: *Haversine* |
| RF08 | TC08 | Vitest: *Exportación sin datos personales* (5 pruebas) |
| RF09 | TC09 | SQL: descripción corta, coordenadas fuera de Cali, sin consentimiento; Vitest: *Validación* (8 pruebas) |
| RF10 | TC10 | SQL: transición no permitida, motivo obligatorio, bitácora con autor/rol/fecha |
| RF11 | TC11 | SQL: actualización a > 150 m, GPS impreciso, actualización válida en el feed, límite por hora; Vitest: *verificación en el sitio* |
| RF12 | TC12 | SQL: el autor no puede apoyarse; apoyar/quitar actualiza el contador |
| RF14 | TC14 | Vitest: *Seguimiento · avisos de cambios* (línea base, cambio de estado, nuevas actualizaciones, claves estables) |
| RF13 | TC13 | SQL: estadísticas públicas sin datos personales; Vitest: GeoJSON sin datos personales y sin rechazados |
| RNF02 | — | SQL: *Un reporte rechazado deja de ser público*, *Quién apoyó un reporte no es público*, *La ubicación exacta de quien actualiza no es pública*; EXIF eliminado al recomprimir |
| RNF04 | — | Vitest: contraste ≥ 4.5:1 de colores de categoría |
| RNF05 | — | SQL: *La bitácora no puede alterarse* |
| RNF06 | — | Leyenda del mapa muestra “N marcadores cargados en X ms” |

## 2. Casos funcionales en la app publicada (diligenciar)

Ambiente: URL de Vercel · Navegador/dispositivo: __________ · Red: __________ · Responsable: __________

| ID | Precondición | Pasos | Resultado esperado | Resultado observado | Fecha | ¿Aprobado? |
|---|---|---|---|---|---|---|
| TC01 | Sin sesión | Reportar → Usar mi ubicación → Hueco → descripción → foto → aceptar → Enviar | Pantalla de confirmación con código GVC-AAMM-XXXXX | | | |
| TC02 | En paso Fotos | Intentar continuar sin foto; adjuntar un PDF | Mensaje “Adjunte al menos una fotografía”; PDF rechazado | | | |
| TC03 | Visitante | Abrir Mapa | Solo aparecen reportes validados/cerrados; borde punteado = propios no publicados | | | |
| TC04 | Mapa | Filtros → Hueco → 30 días; luego vista Lista | El contador y la lista se ajustan al filtro | | | |
| TC05 | Código de TC01 | Seguimiento → escribir código | Estado “Recibido” e historial con 1 hito | | | |
| TC06 | Ciudadano | Abrir `/panel` | “Acceso restringido”; ninguna acción de moderación disponible | | | |
| TC07 | Reporte existente | Nuevo reporte a < 30 m del anterior | Aviso “Posible duplicado” con el código existente | | | |
| TC08 | Revisor | Panel → Exportar CSV | Archivo sin correo ni identificador de usuario; abre bien en Excel | | | |
| TC09 | Paso Afectación | Descripción de 5 caracteres; ubicación fuera de Cali | Mensajes de validación; no permite avanzar | | | |
| TC10 | Revisor | Abrir reporte recibido → Pasar a revisión → Validar, con motivo | Historial muestra 2 hitos con rol, fecha y motivo; aparece en mapa público | | | |
| TC11 | Celular en el sitio de un reporte validado | Comunidad → Actualizar → Verificar ubicación → foto con cámara en vivo → Empeoró → Publicar | La actualización aparece en Comunidad y en la ficha; desde lejos (> 150 m) la app no deja continuar | | | |
| PWA | Celular Android/iPhone | Instalar app (ver guía) | Ícono en pantalla de inicio; abre a pantalla completa | | | |
| RNF06 | 100 reportes | Abrir Mapa | “100 marcadores cargados en ≤ 5000 ms” | | | |

## 3. Validación con reportes reales de campo

Nueve afectaciones fotografiadas en Cali (comunas 2, 4 y 9) se cargan con `npm run cargar:reportes`. Cada una se envía desde una **sesión anónima distinta**, como lo haría un ciudadano sin cuenta, y recorre el mismo flujo de la app: subida de la foto al bucket privado, validaciones del servidor y registro en la bitácora.

| Verificación | Resultado durante el desarrollo (22/11/2026) | Resultado en producción |
|---|---|---|
| Validación local de los 9 registros (`--prueba`) | 9/9 válidos | |
| Aceptación por `submit_report` (PostgreSQL + PostGIS) | 9/9 aceptados, estado *Recibido*, autor anónimo | |
| Moderación (Pasar a revisión → Validar) | 7 validados con 2 hitos de revisor cada uno | |
| Visibilidad en el mapa público tras validar | Correcta | |
| Fotos visibles en la ficha con URL firmada | Correcta (simulación) | |

## 4. Sesiones de usabilidad (submuestra de 12 participantes)

**Cómo aplicarla:** comparta el enlace `https://geovia-cali.vercel.app/evaluar` (o el código QR que aparece en *Panel → Evaluación*). Cada participante, sin crear cuenta, responde la encuesta diagnóstica de 15 preguntas y, si acepta, realiza las 4 tareas guiadas por una barra inferior que mide el tiempo y pregunta si necesitó ayuda; al final responde la escala SUS. Si varias personas usan el mismo celular, al terminar pulse «Nuevo participante en este dispositivo». Los resultados agregados y el CSV quedan en `/panel/evaluacion` (solo revisores y administradores). Anote la fecha real de aplicación.

Tareas sugeridas (alineadas con la Tabla 12 del documento maestro): T1 reportar un daño con foto, T2 encontrar un reporte en el mapa por barrio, T3 consultar el estado con el código, T4 instalar la app. Registrar por participante: completó sin ayuda (sí/no), tiempo, errores y comentario. Meta: ≥ 85 % de tareas completadas sin asistencia.
