insert into public.areas(nombre) values
('Gerencia General'),('Subgerencia de Procuraduría Jurídica'),('Subgerencia de Administrativo Financiero'),
('Subgerencia de Talento Humano'),('Subgerencia de Tecnologías de la Información'),('Subgerencia de Comunicación'),
('Subgerencia de Movilidad Urbana Sostenible'),('Subgerencia de Inteligencia de Negocios'),
('Jefatura de Control Operativo'),('Jefatura de Servicios Vehiculares'),('Jefatura de Infraestructura')
on conflict do nothing;

insert into public.process_types(nombre) values
('Proyecto'),('Contratación Pública'),('Convenio'),('Informe Técnico'),('Informe Jurídico'),('Informe Financiero'),
('Proceso Judicial'),('Proceso Administrativo'),('Coactiva'),('Capacitación'),('Mantenimiento'),('Operativo'),
('Campaña Comunicacional'),('Servicio Institucional'),('Requerimiento Gerencial'),('Proceso de contratación'),('Otro')
on conflict do nothing;

insert into public.process_statuses(nombre,color,orden) values
('Planificado','#64748b',1),('En Ejecución','#0f766e',2),('En Revisión','#7c3aed',3),
('Pendiente Externo','#d97706',4),('Suspendido','#6b7280',5),('Finalizado','#2563eb',6),('Vencido','#dc2626',7)
on conflict(nombre) do update set color=excluded.color,orden=excluded.orden;

insert into public.priorities(nombre,color,orden) values
('Alta','#dc2626',1),('Media','#d97706',2),('Baja','#16a34a',3)
on conflict(nombre) do update set color=excluded.color,orden=excluded.orden;
