-- Directorio de cargos del personal, aprendido de las listas de watchers/destinatarios
-- de eGob (formato "NOMBRE (CARGO)"). La sincronización lo alimenta y lo reutiliza para
-- completar el cargo de un responsable cuando su propia página no lo trae.
create table if not exists public.egob_cargos (
  nombre_key text primary key,      -- nombre normalizado (mayúsculas, sin acentos, palabras ordenadas)
  nombre     text not null,          -- nombre tal como aparece en eGob
  cargo      text not null,
  updated_at timestamptz not null default now()
);

alter table public.egob_cargos enable row level security;

-- Legible por cualquier usuario autenticado (para mostrar el cargo si hiciera falta en el front).
drop policy if exists "cargos visibles" on public.egob_cargos;
create policy "cargos visibles" on public.egob_cargos for select to authenticated using (true);

-- La escritura la hace la sincronización con la service role (que salta RLS); no se abre a clientes.
