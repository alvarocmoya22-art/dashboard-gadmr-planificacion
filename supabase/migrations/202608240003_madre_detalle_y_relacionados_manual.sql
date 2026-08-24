-- Detalle de la(s) madre(s) para mostrar en el detalle: [{issue, asunto, remitente, destinatario, fecha}].
alter table public.processes
  add column if not exists egob_madre_detalle jsonb not null default '[]'::jsonb;

-- Trámites relacionados agregados a mano (números eGob) además de la madre automática.
alter table public.processes
  add column if not exists egob_relacionados_manual jsonb not null default '[]'::jsonb;
