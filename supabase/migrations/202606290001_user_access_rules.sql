-- Permisos específicos solicitados:
-- 1) coordinacion.gerencia@epmrutasderiobamba.gob.ec:
--    - Rol lector para no activar vistas gerenciales.
--    - Excepción RLS para crear procesos desde Vista Operativa.
-- 2) Daniela.Betancourt@epmrutasderiobamba.gob.ec:
--    - Rol admin para visibilidad y gestión completa.

drop policy if exists "admin create processes" on public.processes;

create policy "admin and coordination create processes"
on public.processes
for insert
to authenticated
with check (
  public.current_user_role() = 'admin'
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
