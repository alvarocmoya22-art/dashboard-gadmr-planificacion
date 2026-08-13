-- Fecha de la ultima sincronizacion eGob por tramite (requisito de auditoria).
alter table public.processes
  add column if not exists egob_sincronizado_en timestamptz;

comment on column public.processes.egob_sincronizado_en is
  'Momento de la ultima lectura correcta desde eGob (GitHub Actions).';
