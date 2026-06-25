# Arquitectura

## Flujo principal

```mermaid
flowchart LR
  UI[React + TypeScript] --> Forms[React Hook Form + Zod]
  UI --> Table[TanStack Table]
  UI --> Charts[Recharts]
  UI --> Service[Servicios de datos]
  Service --> Supabase[(Supabase PostgreSQL)]
  Supabase --> RLS[RLS por rol y área]
  Supabase --> Audit[Triggers de cálculo y auditoría]
  Supabase --> Realtime[Realtime]
  Realtime --> UI
  Service --> Storage[Supabase Storage]
  Import[Excel inicial] --> Normalizer[Normalizador y previsualización]
  Normalizer --> Service
```

## Decisiones

- PostgreSQL es la única fuente de verdad en producción.
- Los valores derivados (`semaforo`, días y riesgo) se calculan en base de datos para evitar diferencias entre clientes.
- El frontend también calcula el semáforo para el modo demo y para respuesta visual inmediata.
- El historial se genera en trigger y no depende de que el cliente recuerde registrarlo.
- Los responsables conservan campos de texto, pero el esquema incluye referencias opcionales a `profiles`.
- La aplicación arranca sin Supabase para facilitar revisión, pero activa login y datos remotos al detectar variables de entorno válidas.
