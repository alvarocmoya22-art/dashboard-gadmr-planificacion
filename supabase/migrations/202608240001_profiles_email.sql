-- Guardar el email en profiles para identificar a Scar / Ing. Juan Diego en el frontend
-- (las reglas de "Pendientes de revisión" dependen de quién comenta).
alter table public.profiles add column if not exists email text;

-- Backfill desde auth.users (la migración corre con privilegios de administrador).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- Mantenerlo al crear nuevos usuarios.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, nombre_completo, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'lector');
  return new;
end $$;
