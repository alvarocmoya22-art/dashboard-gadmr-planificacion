-- Detalle (Asunto/Remitente/Destinatario/Fecha) de los trámites relacionados agregados a mano,
-- para mostrarlos igual que la madre. La sincronización lo llena leyendo cada número de eGob.
alter table public.processes
  add column if not exists egob_manual_detalle jsonb not null default '[]'::jsonb;
