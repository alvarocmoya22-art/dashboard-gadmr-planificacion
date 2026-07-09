import { differenceInCalendarDays, format, isBefore, isWithinInterval, addDays, parseISO } from 'date-fns'
import type { CatalogItem, Process, TrafficLight } from '../types'

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')
export const uid = () => crypto.randomUUID()
export const todayIso = () => format(new Date(), 'yyyy-MM-dd')

export function deriveProcess(process: Process): Process {
  const status = repairMojibake(process.estado?.nombre ?? '')
  const end = parseISO(process.fecha_fin_programada)
  const today = new Date()
  let semaforo: TrafficLight = 'Verde'
  if (status === 'Finalizado') semaforo = 'Azul'
  else if (status === 'Suspendido') semaforo = 'Gris'
  else if (isBefore(end, today)) semaforo = 'Rojo'
  else if (isWithinInterval(end, { start: today, end: addDays(today, 7) })) semaforo = 'Amarillo'
  return {
    ...process,
    area: process.area ? { ...process.area, nombre: repairMojibake(process.area.nombre) } : process.area,
    tipo: process.tipo ? { ...process.tipo, nombre: repairMojibake(process.tipo.nombre) } : process.tipo,
    estado: process.estado ? { ...process.estado, nombre: repairMojibake(process.estado.nombre) } : process.estado,
    prioridad: process.prioridad ? { ...process.prioridad, nombre: repairMojibake(process.prioridad.nombre) } : process.prioridad,
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

const brokenAccent = '[\\uFFFD\\uFFFC\\u25A0-\\u25FF?]+'
const brokenAccentLoose = '[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\\s,.;:()/#-]{1,8}'
const preserveUpper = (match: string, upper: string, normal: string) => match === match.toLocaleUpperCase('es') ? upper : normal

export function repairMojibake(value: unknown) {
  let text = String(value ?? '')
  for (let index = 0; index < 3 && /[\u00c3\u00c2\u00e2]/.test(text); index += 1) {
    try {
      const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 255))
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      if (decoded && decoded !== text && !decoded.includes('ï¿½')) text = decoded
    } catch {
      break
    }
  }
  return text
    .replace(/\u00c3\u00a1/g, 'á')
    .replace(/\u00c3\u00a9/g, 'é')
    .replace(/\u00c3\u00ad/g, 'í')
    .replace(/\u00c3\u00b3/g, 'ó')
    .replace(/\u00c3\u00ba/g, 'ú')
    .replace(/\u00c3\u00b1/g, 'ñ')
    .replace(/\u00c3\u0081/g, 'Á')
    .replace(/\u00c3\u0089/g, 'É')
    .replace(/\u00c3\u008d/g, 'Í')
    .replace(/\u00c3\u0093/g, 'Ó')
    .replace(/\u00c3\u009a/g, 'Ú')
    .replace(/\u00c3\u0091/g, 'Ñ')
    .replace(/ÃƒÂ¡/g, 'Ã¡')
    .replace(/ÃƒÂ©/g, 'Ã©')
    .replace(/ÃƒÂ­/g, 'Ã­')
    .replace(/ÃƒÂ³/g, 'Ã³')
    .replace(/ÃƒÂº/g, 'Ãº')
    .replace(/ÃƒÂ±/g, 'Ã±')
    .replace(/ÃƒÂ/g, 'Ã')
    .replace(/Ãƒâ€°/g, 'Ã‰')
    .replace(/ÃƒÂ/g, 'Ã')
    .replace(/Ãƒâ€œ/g, 'Ã“')
    .replace(/ÃƒÅ¡/g, 'Ãš')
    .replace(/Ãƒâ€˜/g, 'Ã‘')
    .replace(/Ã‚Â·/g, 'Â·')
    .replace(/Ã¢â‚¬â€/g, 'â€”')
    .replace(/Ã¢â‚¬Â¦/g, 'â€¦')
    .replace(/Ã¢â‚¬Å“/g, 'â€œ')
    .replace(/Ã¢â‚¬Â/g, 'â€')
    .replace(/Ã¢â€ â€™/g, 'â†’')
    .replace(/Subdivisi[\uFFFD?]+n/gi, 'Subdivisión')
    .replace(/Ejecuci[\uFFFD?]+n/gi, 'Ejecución')
    .replace(/Revisi[\uFFFD?]+n/gi, 'Revisión')
    .replace(/Observaci[\uFFFD?]+n/gi, 'Observación')
    .replace(/Federaci[\uFFFD?]+n/gi, 'Federación')
    .replace(/Alcald[\uFFFD?]+a/gi, 'Alcaldía')
    .replace(/Procuradur[\uFFFD?]+a/gi, 'Procuraduría')
    .replace(/Planificaci[\uFFFD?]+n/gi, 'Planificación')
    .replace(/Participaci[\uFFFD?]+n/gi, 'Participación')
    .replace(/Ciudadan[\uFFFD?]+a/gi, 'Ciudadanía')
    .replace(/sesi[\uFFFD?]+n/gi, 'sesión')
    .replace(/prohibici[\uFFFD?]+n/gi, 'prohibición')
    .replace(/Recopilaci[\uFFFD?]+n/gi, 'Recopilación')
    .replace(/HABILITACI[\uFFFD?]+N/gi, 'HABILITACIÓN')
    .replace(/EDIFICACI[\uFFFD?]+N/gi, 'EDIFICACIÓN')
    .replace(/PLANIFICACI[\uFFFD?]+N/gi, 'PLANIFICACIÓN')
    .replace(/DIRECCI[\uFFFD?]+N/gi, 'DIRECCIÓN')
    .replace(/ACTUALIZACI[\uFFFD?]+N/gi, 'ACTUALIZACIÓN')
    .replace(/VERIFICACI[\uFFFD?]+N/gi, 'VERIFICACIÓN')
    .replace(/DONACI[\uFFFD?]+N/gi, 'DONACIÓN')
    .replace(/DESMEMBRACI[\uFFFD?]+N/gi, 'DESMEMBRACIÓN')
    .replace(/REUNI[\uFFFD?]+N/gi, 'REUNIÓN')
    .replace(/CONSTRUCCI[\uFFFD?]+N/gi, 'CONSTRUCCIÓN')
    .replace(/EJECUCI[\uFFFD?]+N/gi, 'EJECUCIÓN')
    .replace(/INFORMACI[\uFFFD?]+N/gi, 'INFORMACIÓN')
    .replace(/PARAMETROS/gi, 'PARÁMETROS')
    .replace(/PAR[\uFFFD?]+METROS/gi, 'PARÁMETROS')
    .replace(/DISE[\uFFFD?]+O/gi, 'DISEÑO')
    .replace(/P[\uFFFD?]+BLICA/gi, 'PÚBLICA')
    .replace(/P[\uFFFD?]+BLICAS/gi, 'PÚBLICAS')
    .replace(/CORP[\uFFFD?]+REAS/gi, 'CORPÓREAS')
    .replace(/LIM[\uFFFD?]+TE/gi, 'LÍMITE')
    .replace(/M[\uFFFD?]+NIMO/gi, 'MÍNIMO')
    .replace(/M[\uFFFD?]+XIMO/gi, 'MÁXIMO')
    .replace(/T[\uFFFD?]+CNICO/gi, 'TÉCNICO')
    .replace(/T[\uFFFD?]+CNICA/gi, 'TÉCNICA')
    .replace(/TR[\uFFFD?]+MITE/gi, 'TRÁMITE')
    .replace(/TR[\uFFFD?]+MITES/gi, 'TRÁMITES')
    .replace(new RegExp(`DONACI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'DONACIÓN', 'Donación'))
    .replace(new RegExp(`PLANIFICACI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'PLANIFICACIÓN', 'Planificación'))
    .replace(new RegExp(`HABILITACI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'HABILITACIÓN', 'Habilitación'))
    .replace(new RegExp(`EDIFICACI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'EDIFICACIÓN', 'Edificación'))
    .replace(new RegExp(`DIRECCI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'DIRECCIÓN', 'Dirección'))
    .replace(new RegExp(`VERIFICACI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'VERIFICACIÓN', 'Verificación'))
    .replace(new RegExp(`ACTUALIZACI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'ACTUALIZACIÓN', 'Actualización'))
    .replace(new RegExp(`DESMEMBRACI${brokenAccent}N`, 'gi'), (match) => preserveUpper(match, 'DESMEMBRACIÓN', 'Desmembración'))
    .replace(new RegExp(`DISE${brokenAccent}O`, 'gi'), (match) => preserveUpper(match, 'DISEÑO', 'Diseño'))
    .replace(new RegExp(`P${brokenAccent}BLICA`, 'gi'), (match) => preserveUpper(match, 'PÚBLICA', 'Pública'))
    .replace(new RegExp(`P${brokenAccent}BLICAS`, 'gi'), (match) => preserveUpper(match, 'PÚBLICAS', 'Públicas'))
    .replace(new RegExp(`CORP${brokenAccent}REAS`, 'gi'), (match) => preserveUpper(match, 'CORPÓREAS', 'Corpóreas'))
    .replace(new RegExp(`DONACI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'DONACIÓN', 'Donación'))
    .replace(new RegExp(`PLANIFICACI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'PLANIFICACIÓN', 'Planificación'))
    .replace(new RegExp(`HABILITACI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'HABILITACIÓN', 'Habilitación'))
    .replace(new RegExp(`EDIFICACI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'EDIFICACIÓN', 'Edificación'))
    .replace(new RegExp(`DIRECCI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'DIRECCIÓN', 'Dirección'))
    .replace(new RegExp(`VERIFICACI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'VERIFICACIÓN', 'Verificación'))
    .replace(new RegExp(`ACTUALIZACI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'ACTUALIZACIÓN', 'Actualización'))
    .replace(new RegExp(`DESMEMBRACI${brokenAccentLoose}N`, 'gi'), (match) => preserveUpper(match, 'DESMEMBRACIÓN', 'Desmembración'))
    .replace(new RegExp(`DISE${brokenAccentLoose}O`, 'gi'), (match) => preserveUpper(match, 'DISEÑO', 'Diseño'))
    .replace(new RegExp(`P${brokenAccentLoose}BLICA`, 'gi'), (match) => preserveUpper(match, 'PÚBLICA', 'Pública'))
    .replace(new RegExp(`P${brokenAccentLoose}BLICAS`, 'gi'), (match) => preserveUpper(match, 'PÚBLICAS', 'Públicas'))
    .replace(new RegExp(`CORP${brokenAccentLoose}REAS`, 'gi'), (match) => preserveUpper(match, 'CORPÓREAS', 'Corpóreas'))
    .replace(/Planificación, HABITAT Y DESARROLLO/g, 'PLANIFICACIÓN, HABITAT Y DESARROLLO')
    .replace(/Habilitación DE SUELO Y Edificación/g, 'HABILITACIÓN DE SUELO Y EDIFICACIÓN')
    .replace(/Dirección DE OBRAS Públicas/g, 'DIRECCIÓN DE OBRAS PÚBLICAS')
    .replace(/Diseño DE LA OBRA Pública/g, 'DISEÑO DE LA OBRA PÚBLICA')
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




