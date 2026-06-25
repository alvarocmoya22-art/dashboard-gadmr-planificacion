import type { CatalogItem, Process } from '../types'

export const areas: CatalogItem[] = [
  'Gerencia General', 'Subgerencia de Procuraduría Jurídica', 'Subgerencia de Administrativo Financiero',
  'Subgerencia de Talento Humano', 'Subgerencia de Tecnologías de la Información', 'Subgerencia de Comunicación',
  'Subgerencia de Movilidad Urbana Sostenible', 'Subgerencia de Inteligencia de Negocios',
  'Jefatura de Control Operativo', 'Jefatura de Servicios Vehiculares', 'Jefatura de Infraestructura',
].map((nombre, index) => ({ id: `area-${index + 1}`, nombre, activo: true }))

export const processTypes: CatalogItem[] = [
  'Proyecto', 'Contratación Pública', 'Convenio', 'Informe Técnico', 'Informe Jurídico', 'Informe Financiero',
  'Proceso Judicial', 'Proceso Administrativo', 'Coactiva', 'Capacitación', 'Mantenimiento', 'Operativo',
  'Campaña Comunicacional', 'Servicio Institucional', 'Requerimiento Gerencial', 'Proceso de contratación', 'Otro',
].map((nombre, index) => ({ id: `type-${index + 1}`, nombre, activo: true }))

export const statuses: CatalogItem[] = [
  ['Planificado', '#64748b'], ['En Ejecución', '#0f766e'], ['En Revisión', '#7c3aed'],
  ['Pendiente Externo', '#d97706'], ['Suspendido', '#6b7280'], ['Finalizado', '#2563eb'], ['Vencido', '#dc2626'],
].map(([nombre, color], index) => ({ id: `status-${index + 1}`, nombre, color, orden: index + 1, activo: true }))

export const priorities: CatalogItem[] = [
  ['Alta', '#dc2626'], ['Media', '#d97706'], ['Baja', '#16a34a'],
].map(([nombre, color], index) => ({ id: `priority-${index + 1}`, nombre, color, orden: index + 1, activo: true }))

const catalog = (collection: CatalogItem[], id: string) => collection.find((item) => item.id === id)

const rawDemoProcesses: Process[] = [
  {
    id: 'demo-1', codigo_proceso: 'EPM-2026-0001', area_id: 'area-2', tipo_proceso_id: 'type-3',
    nombre_proceso: 'Convenio Marco de Cooperación Interinstitucional con el Instituto Superior Tecnológico Líderes de los Andes',
    responsable_principal: 'Subgerencia de Procuraduría Jurídica', responsable_secundario: 'Subgerencia de Talento Humano',
    fecha_inicio: '2026-05-15', fecha_fin_programada: '2026-06-19', fecha_fin_real: '2026-06-24',
    estado_id: 'status-6', prioridad_id: 'priority-2', porcentaje_avance: 100,
    dependencia_externa: 'Instituto Superior Tecnológico Líderes de los Andes',
    documento_respaldo: 'Memorando No. EPMRR–GG-2026-00375-M',
    proxima_accion: 'Archivar expediente y socializar resultados.', objetivo: 'Fortalecer la cooperación interinstitucional.',
    observaciones: 'Importado desde la base inicial.', requiere_accion_gerencial: false, confidencialidad: 'Interna',
    activo: true, created_at: '2026-05-15T13:00:00Z', updated_at: '2026-06-24T13:00:00Z',
  },
  {
    id: 'demo-2', codigo_proceso: 'EPM-2026-0002', area_id: 'area-7', tipo_proceso_id: 'type-1',
    nombre_proceso: 'Plan integral de movilidad urbana sostenible 2026',
    responsable_principal: 'Ana Paredes', responsable_secundario: 'Equipo técnico MUS',
    fecha_inicio: '2026-04-01', fecha_fin_programada: '2026-08-30', estado_id: 'status-2',
    prioridad_id: 'priority-1', porcentaje_avance: 62, proxima_accion: 'Validar matriz de proyectos priorizados.',
    objetivo: 'Actualizar la hoja de ruta institucional de movilidad.', requiere_accion_gerencial: true,
    fecha_proxima_revision: '2026-06-26', confidencialidad: 'Pública', activo: true,
    created_at: '2026-04-01T13:00:00Z', updated_at: '2026-06-22T13:00:00Z',
  },
  {
    id: 'demo-3', codigo_proceso: 'EPM-2026-0003', area_id: 'area-9', tipo_proceso_id: 'type-12',
    nombre_proceso: 'Operativo de control de transporte informal',
    responsable_principal: 'Carlos Guaraca', fecha_inicio: '2026-06-01', fecha_fin_programada: '2026-06-20',
    estado_id: 'status-2', prioridad_id: 'priority-1', porcentaje_avance: 45,
    dependencia_externa: 'Policía Nacional', proxima_accion: '', requiere_accion_gerencial: true,
    confidencialidad: 'Reservada', activo: true, created_at: '2026-06-01T13:00:00Z', updated_at: '2026-06-21T13:00:00Z',
  },
  {
    id: 'demo-4', codigo_proceso: 'EPM-2026-0004', area_id: 'area-11', tipo_proceso_id: 'type-11',
    nombre_proceso: 'Mantenimiento preventivo de terminales y paradas',
    responsable_principal: 'Unidad de Infraestructura', fecha_inicio: '2026-06-10', fecha_fin_programada: '2026-06-29',
    estado_id: 'status-3', prioridad_id: 'priority-2', porcentaje_avance: 38,
    proxima_accion: 'Aprobar planillas de intervención.', requiere_accion_gerencial: false,
    fecha_proxima_revision: '2026-06-27', confidencialidad: 'Pública', activo: true,
    created_at: '2026-06-10T13:00:00Z', updated_at: '2026-06-23T13:00:00Z',
  },
  {
    id: 'demo-5', codigo_proceso: 'EPM-2026-0005', area_id: 'area-5', tipo_proceso_id: 'type-4',
    nombre_proceso: 'Informe de continuidad operativa y respaldos institucionales',
    responsable_principal: 'Diego Silva', fecha_inicio: '2026-05-20', fecha_fin_programada: '2026-07-10',
    estado_id: 'status-5', prioridad_id: 'priority-3', porcentaje_avance: 25,
    proxima_accion: 'Reprogramar pruebas de recuperación.', requiere_accion_gerencial: false,
    confidencialidad: 'Interna', activo: true, created_at: '2026-05-20T13:00:00Z', updated_at: '2026-06-18T13:00:00Z',
  },
]

export const demoProcesses: Process[] = rawDemoProcesses.map((process) => ({
  ...process,
  area: catalog(areas, process.area_id),
  tipo: catalog(processTypes, process.tipo_proceso_id),
  estado: catalog(statuses, process.estado_id),
  prioridad: catalog(priorities, process.prioridad_id),
}))
