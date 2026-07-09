-- Unifica estados duplicados o mal codificados.
-- Objetivo:
--   1. Mantener un solo estado activo "En Ejecución".
--   2. Mantener un solo estado activo "En Revisión".
--   3. Mover todos los procesos que apuntan a duplicados hacia el estado correcto.
--   4. Archivar los estados duplicados para que ya no aparezcan en Catálogos.

do $$
declare
  ejecucion_id uuid;
  revision_id uuid;
begin
  -- Asegura que existan los estados canónicos.
  insert into public.process_statuses (nombre, color, orden, activo)
  values ('En Ejecución', '#0f766e', 2, true)
  on conflict (nombre) do update
  set color = excluded.color,
      orden = excluded.orden,
      activo = true;

  insert into public.process_statuses (nombre, color, orden, activo)
  values ('En Revisión', '#7c3aed', 3, true)
  on conflict (nombre) do update
  set color = excluded.color,
      orden = excluded.orden,
      activo = true;

  select id into ejecucion_id
  from public.process_statuses
  where nombre = 'En Ejecución'
  order by activo desc, orden nulls last
  limit 1;

  select id into revision_id
  from public.process_statuses
  where nombre = 'En Revisión'
  order by activo desc, orden nulls last
  limit 1;

  -- Mueve procesos desde variantes dañadas/duplicadas hacia "En Ejecución".
  update public.processes
  set estado_id = ejecucion_id,
      updated_at = now()
  where estado_id in (
    select id
    from public.process_statuses
    where id <> ejecucion_id
      and (
        nombre ilike 'En Ejecuci%'
        or nombre ilike 'En Ejecuci?n'
        or nombre ilike 'En EjecuciÃ³n'
        or nombre ilike 'En Ejecuci�n'
      )
  );

  -- Mueve procesos desde variantes dañadas/duplicadas hacia "En Revisión".
  update public.processes
  set estado_id = revision_id,
      updated_at = now()
  where estado_id in (
    select id
    from public.process_statuses
    where id <> revision_id
      and (
        nombre ilike 'En Revisi%'
        or nombre ilike 'En Revisi?n'
        or nombre ilike 'En RevisiÃ³n'
        or nombre ilike 'En Revisi�n'
      )
  );

  -- Deja activos solo los estados canónicos.
  update public.process_statuses
  set activo = false
  where id <> ejecucion_id
    and (
      nombre ilike 'En Ejecuci%'
      or nombre ilike 'En Ejecuci?n'
      or nombre ilike 'En EjecuciÃ³n'
      or nombre ilike 'En Ejecuci�n'
    );

  update public.process_statuses
  set activo = false
  where id <> revision_id
    and (
      nombre ilike 'En Revisi%'
      or nombre ilike 'En Revisi?n'
      or nombre ilike 'En RevisiÃ³n'
      or nombre ilike 'En Revisi�n'
    );

  -- Normaliza orden, colores y visibilidad de los estados principales.
  update public.process_statuses
  set color = '#64748b', orden = 1, activo = true
  where nombre = 'Planificado';

  update public.process_statuses
  set color = '#0f766e', orden = 2, activo = true
  where id = ejecucion_id;

  update public.process_statuses
  set color = '#7c3aed', orden = 3, activo = true
  where id = revision_id;

  update public.process_statuses
  set color = '#2563eb', orden = 4, activo = true
  where nombre = 'Finalizado';

  update public.process_statuses
  set orden = 5
  where nombre = 'Pendiente Externo';

  update public.process_statuses
  set orden = 6
  where nombre = 'Cancelado';
end $$;
