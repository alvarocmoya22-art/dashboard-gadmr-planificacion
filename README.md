# Dashboard Gerencial · EPM Rutas de Riobamba

MVP web para registrar, consultar y monitorear procesos institucionales. Está construido con React, Vite, TypeScript, Tailwind CSS, TanStack Table, Recharts, React Hook Form, Zod y Supabase.

## Funcionalidades incluidas

- Login con Supabase Auth.
- Dashboard ejecutivo con KPIs, alertas y gráficos.
- CRUD de procesos con validación.
- Tabla operativa con búsqueda, filtros y ordenamiento.
- Kanban por estado.
- Vista de alertas y detalle del proceso.
- Catálogos administrables.
- Realtime para cambios en `processes`.
- Historial automático antes/después mediante trigger SQL.
- Importador Excel con previsualización y normalización.
- Exportación a Excel y PDF.
- RLS por roles: `admin`, `gerente`, `responsable`, `lector`.
- Storage privado para adjuntos.
- PWA básica y configuración para Netlify.
- Modo demo local cuando no hay credenciales de Supabase.

## Estructura

```text
src/
  components/       layout, formulario, tabla y UI reutilizable
  data/             catálogos y registros de demostración
  lib/              Supabase y utilidades de fechas/normalización
  pages/            vistas ejecutiva, operativa, Kanban, alertas...
  services/         importación Excel y exportación Excel/PDF
  store/            estado de aplicación, CRUD y realtime
supabase/
  migrations/       esquema, triggers, RLS, realtime y storage
  seed.sql           catálogos institucionales
```

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env
npm run dev
```

Sin `.env`, la aplicación funciona en modo demostración usando `localStorage`. Esto permite revisar todo el frontend antes de crear el proyecto Supabase.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Abre SQL Editor y ejecuta:
   - `supabase/migrations/202606240001_initial_schema.sql`
   - `supabase/seed.sql`
3. En Authentication, crea el primer usuario.
4. En SQL Editor, asigna su rol de administrador:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@institucion.gob.ec');
```

5. Copia la URL y la clave pública `anon` en `.env`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
```

Nunca uses `service_role` en el frontend.

## Roles

- `admin`: CRUD completo, importación, exportación y catálogos.
- `gerente`: lectura total, seguimiento, estado, comentarios y reportes.
- `responsable`: lectura y edición de procesos de su área o asignación.
- `lector`: solo lectura.

La seguridad efectiva está en PostgreSQL mediante RLS y triggers; ocultar botones en React no sustituye esas reglas.

## Importar el Excel inicial

1. Inicia sesión como administrador.
2. Ve a **Importar / exportar**.
3. Selecciona `Base_Datos_Gerencial_EP_Movilidad.xlsx`.
4. Revisa la previsualización.
5. Corrige en el archivo cualquier fila reportada como inválida.
6. Ejecuta la importación.

El importador convierte seriales de Excel a fechas, normaliza estados como `En ejecución` a `En Ejecución` e interpreta valores decimales de avance (`0.9`) como porcentaje (`90`).

## Adjuntos

La migración crea el bucket privado `process-attachments`. La tabla `process_attachments` conserva metadatos y la ruta del objeto. Para producción se recomienda guardar cada archivo bajo:

```text
{process_id}/{uuid}-{nombre_original}
```

## Desplegar en Netlify

1. Sube este directorio a un repositorio Git.
2. En Netlify, selecciona **Add new site → Import an existing project**.
3. Configura:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Site configuration → Environment variables**.
5. Despliega.

`netlify.toml` ya incluye el redirect de SPA para React Router.

## Verificación

```bash
npm run build
```

El MVP fue verificado en escritorio y en viewport móvil. El bundle genera una advertencia de tamaño por las librerías de Excel/PDF; para una siguiente iteración conviene cargarlas con `import()` únicamente al abrir la vista de importación/exportación.
