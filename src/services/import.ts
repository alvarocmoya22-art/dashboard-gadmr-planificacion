import * as XLSX from 'xlsx'
import type { CatalogItem, ProcessFormData } from '../types'
import { excelDateToIso, normalizeProgress, normalizeStatus, normalizeText } from '../lib/utils'

type CatalogContext = { areas: CatalogItem[]; processTypes: CatalogItem[]; statuses: CatalogItem[]; priorities: CatalogItem[] }
const findId = (items: CatalogItem[], name: string) => items.find((item) => item.nombre.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))?.id ?? ''

export async function parseProcessWorkbook(file: File, catalogs: CatalogContext): Promise<{ rows: ProcessFormData[]; errors: string[] }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const sheet = workbook.Sheets.Base_Procesos
  if (!sheet) throw new Error('No se encontró la hoja Base_Procesos')
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const errors: string[] = []
  const rows = raw.flatMap((row, index) => {
    const line = index + 2
    const area = normalizeText(row['Área Responsable'])
    const type = normalizeText(row['Tipo de Proceso'])
    const status = normalizeStatus(row.Estado)
    const priority = normalizeText(row.Prioridad)
    const item: ProcessFormData = {
      area_id: findId(catalogs.areas, area),
      tipo_proceso_id: findId(catalogs.processTypes, type),
      nombre_proceso: normalizeText(row['Nombre del Proceso']),
      responsable_principal: normalizeText(row['Responsable Principal']),
      responsable_secundario: normalizeText(row['Responsable Secundario']),
      fecha_inicio: excelDateToIso(row['Fecha Inicio']),
      fecha_fin_programada: excelDateToIso(row['Fecha Fin Programada']),
      fecha_fin_real: excelDateToIso(row['Fecha Fin Real']),
      estado_id: findId(catalogs.statuses, status),
      prioridad_id: findId(catalogs.priorities, priority),
      porcentaje_avance: normalizeProgress(row['% Avance']),
      dependencia_externa: normalizeText(row['Dependencia Externa']),
      documento_respaldo: normalizeText(row['Documento Respaldo']),
      egob_numero: normalizeText(row['Nro. eGob'] ?? row['Trámite eGob'] ?? row['Nro. trámite eGob']),
      egob_url: normalizeText(row['URL eGob']),
      egob_estado: normalizeText(row['Estado eGob']),
      egob_responsable_actual: normalizeText(row['Actualmente con'] ?? row['Responsable eGob']),
      egob_ultimo_movimiento: normalizeText(row['Último movimiento eGob']),
      proxima_accion: normalizeText(row['Próxima Acción']),
      objetivo: normalizeText(row.Objetivo),
      observaciones: normalizeText(row.Observaciones),
      fecha_proxima_revision: '',
      requiere_accion_gerencial: false,
      confidencialidad: 'Interna',
    }
    const issues: string[] = []
    if (!item.nombre_proceso) issues.push('nombre')
    if (!item.area_id) issues.push(`área “${area}”`)
    if (!item.tipo_proceso_id) issues.push(`tipo “${type}”`)
    if (!item.estado_id) issues.push(`estado “${status}”`)
    if (!item.prioridad_id) issues.push(`prioridad “${priority}”`)
    if (!item.fecha_inicio || !item.fecha_fin_programada) issues.push('fechas')
    if (issues.length) { errors.push(`Fila ${line}: revisar ${issues.join(', ')}.`); return [] }
    return [item]
  })
  return { rows, errors }
}
