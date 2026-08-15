-- Acceso a la Vista ejecutiva para remachejd@gadmriobamba.gob.ec (Director).
-- Rol gerente -> ve solo la Vista ejecutiva del Director (no la operativa).
-- Solo aplica si el usuario ya existe en Auth (su perfil se crea al registrarse).

update public.profiles
set role = 'gerente'
where id = (select id from auth.users where lower(email) = 'remachejd@gadmriobamba.gob.ec');
