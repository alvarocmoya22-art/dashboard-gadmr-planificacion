-- Responsable o unidad que actualmente tiene el trámite en eGob/eDoc.

alter table public.processes
  add column if not exists egob_responsable_actual text;

update public.processes
set egob_responsable_actual = 'NATALIA ELIZABETH SUBIA ANDRADE'
where egob_numero = '970395'
   or documento_respaldo ilike '970395:%';
