-- Permisos específicos solicitados:
-- 1) coordinacion.gerencia@epmrutasderiobamba.gob.ec:
--    - Rol lector para no activar vistas gerenciales.
--    - Puede crear y editar procesos desde Vista Operativa.
--    - No puede borrar/archivar procesos.
-- 2) Daniela.Betancourt@epmrutasderiobamba.gob.ec:
--    - Rol admin para visibilidad y gestión completa.

drop policy if exists "admin create processes" on public.processes;
drop policy if exists "admin and coordination create processes" on public.processes;
drop policy if exists "admin responsible update processes" on public.processes;
drop policy if exists "admin responsible and coordination update processes" on public.processes;

create policy "admin and coordination create processes"
on public.processes
for insert
to authenticated
with check (
  public.current_user_role() = 'admin'
  or lower(auth.jwt() ->> 'email') = 'coordinacion.gerencia@epmrutasderiobamba.gob.ec'
);

create policy "admin responsible and coordination update processes"
on public.processes
for update
to authenticated
using (
  public.current_user_role() = 'admin'
  or public.current_user_role() = 'gerente'
  or (
    public.current_user_role() = 'responsable'
    and (
      area_id = public.current_user_area()
      or responsable_principal_user_id = auth.uid()
    )
  )
  or lower(auth.jwt() ->> 'email') = 'coordinacion.gerencia@epmrutasderiobamba.gob.ec'
)
with check (
  public.current_user_role() = 'admin'
  or public.current_user_role() = 'gerente'
  or (
    public.current_user_role() = 'responsable'
    and (
      area_id = public.current_user_area()
      or responsable_principal_user_id = auth.uid()
    )
  )
  or lower(auth.jwt() ->> 'email') = 'coordinacion.gerencia@epmrutasderiobamba.gob.ec'
);

update public.profiles
set role = 'lector'
where id = (
  select id
  from auth.users
  where lower(email) = 'coordinacion.gerencia@epmrutasderiobamba.gob.ec'
);

update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where lower(email) = 'daniela.betancourt@epmrutasderiobamba.gob.ec'
);
