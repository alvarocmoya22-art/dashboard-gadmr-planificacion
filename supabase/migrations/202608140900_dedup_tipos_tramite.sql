-- De-duplicar tipos de trámite repetidos en el catálogo process_types.
-- Fusiona el duplicado en el canónico: reasigna los trámites que lo usaban y
-- desactiva el duplicado (no lo borra, para no romper referencias históricas).
-- Idempotente: re-ejecutar no causa efectos adicionales.

do $$
declare
  pair   record;
  keep_id uuid;
  dup_id  uuid;
begin
  for pair in
    select * from (values
      ('Otro',           'OTROS'),          -- "OTROS" -> "Otro"
      ('Trámite Vario',  'TRÁMITE Vario')   -- "TRÁMITE Vario" (mayúsculas) -> "Trámite Vario"
    ) as m(canonico, duplicado)
  loop
    select id into keep_id from public.process_types where nombre = pair.canonico order by activo desc limit 1;
    select id into dup_id  from public.process_types where nombre = pair.duplicado limit 1;

    if dup_id is null then
      continue; -- no existe el duplicado, nada que hacer
    end if;

    if keep_id is null then
      -- No existe el canónico todavía: renombra el duplicado al nombre canónico.
      update public.process_types set nombre = pair.canonico, activo = true where id = dup_id;
    else
      -- Reasigna los trámites del duplicado al canónico y desactiva el duplicado.
      update public.processes set tipo_proceso_id = keep_id where tipo_proceso_id = dup_id;
      update public.process_types set activo = false where id = dup_id;
    end if;
  end loop;
end $$;
