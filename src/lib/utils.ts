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
    semaforo,
    dias_retraso: semaforo === 'Rojo' ? Math.max(0, differenceInCalendarDays(today, end)) : 0,
  }
}

export const formatDate = (value?: string) => value ? format(parseISO(value), 'dd/MM/yyyy') : '—'
export const getCatalogName = (items: CatalogItem[], id: string) => items.find((item) => item.id === id)?.nombre ?? 'Sin asignar'

export function normalizeText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
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
