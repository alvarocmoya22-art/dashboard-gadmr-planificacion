-- Vinculación de trámites del dashboard con eGob/eDoc.
-- No guarda credenciales; solo guarda el número, URL y datos visibles de seguimiento.

alter table public.processes
  add column if not exists egob_numero text,
  add column if not exists egob_url text,
  add column if not exists egob_estado text,
  add column if not exists egob_ultimo_movimiento text;

update public.processes
set
  egob_numero = coalesce(egob_numero, substring(documento_respaldo from '([0-9]{5,})')),
  egob_url = coalesce(
    egob_url,
    case
      when substring(documento_respaldo from '([0-9]{5,})') is not null
      then 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/' || substring(documento_respaldo from '([0-9]{5,})')
      else null
    end
  )
where documento_respaldo ~ '[0-9]{5,}';

update public.processes
set
  egob_estado = 'Nuevo / Reasignado a Natalia Elizabeth Subia Andrade',
  egob_ultimo_movimiento = '2026-06-08 16:04 - FIRMADO_1111482 PROYECTOS FINAL.pdf'
where documento_respaldo ilike '970395:%'
   or egob_numero = '970395';
