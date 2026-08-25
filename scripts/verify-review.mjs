import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const SCAR_EMAIL = 'nietosj@gadmriobamba.gob.ec'
const JUAN_DIEGO_EMAIL = 'remachejd@gadmriobamba.gob.ec'

// --- misma lógica pura que src/lib/review.ts -------------------------------------------
function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function isPendingReview(viewer, s, nowIso) {
  if (s.finalized) return { pending: false, reasons: [] }
  const today = nowIso.slice(0, 10)
  const reviewedToday = s.reviewedAt ? s.reviewedAt.slice(0, 10) === today : false
  const isNew = (ts) => Boolean(ts) && (!s.reviewedAt || ts > s.reviewedAt)
  const proximaDue = Boolean(s.proximaRevision) && s.proximaRevision <= today
  const finWeek = Boolean(s.finProgramada) && s.finProgramada <= addDays(today, 7)
  const reasons = []
  let eventNew = false, dateActive = false
  if (viewer === 'juandiego') {
    if (isNew(s.lastCommentFromScarAt)) { eventNew = true; reasons.push('comentario de Scar') }
    if (finWeek) { dateActive = true; reasons.push('fin ≤ 1 semana') }
  } else {
    if (isNew(s.lastEgobChangeAt)) { eventNew = true; reasons.push('cambio eGob') }
    if (isNew(s.lastCommentFromJuanDiegoAt)) { eventNew = true; reasons.push('comentario del Director') }
    if (proximaDue) { dateActive = true; reasons.push('próxima revisión') }
    if (finWeek) { dateActive = true; reasons.push('fin ≤ 1 semana') }
  }
  const pending = eventNew || (dateActive && !reviewedToday)
  return { pending, reasons, reviewedToday }
}
// ---------------------------------------------------------------------------------------

const now = new Date().toISOString()
console.log(`AHORA (CI): ${now}\n`)

// 1) Perfiles: ¿profiles.email resuelve a Scar y al Director?
const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, nombre_completo, email')
if (pErr) { console.error('Error profiles (¿existe la columna email?):', pErr.message); process.exit(1) }
const byEmail = new Map((profiles || []).map((p) => [(p.email || '').trim().toLowerCase(), p]))
const scar = byEmail.get(SCAR_EMAIL)
const jd = byEmail.get(JUAN_DIEGO_EMAIL)
console.log('=== 1) IDENTIDADES (profiles.email) ===')
console.log(`  Scar (${SCAR_EMAIL}): ${scar ? `OK id=${scar.id} · ${scar.nombre_completo}` : 'NO ENCONTRADO'}`)
console.log(`  Director (${JUAN_DIEGO_EMAIL}): ${jd ? `OK id=${jd.id} · ${jd.nombre_completo}` : 'NO ENCONTRADO'}`)
const scarId = scar?.id || null
const jdId = jd?.id || null
const emailsConDato = (profiles || []).filter((p) => p.email).length
console.log(`  profiles con email: ${emailsConDato}/${(profiles || []).length}\n`)

// 2) Datos para evaluar pendientes
const { data: procs } = await supabase.from('processes')
  .select('id, codigo_proceso, nombre_proceso, egob_numero, fecha_proxima_revision, fecha_fin_programada, estado:process_statuses(nombre)')
  .eq('activo', true)
const { data: comments } = await supabase.from('process_comments').select('process_id, created_by, created_at, contenido').order('created_at')
const { data: logs } = await supabase.from('process_change_log').select('process_id, campo, created_at').like('campo', 'egob_%')
let marks = []
try { const r = await supabase.from('process_review_marks').select('process_id, reviewed_by, reviewed_at'); marks = r.data || [] } catch { /* tabla nueva */ }

const latestBy = (arr, pid, uid) => arr.filter((c) => c.process_id === pid && c.created_by === uid).map((c) => c.created_at).sort().at(-1) || null
const latestEgob = (pid) => (logs || []).filter((l) => l.process_id === pid).map((l) => l.created_at).sort().at(-1) || null
const markOf = (pid, uid) => (marks || []).filter((m) => m.process_id === pid && m.reviewed_by === uid).map((m) => m.reviewed_at).sort().at(-1) || null

function signals(p, reviewerId) {
  return {
    finalized: (p.estado?.nombre || '') === 'Finalizado',
    proximaRevision: p.fecha_proxima_revision || null,
    finProgramada: p.fecha_fin_programada || null,
    reviewedAt: reviewerId ? markOf(p.id, reviewerId) : null,
    lastEgobChangeAt: latestEgob(p.id),
    lastCommentFromScarAt: scarId ? latestBy(comments || [], p.id, scarId) : null,
    lastCommentFromJuanDiegoAt: jdId ? latestBy(comments || [], p.id, jdId) : null,
  }
}

// Resumen de marcas de revisión
console.log('=== MARCAS DE REVISIÓN (process_review_marks) ===')
console.log(`  total: ${marks.length} · de Scar: ${marks.filter((m) => m.reviewed_by === scarId).length} · del Director: ${marks.filter((m) => m.reviewed_by === jdId).length}\n`)

