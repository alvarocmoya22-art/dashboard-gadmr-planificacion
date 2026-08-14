-- Operador de la Vista operativa: nietosj@gadmriobamba.gob.ec
--   - Rol lector (para ver solo la Vista operativa, no la ejecutiva).
--   - Puede EDITAR trámites (estado, avance, seguimiento), COMENTAR y ADJUNTAR.
--   - NO puede crear ni archivar/borrar trámites.
-- Políticas aditivas (RLS permisivas se combinan con OR); idempotente.

do $$
declare
  op_email constant text := 'nietosj@gadmriobamba.gob.ec';
begin
  -- Editar trámites (UPDATE), sin permitir INSERT (crear) ni DELETE (archivar).
  drop policy if exists "operador edita procesos" on public.processes;
  execute format($p$
    create policy "operador edita procesos" on public.processes
      for update to authenticated
      using (lower(auth.jwt() ->> 'email') = %L)
      with check (lower(auth.jwt() ->> 'email') = %L)
  $p$, op_email, op_email);

  -- Comentarios: crear y eliminar.
  drop policy if exists "operador escribe comentarios" on public.process_comments;
  execute format($p$
    create policy "operador escribe comentarios" on public.process_comments
      for insert to authenticated
      with check (lower(auth.jwt() ->> 'email') = %L)
  $p$, op_email);

  drop policy if exists "operador borra comentarios" on public.process_comments;
  execute format($p$
    create policy "operador borra comentarios" on public.process_comments
      for delete to authenticated
      using (lower(auth.jwt() ->> 'email') = %L)
  $p$, op_email);

  -- Adjuntos (metadatos en la tabla): crear y eliminar.
  drop policy if exists "operador escribe adjuntos" on public.process_attachments;
  execute format($p$
    create policy "operador escribe adjuntos" on public.process_attachments
      for insert to authenticated
      with check (lower(auth.jwt() ->> 'email') = %L)
  $p$, op_email);

  drop policy if exists "operador borra adjuntos" on public.process_attachments;
  execute format($p$
    create policy "operador borra adjuntos" on public.process_attachments
      for delete to authenticated
      using (lower(auth.jwt() ->> 'email') = %L)
  $p$, op_email);

  -- Archivos de adjuntos en Storage (bucket process-attachments): subir y eliminar.
  drop policy if exists "operador sube archivos adjuntos" on storage.objects;
  execute format($p$
    create policy "operador sube archivos adjuntos" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'process-attachments' and lower(auth.jwt() ->> 'email') = %L)
  $p$, op_email);

  drop policy if exists "operador borra archivos adjuntos" on storage.objects;
  execute format($p$
    create policy "operador borra archivos adjuntos" on storage.objects
      for delete to authenticated
      using (bucket_id = 'process-attachments' and lower(auth.jwt() ->> 'email') = %L)
  $p$, op_email);
end $$;

-- Fija el rol del operador como lector (solo aplica si el usuario ya existe en Auth).
update public.profiles
set role = 'lector'
where id = (select id from auth.users where lower(email) = 'nietosj@gadmriobamba.gob.ec');
