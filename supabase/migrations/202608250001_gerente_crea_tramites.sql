-- Permitir que el rol 'gerente' (el Director) cree trámites, además de admin y coordinación.
-- El botón "Nuevo trámite" ya existe en la vista ejecutiva; esto habilita el guardado (RLS).
drop policy if exists "admin and coordination create processes" on public.processes;
drop policy if exists "management create processes" on public.processes;
create policy "management create processes" on public.processes
  for insert to authenticated
  with check (
    public.current_user_role() in ('admin', 'gerente')
    or lower(auth.jwt() ->> 'email') = 'coordinacion.gerencia@epmrutasderiobamba.gob.ec'
  );
