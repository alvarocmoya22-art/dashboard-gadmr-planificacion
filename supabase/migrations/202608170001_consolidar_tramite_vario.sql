-- Consolidar "Otro" / "OTROS" / variantes de "Trámite Vario" en UNA sola categoría: "Trámite Vario".
-- Reasigna los trámites al canónico y desactiva los demás. Idempotente.

do $$
declare
  keep uuid;
  dup  record;
begin
  -- Canónico: "Trámite Vario"
  select id into keep from public.process_types where nombre = 'Trámite Vario' limit 1;
  if keep is null then
    -- si no existe, renombra una variante existente al canónico
    select id into keep from public.process_types
      where lower(trim(nombre)) in ('trámite vario', 'tramite vario', 'otro', 'otros') limit 1;
    if keep is not null then
      update public.process_types set nombre = 'Trámite Vario', activo = true where id = keep;
    end if;
  else
    update public.process_types set activo = true where id = keep;
  end if;

  if keep is not null then
    for dup in
      select id from public.process_types
      where id <> keep
        and lower(trim(nombre)) in ('otro', 'otros', 'trámite vario', 'tramite vario')
    loop
      update public.processes set tipo_proceso_id = keep where tipo_proceso_id = dup.id;
      update public.process_types set activo = false where id = dup.id;
    end loop;
  end if;
end $$;
