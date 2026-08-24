import { createClient } from '@supabase/supabase-js'
import { loginAndReadIssue } from './egob-sync.mjs'

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

// La campana del frontend filtra process_change_log por campos que empiezan por "egob_".
// Para que un movimiento nuevo genere UNA sola notificacion (y no una por cada columna que
// cambia), se emite una unica fila representativa, por orden de prioridad.
const NOTIFY_FIELD_PRIORITY = ['egob_ultimo_movimiento', 'egob_responsable_actual', 'egob_estado']

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan SUPABASE_URL/VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getIssueNumber(process) {
  const explicit = String(process.egob_numero || '').replace(/\D/g, '')
  if (explicit) return explicit
  const matches = [...String(process.documento_respaldo || '').matchAll(/\b\d{5,}\b/g)].map((match) => match[0])
  return matches.at(-1) || ''
}

const clean = (value) => String(value ?? '').trim()

// Palabras que no son personas (estados/prioridades) coladas como responsable en corridas previas.
const NON_PERSON_OWNER = /^(Urgente|Finalizad[oa]|Nuev[oa]|Normal|Alta|Media|Baja|Pendiente|Archivad|Resuelt|Respondi|Cerrad|Anulad|En\s)/i

// Funcion pura y testeable: compara lo que hay en Supabase con lo leido en eGob.
// Devuelve el payload de actualizacion + la lista de cambios (para change_log/notificaciones),
// o null si no hay ningun cambio real (evita updates y notificaciones duplicadas).
// No sobrescribe un valor valido existente con un valor vacio (evita "Pendiente de sincronizar").
export function computeEgobUpdate(process, egob, nowIso = new Date().toISOString()) {
  const next = {
    egob_numero: clean(egob.issue) || getIssueNumber(process),
    egob_url: clean(egob.url) || `https://egobedoc.gadmriobamba.gob.ec:8081/issues/${clean(egob.issue) || getIssueNumber(process)}`,
    egob_estado: clean(egob.estado),
    egob_responsable_actual: clean(egob.responsable_actual),
    egob_responsable_cargo: clean(egob.responsable_cargo),
    egob_ultimo_movimiento: clean(egob.ultimo_movimiento) || clean(egob.actualizado_en),
  }

  const payload = {}
  let hasChanges = false

  // El cargo pertenece al responsable: si el responsable cambió a otra persona,
  // el cargo anterior es de la persona previa y no debe conservarse.
  const respPrev = clean(process.egob_responsable_actual)
  const responsableCambio = Boolean(next.egob_responsable_actual)
    && next.egob_responsable_actual !== respPrev

  for (const key of Object.keys(next)) {
    const previous = clean(process[key])
    const value = next[key]
    // Un responsable que sea una palabra de estado/prioridad (p. ej. "Urgente",
    // "Finalizado") es invalido: no debe preservarse aunque el nuevo valor sea vacio.
    const previousInvalid = key === 'egob_responsable_actual' && NON_PERSON_OWNER.test(previous)
    // Cargo huerfano: cambio el responsable pero eGob no trajo cargo del nuevo -> limpiar,
    // en vez de dejar el cargo del responsable anterior.
    const cargoHuerfano = key === 'egob_responsable_cargo' && responsableCambio
    // Nunca borrar un dato valido existente con vacio (salvo invalidos u huerfanos).
    if (!value && previous && !previousInvalid && !cargoHuerfano) continue
    if (value !== previous) {
      payload[key] = value || null
      hasChanges = true
    }
  }

  // Trámites relacionados (arreglo): se comparan por contenido.
  const relNew = Array.isArray(egob.tramites_relacionados) ? egob.tramites_relacionados.map(String) : []
  const relOld = Array.isArray(process.egob_tramites_relacionados) ? process.egob_tramites_relacionados.map(String) : []
  if (relNew.length && JSON.stringify([...relNew].sort()) !== JSON.stringify([...relOld].sort())) {
    payload.egob_tramites_relacionados = relNew
    hasChanges = true
  }

  // Trámite(s) madre (tarea padre en eGob): solo la cadena de padres, sin hijos ni insistos.
  const madreNew = Array.isArray(egob.tramites_madre) ? egob.tramites_madre.map(String) : []
  const madreOld = Array.isArray(process.egob_tramites_madre) ? process.egob_tramites_madre.map(String) : []
  if (JSON.stringify([...madreNew].sort()) !== JSON.stringify([...madreOld].sort())) {
    payload.egob_tramites_madre = madreNew
    hasChanges = true
  }

  if (!hasChanges) return null

  // Una unica notificacion por movimiento: la fila representativa de mayor prioridad.
  const notifyField = NOTIFY_FIELD_PRIORITY.find((campo) => campo in payload)
  const changes = notifyField
    ? [{
        campo: notifyField,
        valor_anterior: clean(process[notifyField]) || null,
        valor_nuevo: payload[notifyField],
      }]
    : []

  payload.egob_sincronizado_en = nowIso
  payload.updated_at = nowIso

  return { payload, changes }
}

