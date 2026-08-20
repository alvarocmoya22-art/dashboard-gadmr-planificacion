-- Trámite(s) madre (la "Tarea padre" / raíz del árbol en eGob).
-- El apartado "Trámites relacionados" del detalle mostrará SOLO estas madres,
-- sin los hijos ni los "insistos" (que generaban demasiado ruido).
alter table public.processes
  add column if not exists egob_tramites_madre jsonb not null default '[]'::jsonb;
