-- Limpieza de escritura en catálogos y datos eGob iniciales del trámite 1120463.
-- Ejecutar en Supabase antes de probar en producción.

begin;

-- Áreas responsables: crear nombres correctos.
insert into public.areas(nombre, activo)
values
  ('DIRECCIÓN DE OBRAS PUBLICAS', true),
  ('DISEÑO DE LA OBRA PÚBLICA', true),
  ('HABILITACIÓN DE SUELO Y EDIFICACIÓN', true),
  ('SECRETARÍA GENERAL', true)
on conflict (nombre) do update set activo = true;

-- Tipos de trámite correctos.
insert into public.process_types(nombre, activo)
values
  ('DISEÑO', true),
  ('Desmembración', true),
  ('Subdivisión', true),
  ('Trámite Vario', true)
on conflict (nombre) do update set activo = true;

-- Estados correctos.
insert into public.process_statuses(nombre, color, orden, activo)
values
  ('En Ejecución', '#0f766e', 2, true),
  ('En Revisión', '#7c3aed', 3, true)
on conflict (nombre) do update
set color = excluded.color,
    orden = excluded.orden,
    activo = true;

-- Reasignar procesos que usaban catálogos con texto mal codificado.
update public.processes p
set area_id = good.id
from public.areas bad
join public.areas good on good.nombre = 'DIRECCIÓN DE OBRAS PUBLICAS'
where p.area_id = bad.id
  and bad.nombre in ('DIRECCIÃ“N DE OBRAS PUBLICAS', 'DIRECCIÃ“N DE OBRAS PÃšBLICAS');

update public.processes p
set area_id = good.id
from public.areas bad
join public.areas good on good.nombre = 'DISEÑO DE LA OBRA PÚBLICA'
where p.area_id = bad.id
  and bad.nombre in ('DISEÃ‘O DE LA OBRA PÃšBLICA', 'DISEÃ‘O DE LA OBRA PÚBLICA');

update public.processes p
set area_id = good.id
from public.areas bad
join public.areas good on good.nombre = 'HABILITACIÓN DE SUELO Y EDIFICACIÓN'
where p.area_id = bad.id
  and bad.nombre in ('HABILITACIÃ“N DE SUELO Y EDIFICACIÃ“N');

update public.processes p
set tipo_proceso_id = good.id
from public.process_types bad
join public.process_types good on good.nombre = 'DISEÑO'
where p.tipo_proceso_id = bad.id
  and bad.nombre in ('DISEÃ‘O');

update public.processes p
set tipo_proceso_id = good.id
from public.process_types bad
join public.process_types good on good.nombre = 'Desmembración'
where p.tipo_proceso_id = bad.id
  and bad.nombre in ('DesmembraciÃ³n', 'DesmembraciÃšn');

update public.processes p
set tipo_proceso_id = good.id
from public.process_types bad
join public.process_types good on good.nombre = 'Subdivisión'
where p.tipo_proceso_id = bad.id
  and bad.nombre in ('SubdivisiÃ³n', 'SubdivisiÃšn');

update public.processes p
set tipo_proceso_id = good.id
from public.process_types bad
join public.process_types good on good.nombre = 'Trámite Vario'
where p.tipo_proceso_id = bad.id
  and bad.nombre in ('TrÃ¡mite Vario', 'Tr?mite Vario');

update public.processes p
set estado_id = good.id
from public.process_statuses bad
join public.process_statuses good on good.nombre = 'En Ejecución'
where p.estado_id = bad.id
  and bad.nombre in ('En EjecuciÃ³n', 'En EjecuciÃšn', 'En Ejecuci?n');

update public.processes p
set estado_id = good.id
from public.process_statuses bad
join public.process_statuses good on good.nombre = 'En Revisión'
where p.estado_id = bad.id
  and bad.nombre in ('En RevisiÃ³n', 'En RevisiÃšn', 'En Revisi?n');

-- Archivar catálogos viejos mal escritos.
update public.areas
set activo = false
where nombre in (
  'DIRECCIÃ“N DE OBRAS PUBLICAS',
  'DIRECCIÃ“N DE OBRAS PÃšBLICAS',
  'DISEÃ‘O DE LA OBRA PÃšBLICA',
  'DISEÃ‘O DE LA OBRA PÚBLICA',
  'HABILITACIÃ“N DE SUELO Y EDIFICACIÃ“N'
);

update public.process_types
set activo = false
where nombre in (
  'DISEÃ‘O',
  'DesmembraciÃ³n',
  'DesmembraciÃšn',
  'SubdivisiÃ³n',
  'SubdivisiÃšn',
  'TrÃ¡mite Vario',
  'Tr?mite Vario'
);

update public.process_statuses
set activo = false
where nombre in (
  'En EjecuciÃ³n',
  'En EjecuciÃšn',
  'En Ejecuci?n',
  'En RevisiÃ³n',
  'En RevisiÃšn',
  'En Revisi?n'
);

-- Limpiar textos frecuentes dentro de procesos.
update public.processes
set
  dependencia_externa = replace(replace(replace(replace(replace(coalesce(dependencia_externa, ''), 'DIRECCIÃ“N', 'DIRECCIÓN'), 'DISEÃ‘O', 'DISEÑO'), 'PÃšBLICA', 'PÚBLICA'), 'HABILITACIÃ“N', 'HABILITACIÓN'), 'EDIFICACIÃ“N', 'EDIFICACIÓN'),
  documento_respaldo = replace(replace(replace(replace(coalesce(documento_respaldo, ''), 'DesmembraciÃ³n', 'Desmembración'), 'SubdivisiÃ³n', 'Subdivisión'), 'TrÃ¡mite', 'Trámite'), 'ObservaciÃ³n', 'Observación'),
  proxima_accion = replace(replace(replace(replace(coalesce(proxima_accion, ''), 'DesmembraciÃ³n', 'Desmembración'), 'SubdivisiÃ³n', 'Subdivisión'), 'TrÃ¡mite', 'Trámite'), 'ObservaciÃ³n', 'Observación'),
  objetivo = replace(replace(replace(replace(coalesce(objetivo, ''), 'DesmembraciÃ³n', 'Desmembración'), 'SubdivisiÃ³n', 'Subdivisión'), 'TrÃ¡mite', 'Trámite'), 'ObservaciÃ³n', 'Observación'),
  observaciones = replace(replace(replace(replace(coalesce(observaciones, ''), 'DesmembraciÃ³n', 'Desmembración'), 'SubdivisiÃ³n', 'Subdivisión'), 'TrÃ¡mite', 'Trámite'), 'ObservaciÃ³n', 'Observación')
where dependencia_externa like '%Ã%'
   or documento_respaldo like '%Ã%'
   or proxima_accion like '%Ã%'
   or objetivo like '%Ã%'
   or observaciones like '%Ã%';

-- Datos eGob iniciales del trámite 1120463 / UNECH.
update public.processes
set egob_numero = '1120463',
    egob_url = 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/1120463',
    egob_estado = 'Reasignación',
    egob_responsable_actual = 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    egob_ultimo_movimiento = '2026-06-23 11:44 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ',
    updated_at = now()
where codigo_proceso = 'TRV-2026-0004'
   or documento_respaldo ilike '1120463:%';

commit;
