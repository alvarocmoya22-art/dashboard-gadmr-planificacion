-- Limpieza posterior al cambio de dirección:
-- desactiva áreas antiguas tipo "Subgerencia..." para que no aparezcan
-- en Catálogos ni en filtros de la aplicación.

update public.areas
set activo = false
where nombre ilike 'Subgerencia%';

-- También limpia posibles mojibakes puntuales generados por copias anteriores.
update public.process_statuses
set nombre = 'En Revisión'
where nombre in ('En Revisi?n', 'En RevisiÃ³n');

update public.processes
set observaciones = replace(observaciones, 'Observaci?n:', 'Observación:')
where observaciones like '%Observaci?n:%';
