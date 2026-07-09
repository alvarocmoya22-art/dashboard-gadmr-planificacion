import { differenceInCalendarDays, format, isBefore, isWithinInterval, addDays, parseISO } from 'date-fns'
import type { CatalogItem, Process, TrafficLight } from '../types'

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')
export const uid = () => crypto.randomUUID()
export const todayIso = () => format(new Date(), 'yyyy-MM-dd')

export function deriveProcess(process: Process): Process {
  const status = process.estado?.nombre ?? ''
  const end = parseISO(process.fecha_fin_programada)
  const today = new Date()
  let semaforo: TrafficLight = 'Verde'
  if (status === 'Finalizado') semaforo = 'Azul'
  else if (status === 'Suspendido') semaforo = 'Gris'
  else if (isBefore(end, today)) semaforo = 'Rojo'
  else if (isWithinInterval(end, { start: today, end: addDays(today, 7) })) semaforo = 'Amarillo'
  return {
    ...process,
    nombre_proceso: repairMojibake(process.nombre_proceso),
    responsable_principal: repairMojibake(process.responsable_principal),
    responsable_secundario: process.responsable_secundario ? repairMojibake(process.responsable_secundario) : process.responsable_secundario,
    dependencia_externa: process.dependencia_externa ? repairMojibake(process.dependencia_externa) : process.dependencia_externa,
    documento_respaldo: process.documento_respaldo ? repairMojibake(process.documento_respaldo) : process.documento_respaldo,
    egob_estado: process.egob_estado ? repairMojibake(process.egob_estado) : process.egob_estado,
    egob_responsable_actual: process.egob_responsable_actual ? repairMojibake(process.egob_responsable_actual) : process.egob_responsable_actual,
    egob_ultimo_movimiento: process.egob_ultimo_movimiento ? repairMojibake(process.egob_ultimo_movimiento) : process.egob_ultimo_movimiento,
    proxima_accion: process.proxima_accion ? repairMojibake(process.proxima_accion) : process.proxima_accion,
    objetivo: process.objetivo ? repairMojibake(process.objetivo) : process.objetivo,
    observaciones: process.observaciones ? repairMojibake(process.observaciones) : process.observaciones,
    semaforo,
    dias_retraso: semaforo === 'Rojo' ? Math.max(0, differenceInCalendarDays(today, end)) : 0,
  }
}

export const formatDate = (value?: string) => value ? format(parseISO(value), 'dd/MM/yyyy') : '—'
export const getCatalogName = (items: CatalogItem[], id: string) => items.find((item) => item.id === id)?.nombre ?? 'Sin asignar'

export function repairMojibake(value: unknown) {
  let text = String(value ?? '')
  for (let index = 0; index < 2 && /Ã|Â|â/.test(text); index += 1) {
    try {
      const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 255))
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      if (decoded && decoded !== text && !decoded.includes('�')) text = decoded
    } catch {
      break
    }
  }
  return text
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Â·/g, '·')
    .replace(/â€”/g, '—')
    .replace(/â€¦/g, '…')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/â†’/g, '→')
    .replace(/Subdivisi.n/g, 'Subdivisión')
    .replace(/Revisi.n/g, 'Revisión')
    .replace(/Observaci.n/g, 'Observación')
    .replace(/Federaci.n/g, 'Federación')
    .replace(/Alcald.a/g, 'Alcaldía')
    .replace(/Procuradur.a/g, 'Procuraduría')
    .replace(/Planificaci.n/g, 'Planificación')
    .replace(/Participaci.n/g, 'Participación')
    .replace(/Ciudadan.a/g, 'Ciudadanía')
    .replace(/sesi.n/g, 'sesión')
    .replace(/prohibici.n/g, 'prohibición')
    .replace(/Recopilaci.n/g, 'Recopilación')
}

export function normalizeText(value: unknown) {
  return repairMojibake(value).trim().replace(/\s+/g, ' ')
}

export function normalizeStatus(value: unknown) {
  const key = normalizeText(value).toLocaleLowerCase('es')
  const map: Record<string, string> = {
    'en ejecución': 'En Ejecución',
    'en ejecucion': 'En Ejecución',
    'en revisión': 'En Revisión',
    'en revision': 'En Revisión',
    'pendiente externo': 'Pendiente Externo',
  }
  return map[key] ?? key.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

export function excelDateToIso(value: unknown): string {
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    return format(date, 'yyyy-MM-dd')
  }
  if (value instanceof Date) return format(value, 'yyyy-MM-dd')
  const raw = normalizeText(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'yyyy-MM-dd')
}

export function normalizeProgress(value: unknown): number {
  const numeric = Number(String(value ?? 0).replace('%', '').replace(',', '.'))
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, numeric > 0 && numeric <= 1 ? numeric * 100 : numeric))
}
