-- Trámites relacionados detectados automáticamente desde eGob (cadena madre/hijos, "insistos").
alter table public.processes
  add column if not exists egob_tramites_relacionados jsonb;

comment on column public.processes.egob_tramites_relacionados is
  'Lista de números de trámite eGob relacionados (cadena madre/hijos), poblada por la sincronización.';
