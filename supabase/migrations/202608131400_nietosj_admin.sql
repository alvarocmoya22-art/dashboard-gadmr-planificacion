-- nietosj@gadmriobamba.gob.ec administra todo: rol admin.
-- Ve AMBAS vistas (ejecutiva + operativa) y tiene gestión completa.
-- Reemplaza el rol 'lector' que le asignaba la migración 202608131200 (las políticas
-- RLS específicas de ese correo quedan como respaldo inofensivo; admin ya tiene acceso).

update public.profiles
set role = 'admin'
where id = (select id from auth.users where lower(email) = 'nietosj@gadmriobamba.gob.ec');
