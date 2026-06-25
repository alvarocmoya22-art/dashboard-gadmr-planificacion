create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'gerente', 'responsable', 'lector');
create type public.confidentiality_level as enum ('Pública', 'Interna', 'Reservada');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.process_types (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.process_statuses (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#64748b',
  orden integer not null default 0,
  activo boolean not null default true
);

create table public.priorities (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#64748b',
  orden integer not null default 0,
  activo boolean not null default true
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  role public.app_role not null default 'lector',
  area_id uuid references public.areas(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.process_code_seq start 1;

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  codigo_proceso text not null unique default ('EPM-' || extract(year from current_date)::int || '-' || lpad(nextval('public.process_code_seq')::text, 4, '0')),
  area_id uuid not null references public.areas(id),
  tipo_proceso_id uuid not null references public.process_types(id),
  nombre_proceso text not null,
  responsable_principal text not null,
  responsable_secundario text,
  responsable_principal_user_id uuid references public.profiles(id),
  responsable_secundario_user_id uuid references public.profiles(id),
  fecha_inicio date not null,
  fecha_fin_programada date not null,
  fecha_fin_real date,
  estado_id uuid not null references public.process_statuses(id),
  prioridad_id uuid not null references public.priorities(id),
  porcentaje_avance numeric(5,2) not null default 0 check (porcentaje_avance between 0 and 100),
  dependencia_externa text,
  documento_respaldo text,
  proxima_accion text,
  objetivo text,
  observaciones text,
  anio integer generated always as (extract(year from fecha_inicio)::int) stored,
  mes integer generated always as (extract(month from fecha_inicio)::int) stored,
  trimestre integer generated always as (((extract(month from fecha_inicio)::int - 1) / 3) + 1) stored,
  dias_programados integer generated always as (greatest(0, fecha_fin_programada - fecha_inicio)) stored,
  dias_transcurridos integer not null default 0,
  dias_retraso integer not null default 0,
  semaforo text not null default 'Verde' check (semaforo in ('Verde','Amarillo','Rojo','Azul','Gris')),
  nivel_riesgo text not null default 'Bajo' check (nivel_riesgo in ('Bajo','Medio','Alto','Crítico')),
  requiere_accion_gerencial boolean not null default false,
  fecha_proxima_revision date,
  confidencialidad public.confidentiality_level not null default 'Interna',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint valid_process_dates check (fecha_fin_programada >= fecha_inicio)
);

create table public.process_comments (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  contenido text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.process_change_log (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  campo text not null,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.process_attachments (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  nombre_archivo text not null,
  storage_path text not null,
  mime_type text,
  tamano_bytes bigint,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.process_tasks (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  titulo text not null,
  descripcion text,
  responsable_id uuid references public.profiles(id),
  fecha_limite date,
  completada boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  process_id uuid references public.processes(id) on delete cascade,
  titulo text not null,
  mensaje text not null,
  leida boolean not null default false,
  tipo text not null default 'info',
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select coalesce((select role from public.profiles where id = auth.uid()), 'lector'::public.app_role); $$;

create or replace function public.current_user_area()
returns uuid language sql stable security definer set search_path = public
as $$ select area_id from public.profiles where id = auth.uid(); $$;

create or replace function public.calculate_process_fields()
returns trigger language plpgsql set search_path = public as $$
declare status_name text;
begin
  select nombre into status_name from public.process_statuses where id = new.estado_id;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.dias_transcurridos := greatest(0, coalesce(new.fecha_fin_real, current_date) - new.fecha_inicio);
  if new.fecha_fin_real is not null then
    new.dias_retraso := greatest(0, new.fecha_fin_real - new.fecha_fin_programada);
  elsif status_name <> 'Finalizado' then
    new.dias_retraso := greatest(0, current_date - new.fecha_fin_programada);
  else new.dias_retraso := 0;
  end if;
  if status_name = 'Finalizado' then new.semaforo := 'Azul';
  elsif status_name = 'Suspendido' then new.semaforo := 'Gris';
  elsif new.fecha_fin_programada < current_date then new.semaforo := 'Rojo';
  elsif new.fecha_fin_programada <= current_date + 7 then new.semaforo := 'Amarillo';
  else new.semaforo := 'Verde'; end if;
  if new.semaforo = 'Rojo' and new.porcentaje_avance < 60 then new.nivel_riesgo := 'Crítico';
  elsif new.semaforo = 'Rojo' or new.requiere_accion_gerencial then new.nivel_riesgo := 'Alto';
  elsif new.semaforo = 'Amarillo' then new.nivel_riesgo := 'Medio';
  else new.nivel_riesgo := 'Bajo'; end if;
  return new;
end $$;

create trigger processes_calculate_before_write before insert or update on public.processes
for each row execute function public.calculate_process_fields();

create or replace function public.enforce_process_update_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() = 'gerente' and (
    new.area_id is distinct from old.area_id or
    new.tipo_proceso_id is distinct from old.tipo_proceso_id or
    new.nombre_proceso is distinct from old.nombre_proceso or
    new.responsable_principal is distinct from old.responsable_principal or
    new.responsable_secundario is distinct from old.responsable_secundario or
    new.fecha_inicio is distinct from old.fecha_inicio or
    new.fecha_fin_programada is distinct from old.fecha_fin_programada or
    new.prioridad_id is distinct from old.prioridad_id or
    new.objetivo is distinct from old.objetivo or
    new.confidencialidad is distinct from old.confidencialidad
  ) then
    raise exception 'El rol gerente solo puede actualizar seguimiento, estado y comentarios.';
  end if;
  return new;
end $$;

create trigger processes_enforce_role_before_update before update on public.processes
for each row execute function public.enforce_process_update_role();

create or replace function public.log_process_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare key text; old_value jsonb; new_value jsonb;
begin
  for key in select jsonb_object_keys(to_jsonb(new)) loop
    if key not in ('updated_at','updated_by','dias_transcurridos','dias_retraso','semaforo','nivel_riesgo') then
      old_value := to_jsonb(old)->key; new_value := to_jsonb(new)->key;
      if old_value is distinct from new_value then
        insert into public.process_change_log(process_id,campo,valor_anterior,valor_nuevo,changed_by)
        values(new.id,key,old_value,new_value,auth.uid());
      end if;
    end if;
  end loop;
  return new;
end $$;

create trigger processes_audit_after_update after update on public.processes
for each row execute function public.log_process_changes();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,nombre_completo,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email),'lector');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.process_types enable row level security;
alter table public.process_statuses enable row level security;
alter table public.priorities enable row level security;
alter table public.processes enable row level security;
alter table public.process_comments enable row level security;
alter table public.process_change_log enable row level security;
alter table public.process_attachments enable row level security;
alter table public.process_tasks enable row level security;
alter table public.notifications enable row level security;

create policy "authenticated read catalogs" on public.areas for select to authenticated using (true);
create policy "authenticated read process types" on public.process_types for select to authenticated using (true);
create policy "authenticated read statuses" on public.process_statuses for select to authenticated using (true);
create policy "authenticated read priorities" on public.priorities for select to authenticated using (true);
create policy "admin manage areas" on public.areas for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "admin manage process types" on public.process_types for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "admin manage statuses" on public.process_statuses for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "admin manage priorities" on public.priorities for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "profiles visible to authenticated" on public.profiles for select to authenticated using (true);
create policy "admin manage profiles" on public.profiles for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "role based process read" on public.processes for select to authenticated using (
  public.current_user_role() in ('admin','gerente','lector')
  or area_id = public.current_user_area()
  or responsable_principal_user_id = auth.uid()
  or responsable_secundario_user_id = auth.uid()
);
create policy "admin create processes" on public.processes for insert to authenticated with check (public.current_user_role() = 'admin');
create policy "admin responsible update processes" on public.processes for update to authenticated using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'responsable' and (area_id = public.current_user_area() or responsable_principal_user_id = auth.uid()))
  or public.current_user_role() = 'gerente'
);
create policy "admin delete processes" on public.processes for delete to authenticated using (public.current_user_role() = 'admin');

create policy "read related comments" on public.process_comments for select to authenticated using (exists(select 1 from public.processes p where p.id=process_id));
create policy "write comments" on public.process_comments for insert to authenticated with check (public.current_user_role() in ('admin','gerente','responsable'));
create policy "read change log" on public.process_change_log for select to authenticated using (exists(select 1 from public.processes p where p.id=process_id));
create policy "read attachments" on public.process_attachments for select to authenticated using (exists(select 1 from public.processes p where p.id=process_id));
create policy "write attachments" on public.process_attachments for insert to authenticated with check (public.current_user_role() in ('admin','gerente','responsable'));
create policy "read tasks" on public.process_tasks for select to authenticated using (exists(select 1 from public.processes p where p.id=process_id));
create policy "manage tasks" on public.process_tasks for all to authenticated using (public.current_user_role() in ('admin','gerente','responsable')) with check (public.current_user_role() in ('admin','gerente','responsable'));
create policy "own notifications" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "own notification update" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

insert into storage.buckets(id,name,public) values('process-attachments','process-attachments',false) on conflict do nothing;
create policy "read permitted process attachments" on storage.objects for select to authenticated using (bucket_id='process-attachments');
create policy "upload process attachments" on storage.objects for insert to authenticated with check (bucket_id='process-attachments' and public.current_user_role() in ('admin','gerente','responsable'));

alter publication supabase_realtime add table public.processes;
