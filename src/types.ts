export type Role = 'admin' | 'gerente' | 'responsable' | 'lector'
export type TrafficLight = 'Verde' | 'Amarillo' | 'Rojo' | 'Azul' | 'Gris'

export interface CatalogItem {
  id: string
  nombre: string
  color?: string
  orden?: number
  activo?: boolean
}

export interface Process {
  id: string
  codigo_proceso: string
  area_id: string
  tipo_proceso_id: string
  nombre_proceso: string
  responsable_principal: string
  responsable_secundario?: string
  fecha_inicio: string
  fecha_fin_programada: string
  fecha_fin_real?: string
  estado_id: string
  prioridad_id: string
  porcentaje_avance: number
  dependencia_externa?: string
  documento_respaldo?: string
  proxima_accion?: string
  objetivo?: string
  observaciones?: string
  fecha_proxima_revision?: string
  requiere_accion_gerencial: boolean
  confidencialidad: 'Pública' | 'Interna' | 'Reservada'
  activo: boolean
  created_at: string
  updated_at: string
  area?: CatalogItem
  tipo?: CatalogItem
  estado?: CatalogItem
  prioridad?: CatalogItem
  semaforo?: TrafficLight
  dias_retraso?: number
}

export interface ChangeLog {
  id: string
  process_id: string
  campo: string
  valor_anterior?: string
  valor_nuevo?: string
  usuario: string
  created_at: string
}

export interface ProcessFormData {
  area_id: string
  tipo_proceso_id: string
  nombre_proceso: string
  responsable_principal: string
  responsable_secundario?: string
  fecha_inicio: string
  fecha_fin_programada: string
  fecha_fin_real?: string
  estado_id: string
  prioridad_id: string
  porcentaje_avance: number
  dependencia_externa?: string
  documento_respaldo?: string
  proxima_accion?: string
  objetivo?: string
  observaciones?: string
  fecha_proxima_revision?: string
  requiere_accion_gerencial: boolean
  confidencialidad: 'Pública' | 'Interna' | 'Reservada'
}