// 3) Evidencia: trámites con comentario del Director -> deben estar en Pendientes de Scar
console.log('=== 2) COMENTARIOS DEL DIRECTOR -> PENDIENTES DE SCAR (vista operativa) ===')
let dirComentados = 0, dirEnScar = 0
for (const p of procs || []) {
  const s = signals(p, scarId)
  if (!s.lastCommentFromJuanDiegoAt) continue
  dirComentados += 1
  const r = isPendingReview('scar', s, now)
  if (r.pending && r.reasons.includes('comentario del Director')) dirEnScar += 1
  console.log(`  ${r.pending ? '✅' : '❌'} ${p.codigo_proceso} · comentDir=${s.lastCommentFromJuanDiegoAt} · revScar=${s.reviewedAt || '(ninguna)'} · nueva=${Boolean(s.lastCommentFromJuanDiegoAt) && (!s.reviewedAt || s.lastCommentFromJuanDiegoAt > s.reviewedAt)} · razones:[${r.reasons.join(', ') || '—'}]`)
}
console.log(`  -> ${dirComentados} trámites con comentario del Director; ${dirEnScar} aparecen en Pendientes de Scar por ese motivo\n`)

// 4) Evidencia inversa: comentarios de Scar -> Pendientes del Director (vista ejecutiva)
console.log('=== 3) COMENTARIOS DE SCAR -> PENDIENTES DEL DIRECTOR (vista ejecutiva) ===')
let scarComentados = 0, scarEnDir = 0
for (const p of procs || []) {
  const s = signals(p, jdId)
  if (!s.lastCommentFromScarAt) continue
  scarComentados += 1
  const r = isPendingReview('juandiego', s, now)
  if (r.pending && r.reasons.includes('comentario de Scar')) scarEnDir += 1
  console.log(`  ${r.pending ? '✅' : '❌'} ${p.codigo_proceso} · ${String(p.nombre_proceso).slice(0, 40)} · razones: [${r.reasons.join(', ') || '—'}]`)
}
console.log(`  -> ${scarComentados} trámites con comentario de Scar; ${scarEnDir} aparecen en Pendientes del Director por ese motivo`)

// 5) SIMULACIÓN: un comentario NUEVO del Director (ahora) sobre un trámite que Scar ya revisó
//    -> debe volver a Pendientes de Scar por "comentario del Director".
console.log('\n=== 4) SIMULACIÓN: comentario NUEVO del Director sobre un trámite ya revisado por Scar ===')
const candidato = (procs || []).find((p) => (p.estado?.nombre || '') !== 'Finalizado' && markOf(p.id, scarId))
if (!candidato) {
  console.log('  (no hay trámite no-finalizado con revisión de Scar para simular)')
} else {
  const base = signals(candidato, scarId)
  const antes = isPendingReview('scar', base, now)
  const conComentarioNuevo = { ...base, lastCommentFromJuanDiegoAt: now } // el Director comenta AHORA
  const despues = isPendingReview('scar', conComentarioNuevo, now)
  console.log(`  Trámite: ${candidato.codigo_proceso} · ${String(candidato.nombre_proceso).slice(0, 40)}`)
  console.log(`  Revisión previa de Scar: ${base.reviewedAt}`)
  console.log(`  ANTES (sin comentario nuevo): pending=${antes.pending} razones=[${antes.reasons.join(', ') || '—'}]`)
  console.log(`  DESPUÉS (Director comenta ahora): pending=${despues.pending} razones=[${despues.reasons.join(', ')}]`)
  console.log(`  >> ${despues.pending && despues.reasons.includes('comentario del Director') ? '✅ El comentario NUEVO del Director SÍ lo manda a Pendientes de Scar' : '❌ NO funcionó'}`)
}

// 6) Qué mostrará "Último comentario" en la EJECUTIVA (debe ser el de Scar, no el del Director)
console.log('\n=== 5) "ÚLTIMO COMENTARIO" en la ejecutiva (contraparte = Scar) ===')
const commentsByProc = (comments || [])
for (const num of ['934149', '1169873']) {
  const p = (procs || []).find((x) => String(x.egob_numero || '').replace(/\D/g, '') === num)
  if (!p) { console.log(`  #${num}: (no encontrado)`); continue }
  const deScar = commentsByProc.filter((c) => c.process_id === p.id && c.created_by === scarId).map((c) => c.contenido).at(-1)
  const general = commentsByProc.filter((c) => c.process_id === p.id).map((c) => c.contenido).at(-1)
  console.log(`  #${num} · ${p.codigo_proceso}`)
  console.log(`     ejecutiva mostrará: ${deScar ? `"${String(deScar).slice(0, 60)}" (de Scar) ✅` : 'Sin comentario del operador (Scar no comentó)'}`)
  console.log(`     (último general era: "${String(general || '').slice(0, 60)}")`)
}
