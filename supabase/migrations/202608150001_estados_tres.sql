-- Reducir los estados MANUALES a solo 3: En curso, Reasignado, Finalizado.
-- (El estado que reporta eGob se guarda aparte en processes.egob_estado y no se toca aquí.)
-- Reasigna los trámites de estados viejos a "En curso" (Finalizado se conserva) y desactiva el resto.

do $$
declare
  encurso    uuid;
  reasignado uuid;
  finalizado uuid;
begin
  -- Finalizado (conservar el existente)
  select id into finalizado from public.process_statuses where nombre = 'Finalizado' limit 1;
  if finalizado is null then
    insert into public.process_statuses(nombre, color, orden, activo)
      values ('Finalizado', '#2563eb', 3, true) returning id into finalizado;
  else
    update public.process_statuses set activo = true, orden = 3 where id = finalizado;
  end if;

  -- En curso
  select id into encurso from public.process_statuses where nombre = 'En curso' limit 1;
  if encurso is null then
    insert into public.process_statuses(nombre, color, orden, activo)
      values ('En curso', '#0f766e', 1, true) returning id into encurso;
  else
    update public.process_statuses set activo = true, orden = 1 where id = encurso;
  end if;

  -- Reasignado
  select id into reasignado from public.process_statuses where nombre = 'Reasignado' limit 1;
  if reasignado is null then
    insert into public.process_statuses(nombre, color, orden, activo)
      values ('Reasignado', '#df8b2d', 2, true) returning id into reasignado;
  else
    update public.process_statuses set activo = true, orden = 2 where id = reasignado;
  end if;

  -- Reasignar trámites que no estén en uno de los 3 estados nuevos -> "En curso".
  update public.processes
  set estado_id = encurso
  where estado_id is distinct from finalizado
    and estado_id is distinct from reasignado
    and estado_id is distinct from encurso;

  -- Desactivar los estados que ya no se usan (Planificado, En Ejecución, En Revisión, etc.).
  update public.process_statuses
  set activo = false
  where id not in (encurso, reasignado, finalizado);
end $$;
