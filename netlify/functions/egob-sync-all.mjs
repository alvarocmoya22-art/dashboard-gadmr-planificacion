import { createClient } from '@supabase/supabase-js'
import { loginAndReadIssue } from './egob-sync.mjs'

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan SUPABASE_URL/VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Netlify.')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function getIssueNumber(process) {
  const explicit = String(process.egob_numero || '').replace(/\D/g, '')
  if (explicit) return explicit
  const matches = [...String(process.documento_respaldo || '').matchAll(/\b\d{5,}\b/g)].map((match) => match[0])
  return matches.at(-1) || ''
}

function changedPayload(process, egob) {
  const payload = {
    egob_numero: egob.issue || getIssueNumber(process),
    egob_url: egob.url || `https://egobedoc.gadmriobamba.gob.ec:8081/issues/${egob.issue}`,
    egob_estado: egob.estado || null,
    egob_responsable_actual: egob.responsable_actual || null,
    egob_ultimo_movimiento: egob.ultimo_movimiento || egob.actualizado_en || null,
    updated_at: new Date().toISOString(),
  }

  const hasChanges = (
    String(process.egob_numero || '') !== String(payload.egob_numero || '') ||
    String(process.egob_url || '') !== String(payload.egob_url || '') ||
    String(process.egob_estado || '') !== String(payload.egob_estado || '') ||
    String(process.egob_responsable_actual || '') !== String(payload.egob_responsable_actual || '') ||
    String(process.egob_ultimo_movimiento || '') !== String(payload.egob_ultimo_movimiento || '')
  )

  return hasChanges ? payload : null
}

export default async function scheduledEgobSync() {
  const supabase = getSupabaseAdmin()
  const { data: processes, error } = await supabase
    .from('processes')
    .select('id,codigo_proceso,nombre_proceso,documento_respaldo,egob_numero,egob_url,egob_estado,egob_responsable_actual,egob_ultimo_movimiento')
    .eq('activo', true)
    .or('egob_numero.not.is.null,documento_respaldo.not.is.null')

  if (error) throw error

  const summary = {
    checked: 0,
    updated: 0,
    skipped: 0,
    errors: [],
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
      const payload = changedPayload(process, egob)
      if (!payload) continue

      const { error: updateError } = await supabase
        .from('processes')
        .update(payload)
        .eq('id', process.id)

      if (updateError) throw updateError
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

// Netlify ejecuta los cron en UTC. Ecuador es UTC-5, por eso 07:00 Ecuador = 12:00 UTC.
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
