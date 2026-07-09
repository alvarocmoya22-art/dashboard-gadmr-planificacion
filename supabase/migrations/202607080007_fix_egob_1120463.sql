-- Corrección puntual del trámite eGob 1120463.
-- El último movimiento visible en eGob es:
-- Reasignación #78 - 2026-06-23 11:44
-- Asignado ha cambiado de IRENE SOFIA MORENO PROCEL a MARIA ALEJANDRA BONIFAZ LÓPEZ.

update public.processes
set egob_numero = '1120463',
    egob_url = 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/1120463',
    egob_estado = coalesce(egob_estado, 'Nuevo'),
    egob_responsable_actual = 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    egob_ultimo_movimiento = '2026-06-23 11:44 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ',
    updated_at = now()
where egob_numero = '1120463'
   or documento_respaldo ilike '%1120463%';
