-- Corregir el nombre de área mal escrito "DISEÑO DE LA OBRA PaBLICA" -> "DISEÑO DE LA OBRA PÚBLICA".
-- Cubre variantes con la Ú dañada por codificación.
update public.areas
set nombre = 'DISEÑO DE LA OBRA PÚBLICA'
where nombre ilike 'DISE_O DE LA OBRA P%BLICA'
  and nombre <> 'DISEÑO DE LA OBRA PÚBLICA';
