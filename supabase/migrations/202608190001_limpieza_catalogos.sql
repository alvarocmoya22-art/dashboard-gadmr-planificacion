-- Limpieza integral de catálogos: repara mojibake, fusiona duplicados y mapea áreas a Direcciones.
-- Idempotente. Seguro de re-ejecutar.

-- (1) Reparar mojibake (UTF-8 malinterpretado como Windows-1252) en tipos y áreas.
do $$
declare r record; fixed text; dupe uuid;
begin
  for r in select id, nombre from public.process_types where nombre ~ '[ÃÂ]' loop
    begin fixed := convert_from(convert_to(r.nombre,'WIN1252'),'UTF8'); exception when others then fixed := null; end;
    if fixed is not null and fixed <> r.nombre and position(chr(65533) in fixed) = 0 then
      select id into dupe from public.process_types where nombre = fixed and id <> r.id limit 1;
      if dupe is not null then
        update public.processes set tipo_proceso_id = dupe where tipo_proceso_id = r.id;
        update public.process_types set activo = false where id = r.id;
      else
        update public.process_types set nombre = fixed where id = r.id;
      end if;
    end if;
  end loop;
  for r in select id, nombre from public.areas where nombre ~ '[ÃÂ]' loop
    begin fixed := convert_from(convert_to(r.nombre,'WIN1252'),'UTF8'); exception when others then fixed := null; end;
    if fixed is not null and fixed <> r.nombre and position(chr(65533) in fixed) = 0 then
      select id into dupe from public.areas where nombre = fixed and id <> r.id limit 1;
      if dupe is not null then
        update public.processes set area_id = dupe where area_id = r.id;
        update public.areas set activo = false where id = r.id;
      else
        update public.areas set nombre = fixed where id = r.id;
      end if;
    end if;
  end loop;
end $$;

-- (2) Consolidar Otro/OTROS/Trámite Vario en "Trámite Vario".
do $$
declare keep uuid; dup record;
begin
  select id into keep from public.process_types where nombre='Trámite Vario' limit 1;
  if keep is not null then
    for dup in select id from public.process_types where id<>keep and lower(trim(nombre)) in ('otro','otros','trámite vario','tramite vario') loop
      update public.processes set tipo_proceso_id=keep where tipo_proceso_id=dup.id;
      update public.process_types set activo=false where id=dup.id;
    end loop;
  end if;
end $$;

-- (3) Mapear áreas viejas a su Dirección y desactivarlas.
do $$
declare m record; tgt uuid; src record;
begin
  for m in select * from (values
    ('DIRECCIÓN GENERAL DE GESTIÓN DE OBRAS PÚBLICAS', '(^OOPP$)|(OBRAS P.BLICAS)|(DISE.O DE LA OBRA)|(INFRAESTRUCTURA)'),
    ('DIRECCIÓN GENERAL DE GESTIÓN DE AVALÚOS, CATASTROS Y SIG', 'AVAL.OS'),
    ('DIRECCIÓN GENERAL DE GESTIÓN DE PLANIFICACIÓN, HÁBITAT Y DESARROLLO URBANÍSTICO', '(PLANIFICACI)|(HABILITACI.N DE SUELO)'),
    ('DIRECCIÓN GENERAL DE GESTIÓN ESTRATÉGICA', 'PARTICIPACI.N CIUDADANA'),
    ('DIRECCIÓN GENERAL DE GESTIÓN DE JUSTICIA Y CONTROL MUNICIPAL', 'JUSTICIA Y CONTROL TERRITORIAL'),
    ('DIRECCIÓN GENERAL DE TALENTO HUMANO', '^TALENTO HUMANO$'),
    ('DIRECCIÓN GENERAL DE GESTIÓN DE MOVILIDAD', 'CONTROL OPERATIVO'),
    ('DIRECCIÓN GENERAL ADMINISTRATIVA', 'SERVICIOS VEHICULARES')
  ) as t(target, pat)
  loop
    select id into tgt from public.areas where nombre = m.target limit 1;
    if tgt is null then continue; end if;
    for src in select id from public.areas where activo=true and id<>tgt and nombre ~* m.pat and nombre !~* '^DIRECCI.N GENERAL' loop
      update public.processes set area_id=tgt where area_id=src.id;
      update public.areas set activo=false where id=src.id;
    end loop;
  end loop;
  -- Duplicados exactos restantes de Procuraduría/Secretaría
  select id into tgt from public.areas where nombre='PROCURADURÍA' limit 1;
  if tgt is not null then for src in select id from public.areas where nombre ~* '^PROCURADUR' and id<>tgt loop
    update public.processes set area_id=tgt where area_id=src.id; update public.areas set activo=false where id=src.id; end loop; end if;
  select id into tgt from public.areas where nombre='SECRETARÍA GENERAL' limit 1;
  if tgt is not null then for src in select id from public.areas where nombre ~* 'SECRETAR.*GENERAL' and id<>tgt loop
    update public.processes set area_id=tgt where area_id=src.id; update public.areas set activo=false where id=src.id; end loop; end if;
end $$;
