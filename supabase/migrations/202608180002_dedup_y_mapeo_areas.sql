-- (1) Fusionar duplicados visibles (Procuraduría, Secretaría General, Trámite Vario)
-- (2) Reasignar áreas viejas a su Dirección y desactivarlas. Idempotente.

do $$
declare keep uuid; dup record;
begin
  select id into keep from public.areas where nombre='PROCURADURÍA' limit 1;
  if keep is not null then
    for dup in select id from public.areas where nombre ~* '^PROCURADUR' and id<>keep loop
      update public.processes set area_id=keep where area_id=dup.id;
      update public.areas set activo=false where id=dup.id;
    end loop;
  end if;
  select id into keep from public.areas where nombre='SECRETARÍA GENERAL' limit 1;
  if keep is not null then
    for dup in select id from public.areas where nombre ~* 'SECRETAR.*GENERAL' and id<>keep loop
      update public.processes set area_id=keep where area_id=dup.id;
      update public.areas set activo=false where id=dup.id;
    end loop;
  end if;
  select id into keep from public.process_types where nombre='Trámite Vario' limit 1;
  if keep is not null then
    for dup in select id from public.process_types where nombre ~* 'MITE VARIO' and id<>keep loop
      update public.processes set tipo_proceso_id=keep where tipo_proceso_id=dup.id;
      update public.process_types set activo=false where id=dup.id;
    end loop;
  end if;
end $$;

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
    for src in
      select id from public.areas
      where activo = true and id <> tgt
        and nombre ~* m.pat
        and nombre !~* '^DIRECCI.N GENERAL'
    loop
      update public.processes set area_id = tgt where area_id = src.id;
      update public.areas set activo = false where id = src.id;
    end loop;
  end loop;
end $$;
