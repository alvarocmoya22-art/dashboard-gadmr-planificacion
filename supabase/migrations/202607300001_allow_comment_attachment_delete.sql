do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'process_comments'
      and policyname = 'delete comments'
  ) then
    execute 'create policy "delete comments" on public.process_comments
      for delete to authenticated
      using (public.current_user_role() in (''admin'', ''gerente'', ''responsable''))';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'process_attachments'
      and policyname = 'delete attachments'
  ) then
    execute 'create policy "delete attachments" on public.process_attachments
      for delete to authenticated
      using (public.current_user_role() in (''admin'', ''gerente'', ''responsable''))';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'delete process attachment files'
  ) then
    execute 'create policy "delete process attachment files" on storage.objects
      for delete to authenticated
      using (bucket_id = ''process-attachments'' and public.current_user_role() in (''admin'', ''gerente'', ''responsable''))';
  end if;
end $$;
