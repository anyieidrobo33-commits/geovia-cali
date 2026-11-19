# Plan y registro de pruebas — GeoVía Cali (TRL 5)

Las pruebas combinan tres niveles, tal como lo define la sección 8.4 del documento maestro:

| Nivel | Herramienta | Cómo se ejecuta | Resultado esperado |
|---|---|---|---|
| Unitarias (frontend) | Vitest — `tests/*.test.ts` | `npm test` (y automáticamente en GitHub Actions) | 27 pruebas aprobadas |
| Reglas de negocio y seguridad (servidor) | SQL — `supabase/tests/pruebas_seguridad_y_reglas.sql` | SQL Editor de Supabase o GitHub Actions | 17 casos con veredicto APROBADO |
| Funcionales de extremo a extremo | Manual, en la app publicada y en celular | Tabla de la sección 2 | Diligenciar resultado observado |

> Resultado de la ejecución durante el desarrollo (19/11/2026): **27/27 pruebas unitarias aprobadas** y **17/17 casos SQL aprobados** sobre PostgreSQL 16 + PostGIS 3.4.

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
| RNF02 | — | SQL: *Otro ciudadano no ve reportes pendientes ajenos*; EXIF eliminado al recomprimir |
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
| PWA | Celular Android/iPhone | Instalar app (ver guía) | Ícono en pantalla de inicio; abre a pantalla completa | | | |
| RNF06 | 100 reportes | Abrir Mapa | “100 marcadores cargados en ≤ 5000 ms” | | | |

## 3. Sesiones de usabilidad (submuestra de 12 participantes)

Tareas sugeridas (alineadas con la Tabla 12 del documento maestro): T1 reportar un daño con foto, T2 encontrar un reporte en el mapa por barrio, T3 consultar el estado con el código, T4 instalar la app. Registrar por participante: completó sin ayuda (sí/no), tiempo, errores y comentario. Meta: ≥ 85 % de tareas completadas sin asistencia.
