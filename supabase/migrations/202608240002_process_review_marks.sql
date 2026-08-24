-- Marcas de "revisado" por persona: sirven para ocultar un trámite de Pendientes de revisión
-- solo el día en que esa persona lo marcó. Se guarda la última marca por (trámite, persona).
create table if not exists public.process_review_marks (
  process_id  uuid not null references public.processes(id) on delete cascade,
  reviewed_by uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  primary key (process_id, reviewed_by)
);

alter table public.process_review_marks enable row level security;

-- Todas las marcas son visibles (para que la vista de cada rol calcule sus pendientes).
drop policy if exists "review marks visibles" on public.process_review_marks;
create policy "review marks visibles" on public.process_review_marks
  for select to authenticated using (true);

-- Cada quien solo puede marcar/actualizar SUS propias revisiones.
drop policy if exists "review marks insert propios" on public.process_review_marks;
create policy "review marks insert propios" on public.process_review_marks
  for insert to authenticated with check (reviewed_by = auth.uid());

drop policy if exists "review marks update propios" on public.process_review_marks;
create policy "review marks update propios" on public.process_review_marks
  for update to authenticated using (reviewed_by = auth.uid()) with check (reviewed_by = auth.uid());
