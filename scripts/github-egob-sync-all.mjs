import scheduledEgobSync from '../netlify/functions/egob-sync-all.mjs'

function printAuditTable(audit = []) {
  if (!audit.length) {
    console.log('No hay trámites con eGob configurado para auditar.')
    return
  }
  console.log('\n=== AUDITORÍA eGob ===')
  for (const row of audit) {
    console.log(
      [
        `eGob ${row.egob_numero}`,
        `código ${row.codigo_proceso}`,
        `anterior: ${row.responsable_anterior}`,
        `eGob: ${row.responsable_egob}`,
        `coincide: ${row.coincide}`,
        `acción: ${row.accion}`,
        `mov: ${row.ultimo_movimiento}`,
        `revisados: ${row.tramites_revisados}`,
      ].join(' | '),
    )
  }
}

try {
  const response = await scheduledEgobSync()
  const body = await response.text()
  let parsed
  try { parsed = JSON.parse(body) } catch { parsed = null }

  if (parsed) {
    console.log(
      `Revisados: ${parsed.checked} · Actualizados: ${parsed.updated} · Sin cambios: ${parsed.unchanged} · Omitidos: ${parsed.skipped} · Errores: ${parsed.errors?.length ?? 0}`,
    )
    printAuditTable(parsed.audit)
    if (parsed.errors?.length) {
      console.log('\n=== ERRORES ===')
      for (const err of parsed.errors) console.log(`${err.codigo_proceso} (eGob ${err.issue}): ${err.error}`)
    }
  } else {
    console.log(body)
  }

  process.exit(response.ok ? 0 : 1)
} catch (error) {
  console.error(error?.message || error)
  process.exit(1)
}
