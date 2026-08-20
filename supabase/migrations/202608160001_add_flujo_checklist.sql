-- Flujo/checklist de pasos por trámite (Próxima acción como lista de pasos marcables).
-- Cada elemento: { "texto": "...", "hecho": true|false }. El avance se calcula = hechos/total.
alter table public.processes
  add column if not exists flujo jsonb;

comment on column public.processes.flujo is
  'Checklist de pasos (Próxima acción). Array de {texto, hecho}; el avance se calcula automáticamente.';
