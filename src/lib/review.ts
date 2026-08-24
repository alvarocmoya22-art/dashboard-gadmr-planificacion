// Reglas de "Pendientes de revisión" por persona (observación #13).
//
// Scar (operador): aparece un trámite si tuvo un cambio en eGob, si Juan Diego le dejó un
//   comentario, si la próxima revisión es hoy o antes, o si falta ≤ 1 semana para el fin programado.
// Ing. Juan Diego (Director): aparece si Scar le dejó un comentario, o si falta ≤ 1 semana
//   para el fin programado.
//
// "Marcar como revisado" oculta el trámite solo ESE día (reaparece mañana si sigue pendiente,
// o antes si llega una señal nueva: nuevo cambio eGob / nuevo comentario del otro).

export type ReviewViewer = 'scar' | 'juandiego' | 'other'

export type ReviewSignals = {
  finalized: boolean
  proximaRevision?: string | null    // 'YYYY-MM-DD'
  finProgramada?: string | null      // 'YYYY-MM-DD'
  reviewedAt?: string | null         // ISO timestamp de la última revisión del que mira
  lastEgobChangeAt?: string | null   // ISO del último cambio eGob
  lastCommentFromScarAt?: string | null       // ISO del último comentario de Scar
  lastCommentFromJuanDiegoAt?: string | null   // ISO del último comentario de Juan Diego
}

// Suma días a una fecha 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD'.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isPendingReview(viewer: ReviewViewer, s: ReviewSignals, nowIso: string): boolean {
  if (s.finalized) return false
  const today = nowIso.slice(0, 10)
  const reviewedToday = s.reviewedAt ? s.reviewedAt.slice(0, 10) === today : false
  // Un evento "cuenta" si ocurrió después de la última revisión del que mira (señal nueva).
  const isNew = (ts?: string | null) => Boolean(ts) && (!s.reviewedAt || (ts as string) > s.reviewedAt)

  const proximaDue = Boolean(s.proximaRevision) && (s.proximaRevision as string) <= today
  // "Una semana antes" del fin programado (incluye vencidos): fin <= hoy + 7 días.
  const finWeek = Boolean(s.finProgramada) && (s.finProgramada as string) <= addDays(today, 7)

  let eventNew = false
  let dateActive = false
  if (viewer === 'juandiego') {
    eventNew = isNew(s.lastCommentFromScarAt)
    dateActive = finWeek
  } else {
    // Scar (y cualquier otro operador/admin usa las mismas reglas operativas).
    eventNew = isNew(s.lastEgobChangeAt) || isNew(s.lastCommentFromJuanDiegoAt)
    dateActive = proximaDue || finWeek
  }
  // Las señales de fecha se ocultan el día que se marcó revisado; las señales de evento nuevas
  // (posteriores a la revisión) igual reaparecen porque son "señal nueva".
  return eventNew || (dateActive && !reviewedToday)
}