export default async function scheduledEgobSync() {
  const supabase = getSupabaseAdmin()
  const { data: processes, error } = await supabase
    .from('processes')
    .select('id,codigo_proceso,nombre_proceso,documento_respaldo,egob_numero,egob_url,egob_estado,egob_responsable_actual,egob_responsable_cargo,egob_ultimo_movimiento,egob_sincronizado_en,egob_tramites_relacionados,egob_tramites_madre')
    .eq('activo', true)
    .or('egob_numero.not.is.null,documento_respaldo.not.is.null')

  if (error) throw error

  const summary = {
    checked: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
    audit: [],
  }

  for (const process of processes || []) {
    const issue = getIssueNumber(process)
    if (!issue) {
      summary.skipped += 1
      continue
    }

    summary.checked += 1
    try {
      const egob = await loginAndReadIssue(issue)
      const result = computeEgobUpdate(process, egob)

      const auditRow = {
        egob_numero: egob.issue || issue,
        codigo_proceso: process.codigo_proceso,
        responsable_anterior: process.egob_responsable_actual || '(vacío)',
        responsable_egob: egob.responsable_actual || '(no detectado)',
        ultimo_movimiento: egob.ultimo_movimiento || '(sin movimiento)',
        coincide: clean(process.egob_responsable_actual) === clean(egob.responsable_actual) ? 'sí' : 'no',
        tramites_revisados: (egob.tramites_revisados || [issue]).join(', '),
        accion: result ? 'actualizado' : 'sin cambios',
      }
      summary.audit.push(auditRow)

      if (!result) {
        summary.unchanged += 1
        continue
      }

      let { error: updateError } = await supabase
        .from('processes')
        .update(result.payload)
        .eq('id', process.id)

      // Si alguna columna aun no existe en la BD (migracion no aplicada), reintenta sin esas
      // columnas en vez de fallar (la sincronizacion sigue funcionando).
      if (updateError && /egob_sincronizado_en|egob_tramites_relacionados|egob_tramites_madre/.test(String(updateError.message || ''))) {
        const { egob_sincronizado_en, egob_tramites_relacionados, egob_tramites_madre, ...rest } = result.payload
        void egob_sincronizado_en; void egob_tramites_relacionados; void egob_tramites_madre
        ;({ error: updateError } = await supabase.from('processes').update(rest).eq('id', process.id))
      }

      if (updateError) throw updateError

      // Una fila de change_log por cada campo eGob que cambio -> alimenta la campana sin duplicar.
      if (result.changes.length) {
        const rows = result.changes.map((change) => ({
          process_id: process.id,
          campo: change.campo,
          valor_anterior: change.valor_anterior,
          valor_nuevo: change.valor_nuevo,
        }))
        const { error: logError } = await supabase.from('process_change_log').insert(rows)
        if (logError) throw logError
      }

      summary.updated += 1
    } catch (error) {
      summary.errors.push({
        codigo_proceso: process.codigo_proceso,
        issue,
        error: error.message || 'Error desconocido',
      })
    }
  }

  return new Response(JSON.stringify(summary), { status: 200, headers })
}

// GitHub Actions ejecuta el cron (ver .github/workflows/egob-sync.yml). Este bloque se conserva
// por compatibilidad con Netlify, aunque la app ya no depende de Netlify.
export const config = {
  schedule: '0 12 * * *',
}

export async function handler() {
  const response = await scheduledEgobSync()
  return {
    statusCode: response.status,
    headers,
    body: await response.text(),
  }
}
