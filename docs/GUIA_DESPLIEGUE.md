# Guía de despliegue paso a paso

Tiempo estimado: **30 a 40 minutos**. Solo se necesitan cuentas gratuitas de Supabase, GitHub y Vercel.

---

## 1. Crear el proyecto en Supabase (10 min)

1. Entre a <https://supabase.com/dashboard> → **New project**.
   - Nombre: `geovia-cali`
   - Contraseña de la base de datos: genere una y guárdela.
   - Región: **East US (North Virginia)** o **South America (São Paulo)**.
2. Espere a que el proyecto termine de crearse (1–2 min).

### 1.1 Ejecutar las migraciones

1. Menú izquierdo → **SQL Editor** → **New query**.
2. Copie y pegue **todo** el contenido de `supabase/migrations/001_esquema_geovia.sql` → **Run**.
   Debe terminar con “Success. No rows returned”.
3. Nueva consulta con `supabase/migrations/002_datos_demostracion.sql` → **Run**
   (28 reportes simulados marcados como “Dato de demostración”).
4. **Verificación (evidencia TRL5):** nueva consulta con `supabase/tests/pruebas_seguridad_y_reglas.sql` → **Run**.
   Debe mostrar una tabla de 17 filas, todas con veredicto **APROBADO**. Tome captura de pantalla para el documento maestro.

### 1.2 Configurar la autenticación

1. **Authentication → Sign In / Providers**:
   - Active **Allow anonymous sign-ins** (permite reportar sin crear cuenta).
   - En **Email**, desactive **Confirm email** (recomendado para el piloto; evita el límite de correos del plan gratuito).
2. **Authentication → URL Configuration**:
   - **Site URL**: la URL de Vercel (paso 3), por ejemplo `https://geovia-cali.vercel.app`.

### 1.3 Copiar las credenciales

**Project Settings → API**: copie **Project URL** y la clave **anon public**.
(La clave *anon* es pública por diseño; la seguridad la garantizan las políticas RLS. **Nunca** use la clave `service_role` en el frontend.)

---

## 2. Subir el código a GitHub (5 min)

```bash
git remote add origin https://github.com/<usuario>/geovia-cali.git
git push -u origin main
```

Para el tutor: **Settings → Collaborators → Add people** (rol de lectura), o deje el repositorio público.
La pestaña **Actions** ejecutará automáticamente las pruebas (frontend + base de datos).

---

## 3. Publicar en Vercel (5 min)

1. <https://vercel.com/new> → importe el repositorio `geovia-cali`.
2. Framework: **Vite** (se detecta solo).
3. **Environment Variables**:

   | Nombre | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL de Supabase |
   | `VITE_SUPABASE_ANON_KEY` | clave anon public |
   | `VITE_REPO_URL` | URL del repositorio en GitHub |

4. **Deploy**. Copie la URL final y regrese al paso 1.2 para ponerla como *Site URL*.

---

## 4. Crear la cuenta de administrador (3 min)

1. Abra la app publicada → **Ingresar** → **Crear cuenta** con el correo del equipo.
2. En Supabase → SQL Editor:

```sql
update public.profiles set role = 'admin'
 where id = (select id from auth.users where email = 'correo-del-equipo@ejemplo.com');
```

3. Cierre sesión y vuelva a ingresar: aparecerá **Panel**. Desde **Panel → Usuarios y roles** puede asignar revisores sin usar SQL.

---

## 5. Cargar los reportes de campo (3 min)

Los 9 reportes del registro fotográfico de campo (`supabase/seed/reportes_campo/`) se envían como **ciudadanos sin cuenta**. Cada uno abre su propia sesión anónima, sube su foto y se registra con `submit_report`, igual que en la app.

1. En el computador, dentro de la carpeta del proyecto, cree `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`).
2. Ejecute:

```bash
npm install
npm run cargar:reportes -- --prueba   # valida sin enviar
npm run cargar:reportes               # envía los 9 reportes
```

3. La consola muestra el código de cada reporte (`✓ 03 · hueco · Porvenir (Comuna 4): GVC-2611-XXXXX`).
4. Ingrese como revisor → **Panel → Pendientes** y valide los reportes (Pasar a revisión → Validar). Al validarlos aparecen en el mapa público.

> Requiere *Allow anonymous sign-ins* activado. Supabase permite por defecto 30 sesiones anónimas por hora por dirección IP; el script usa 9. Si lo ejecuta de nuevo, omite los que ya existen.

---

## 6. Instalar la app en el celular (1 min)

- **Android (Chrome):** abra la URL → botón **Instalar app** o menú ⋮ → **Instalar aplicación**.
- **iPhone (Safari):** botón **Compartir** → **Agregar a pantalla de inicio**.

El ícono de GeoVía queda en la pantalla de inicio y la app abre a pantalla completa.

---

## 7. Antes de abrir la plataforma al público (opcional)

```sql
delete from public.reports where is_demo;  -- elimina solo los datos de demostración (no los de campo)
```

## Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| “Falta configurar el servidor” | Variables de entorno ausentes | Defínalas en Vercel y vuelva a desplegar (*Redeploy*). |
| “El registro sin cuenta está deshabilitado” | Anonymous sign-ins apagado | Paso 1.2. |
| “Debe confirmar su correo” | Confirm email activo | Desactívelo (paso 1.2) o confirme desde el correo. |
| No aparece el botón Instalar | Navegador sin soporte o ya instalada | Use el menú del navegador (paso 5). |
| El mapa no carga | Sin conexión | La app muestra aviso; los mosaicos visitados quedan en caché. |
| `cargar:reportes` responde “Faltan VITE_SUPABASE_URL…” | No existe `.env.local` | Créelo a partir de `.env.example`. |
| `cargar:reportes` responde “Request rate limit reached” | Límite de sesiones anónimas por hora | Espere una hora o súbalo en Authentication → Rate Limits. |
