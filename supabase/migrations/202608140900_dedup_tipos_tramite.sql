-- De-duplicar tipos de trámite del catálogo process_types.
-- Paso 1: alias explícitos (texto distinto, misma categoría): OTROS -> Otro.
-- Paso 2: fusiona duplicados que solo difieren por MAYÚSCULAS/ESPACIOS
--         (p. ej. "TRÁMITE Vario" vs "Trámite Vario").
-- Reasigna los trámites al canónico y desactiva el duplicado. Idempotente.

do $$
declare
  pair   record;
  grp    record;
  dup    record;
  keep_id uuid;
  dup_id  uuid;
begin
  -- Paso 1: alias explícitos.
  for pair in
    select * from (values
      ('Otro', 'OTROS')
    ) as m(canonico, duplicado)
  loop
    select id into keep_id from public.process_types where nombre = pair.canonico order by activo desc limit 1;
    select id into dup_id  from public.process_types where nombre = pair.duplicado limit 1;
    if dup_id is null then
      continue;
    elsif keep_id is null then
      update public.process_types set nombre = pair.canonico, activo = true where id = dup_id;
    else
      update public.processes set tipo_proceso_id = keep_id where tipo_proceso_id = dup_id;
      update public.process_types set activo = false where id = dup_id;
    end if;
  end loop;

  -- Paso 2: duplicados por mayúsculas/espacios (misma clave normalizada).
  for grp in
    select lower(trim(regexp_replace(nombre, '\s+', ' ', 'g'))) as k
    from public.process_types
    group by 1
    having count(*) > 1
  loop
    -- Canónico: preferir el que NO está todo en mayúsculas y con formato "Título".
    select id into keep_id
    from public.process_types
    where lower(trim(regexp_replace(nombre, '\s+', ' ', 'g'))) = grp.k
    order by (nombre = upper(nombre)) asc,
             (nombre = initcap(lower(nombre))) desc,
             activo desc,
             id asc
    limit 1;

    for dup in
      select id from public.process_types
      where lower(trim(regexp_replace(nombre, '\s+', ' ', 'g'))) = grp.k
        and id <> keep_id
    loop
      update public.processes set tipo_proceso_id = keep_id where tipo_proceso_id = dup.id;
      update public.process_types set activo = false where id = dup.id;
    end loop;
  end loop;
end $$;
