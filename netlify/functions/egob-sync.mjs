import http from 'node:http'
import https from 'node:https'

const EGOB_BASE_URL = process.env.EGOB_BASE_URL || 'https://egobedoc.gadmriobamba.gob.ec:8081'
const EGOB_LOGIN_URL = process.env.EGOB_LOGIN_URL || 'https://egob.gadmriobamba.gob.ec:8443/cas/login'
const REJECT_UNAUTHORIZED = process.env.EGOB_TLS_REJECT_UNAUTHORIZED === 'true'

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

// Caracteres validos dentro de un nombre propio en mayusculas (con acentos).
const NAME_CHARS = "A-ZÁÉÍÓÚÑÜ"
const DATE_TIME_RE = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?/g

class CookieJar {
  constructor() { this.cookies = new Map() }
  setFrom(response) {
    const raw = response.headers.get('set-cookie')
    if (!raw) return
    raw.split(/,(?=[^;,]+=)/).forEach((cookie) => {
      const [pair] = cookie.split(';')
      const index = pair.indexOf('=')
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim())
    })
  }
  header() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
  }
}

function absoluteUrl(url, base) {
  return new URL(url, base).toString()
}

async function request(jar, url, options = {}) {
  const response = await nodeRequest(url, {
    method: options.method || 'GET',
    body: options.body,
    headers: {
      'user-agent': 'Mozilla/5.0 eGobSync/1.0',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(jar.header() ? { cookie: jar.header() } : {}),
      ...(options.headers || {}),
    },
  })
  jar.setFrom(response)
  return response
}

function nodeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const body = options.body ? String(options.body) : undefined
    const transport = target.protocol === 'http:' ? http : https
    const requestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
        ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
      },
      rejectUnauthorized: REJECT_UNAUTHORIZED,
    }
    const req = transport.request(requestOptions, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({
          status: res.statusCode || 0,
          headers: { get: (name) => res.headers[name.toLowerCase()]?.toString() || null },
          text: async () => text,
        })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function follow(jar, url, options = {}) {
  let currentUrl = url
  let response = await request(jar, currentUrl, options)
  for (let i = 0; i < 10 && response.status >= 300 && response.status < 400; i += 1) {
    const location = response.headers.get('location')
    if (!location) break
    currentUrl = absoluteUrl(location, currentUrl)
    response = await request(jar, currentUrl)
  }
  return { response, url: currentUrl, html: await response.text() }
}

function inputValue(html, name) {
  const pattern = new RegExp(`<input[^>]+name=["']${name}["'][^>]*>`, 'i')
  const input = html.match(pattern)?.[0] || ''
  return decodeHtml(input.match(/value=["']([^"']*)["']/i)?.[1] || '')
}

function formAction(html, currentUrl) {
  const form = html.match(/<form[^>]+id=["']fm1["'][\s\S]*?>/i)?.[0] || html.match(/<form[\s\S]*?>/i)?.[0] || ''
  const action = form.match(/action=["']([^"']+)["']/i)?.[1]
  return action ? absoluteUrl(action, currentUrl) : currentUrl
}

// Repara mojibake devolviendo texto UTF-8 limpio (no deja Ã, Â, â ni signos de reemplazo).
// Reversa la mala interpretacion latin1<->utf8 y normaliza los acentos usuales del castellano.
export function repairMojibake(value = '') {
  let text = String(value ?? '')
  for (let index = 0; index < 3 && /[ÃÂâ]/.test(text); index += 1) {
    try {
      const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 255))
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      if (decoded && decoded !== text && !decoded.includes('�')) text = decoded
      else break
    } catch {
      break
    }
  }
  return text.replace(/[�￼]+/g, "")
}

function decodeHtml(value = '') {
  return repairMojibake(value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16))))
}

function stripText(html) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|tr|h1|h2|h3|div|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Limpia un fragmento capturado y devuelve solo el nombre propio (2 a 6 palabras en mayusculas).
function cleanName(raw = '') {
  let text = repairMojibake(raw).replace(/\s+/g, ' ').trim()
  // Corta en el cargo entre parentesis o separadores estructurales.
  text = text.split(/\s*[([|]/)[0]
  text = text.split(/\s+[-–—]\s+/)[0]
  // Corta al llegar a palabras clave que ya no forman parte del nombre.
  text = text.replace(/\b(Nota|Estado|Prioridad|Fecha|Reasignaci|Documento|Asignado|Nueva|Archivado|No\s+hay|MEMORANDO|Adjuntos|Flujo|Creado|Actualizado)\b[\s\S]*$/i, '')
  const namePattern = new RegExp(`[${NAME_CHARS}][${NAME_CHARS}.'’-]*(?:\\s+[${NAME_CHARS}][${NAME_CHARS}.'’-]*){1,6}`)
  const match = text.match(namePattern)
  return (match ? match[0] : text).replace(/\s+/g, ' ').trim()
}

function parseRoleForAssignee(text, assignee) {
  if (!assignee) return ''
  const namePattern = escapeRegExp(assignee).replace(/\s+/g, '\\s+')
  const match = text.match(new RegExp(`${namePattern}\\s*\\(([^)\\n]{4,})\\)`, 'i'))
  return repairMojibake(match?.[1] || '').replace(/\s+/g, ' ').trim()
}

function matchBetween(text, start, end) {
  const pattern = new RegExp(`${escapeRegExp(start)}([\\s\\S]*?)${escapeRegExp(end)}`, 'i')
  return text.match(pattern)?.[1]?.replace(/\s+/g, ' ').trim() || ''
}

function parseLatestAttachment(text) {
  const block = matchBetween(text, 'Adjuntos subidos posterior al envío / Expediente', 'Flujo de procesos') || ''
  const match = block.match(/([A-ZÁÉÍÓÚÑ0-9_.\- ]+\.(?:pdf|png|jpg|jpeg|rar|zip|docx?))\s*\([^)]+\)[\s\S]*?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+[AP]M)/i)
  return match ? `${match[2]} - ${match[1].replace(/\s+/g, ' ').trim()}` : ''
}

// ---------------------------------------------------------------------------
// Motor de movimientos.
// Un movimiento eGob se compone de: actor (encabezado, NO es el responsable),
// numero de secuencia (#189), fecha-hora y un cuerpo con la accion realizada.
// El responsable actual siempre es el DESTINATARIO indicado en el cuerpo,
// nunca el actor del encabezado.
// ---------------------------------------------------------------------------

const MOVEMENT_MATCHERS = [
  {
    tipo: 'Reasignación',
    // "Asignado ha cambiado de PERSONA A a PERSONA B" -> destinatario = PERSONA B
    regex: /Asignado\s+ha\s+cambiado\s+de\s+.+?\s+a\s+([^\n<]+)/gi,
    destino: (m) => cleanName(m[1]),
    label: (name) => `Reasignación a ${name}`,
  },
  {
    tipo: 'Reasignación',
    // "Reasignación a PERSONA" / "Reasignado/s a PERSONA"
    regex: /Reasignaci[oó]?n\s+a:?\s+([^\n<]+)/gi,
    destino: (m) => cleanName(m[1]),
    label: (name) => `Reasignación a ${name}`,
  },
  {
    tipo: 'Reasignación',
    regex: /Reasignad[oa]s?\s+a:?\s+([^\n<]+)/gi,
    destino: (m) => cleanName(m[1]),
    label: (name) => `Reasignación a ${name}`,
  },
  {
    tipo: 'Documento enviado',
    // "Documento enviado a PERSONA" (case-insensitive)
    regex: /Documento\s+enviado\s+a\s+([^\n<]+)/gi,
    destino: (m) => cleanName(m[1]),
    label: (name) => `Documento enviado a ${name}`,
  },
  {
    tipo: 'Nueva respuesta',
    regex: /Nueva\s+respuesta/gi,
    destino: () => '',
    label: () => 'Nueva respuesta',
  },
  {
    tipo: 'Archivado',
    regex: /\bArchivad[oa]\b/gi,
    destino: () => '',
    label: () => 'Archivado',
  },
]

// Busca fecha-hora y numero de secuencia mas cercanos al anclaje de la accion.
function contextMetadata(text, anchorIndex) {
  const before = text.slice(Math.max(0, anchorIndex - 600), anchorIndex)
  const after = text.slice(anchorIndex, Math.min(text.length, anchorIndex + 200))
  const dates = [...`${before}\n${after}`.matchAll(DATE_TIME_RE)].map((item) => item[0])
  const date = (dates.at(-1) || '').replace(/\s+/g, ' ').trim()
  // #189: secuencia del movimiento (1 a 4 digitos). Excluye numeros de tramite (5+ digitos).
  const seqMatches = [...before.matchAll(/#(\d{1,4})(?!\d)/g)].map((item) => Number(item[1]))
  const seq = seqMatches.length ? seqMatches.at(-1) : null
  return { date, seq }
}

function movementTimestamp(date) {
  if (!date) return 0
  const dateTime = date.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/)
  if (dateTime) return new Date(`${dateTime[1]}T${dateTime[2]}`).getTime()
  const dayOnly = date.match(/(\d{4}-\d{2}-\d{2})/)
  return dayOnly ? new Date(`${dayOnly[1]}T23:59`).getTime() : 0
}

// Extrae todos los movimientos de un texto plano (una pagina eGob ya aplanada).
function extractMovements(issue, text) {
  const events = []
  for (const matcher of MOVEMENT_MATCHERS) {
    matcher.regex.lastIndex = 0
    for (const match of text.matchAll(matcher.regex)) {
      const anchor = match.index || 0
      const responsable = matcher.destino(match)
      // Las reasignaciones y envios exigen un destinatario valido.
      if (matcher.tipo === 'Reasignación' || matcher.tipo === 'Documento enviado') {
        if (!responsable) continue
      }
      const { date, seq } = contextMetadata(text, anchor)
      events.push({
        issue,
        tipo: matcher.tipo,
        responsable,
        date,
        seq,
        index: anchor,
        timestamp: movementTimestamp(date),
        label: matcher.label(responsable),
      })
    }
  }
  return events
}

// Ordena por: fecha-hora, luego numero de secuencia (#), luego orden de aparicion (DOM).
function isNewerMovement(candidate, current) {
  if (!current) return true
  if (candidate.timestamp !== current.timestamp) return candidate.timestamp > current.timestamp
  const candidateSeq = candidate.seq ?? -1
  const currentSeq = current.seq ?? -1
  if (candidateSeq !== currentSeq) return candidateSeq > currentSeq
  return candidate.index >= current.index
}

function pickLatestMovement(events) {
  return events.reduce((best, event) => (isNewerMovement(event, best) ? event : best), null)
}

// El responsable actual es el destinatario del ultimo movimiento que asigna a alguien
// (reasignacion o documento enviado). "Nueva respuesta"/"Archivado" no cambian el responsable.
function pickLatestOwner(events) {
  const withOwner = events.filter((event) => event.responsable)
  return pickLatestMovement(withOwner)
}

function formatMovement(event, rootIssue) {
  if (!event) return ''
  const prefix = event.issue && event.issue !== rootIssue ? `Trámite ${event.issue}: ` : ''
  const seq = event.seq ? ` (#${event.seq})` : ''
  const date = event.date ? `${event.date} - ` : ''
  return `${prefix}${date}${event.label}${seq}`
}

function parseIssue(issue, html, finalUrl) {
  const text = stripText(html)
  const estado = text.match(/Estado:\s*([^\n]+?)\s*Prioridad:/i)?.[1]?.trim() || ''
  const prioridad = text.match(/Prioridad:\s*([^\n]+?)\s*Fecha registro:/i)?.[1]?.trim() || ''
  const actualizado = text.match(/Actualizado el\s+(.+?)\s*\./i)?.[1]?.trim() || ''
  const asunto = text.match(/Asunto:\s*(.+?)\s*Creado por/i)?.[1]?.trim() || ''

  const movements = extractMovements(issue, text)
  const latestMovement = pickLatestMovement(movements)
  const latestOwner = pickLatestOwner(movements)
  const latestAttachment = parseLatestAttachment(text)

  const children = [...html.matchAll(/href=["']\/issues\/(\d+)["']/g)]
    .map((item) => item[1])
    .filter((value, index, array) => array.indexOf(value) === index && value !== issue)

  const responsable = latestOwner?.responsable || ''
  const ultimoMovimiento = formatMovement(latestMovement, issue)
    || latestAttachment
    || (actualizado ? `Actualizado el ${actualizado}` : '')

  return {
    issue,
    url: finalUrl || `${EGOB_BASE_URL}/issues/${issue}`,
    asunto,
    estado: estado || latestMovement?.tipo || '',
    prioridad,
    responsable_actual: responsable,
    responsable_cargo: parseRoleForAssignee(text, responsable),
    ultimo_movimiento: ultimoMovimiento,
    actualizado_en: actualizado,
    // timestamp/seq del movimiento seleccionado, para comparar entre madre e hijos.
    _movement: latestMovement,
    _owner: latestOwner,
    tramites_hijos: children,
    sincronizado_en: new Date().toISOString(),
  }
}

// Combina la cadena madre + hijos escogiendo el movimiento realmente mas reciente de TODA la cadena.
function mergeIssueChain(rootIssue, relatedIssues) {
  const candidates = [rootIssue, ...relatedIssues].filter(Boolean)

  const allMovements = candidates.flatMap((item) => (item._movement ? [item._movement] : []))
  const latestMovement = pickLatestMovement(allMovements)

  const allOwners = candidates.flatMap((item) => (item._owner ? [item._owner] : []))
  const latestOwner = pickLatestOwner(allOwners)

  // El estado/cargo se toma del tramite donde ocurrio el ultimo movimiento con responsable.
  const ownerIssue = candidates.find((item) => item.issue === latestOwner?.issue) || rootIssue
  const movementIssue = candidates.find((item) => item.issue === latestMovement?.issue) || rootIssue

  return {
    issue: rootIssue.issue,
    url: rootIssue.url,
    asunto: rootIssue.asunto,
    estado: movementIssue.estado || rootIssue.estado,
    prioridad: rootIssue.prioridad,
    responsable_actual: latestOwner?.responsable || rootIssue.responsable_actual,
    responsable_cargo: ownerIssue.responsable_cargo || rootIssue.responsable_cargo,
    ultimo_movimiento: formatMovement(latestMovement, rootIssue.issue) || rootIssue.ultimo_movimiento,
    actualizado_en: movementIssue.actualizado_en || rootIssue.actualizado_en,
    tramites_hijos: [...new Set(candidates.flatMap((item) => item.tramites_hijos || []).filter((item) => item !== rootIssue.issue))],
    tramites_revisados: candidates.map((item) => item.issue),
    sincronizado_en: new Date().toISOString(),
  }
}

async function readRelatedIssues(jar, rootIssue, linkedIssues, visited = new Set([rootIssue])) {
  const related = []
  const queue = [...new Set(linkedIssues || [])].filter((item) => item && !visited.has(item)).slice(0, 12)

  while (queue.length) {
    const issue = queue.shift()
    if (!issue || visited.has(issue)) continue
    visited.add(issue)

    const page = await follow(jar, `${EGOB_BASE_URL}/issues/${encodeURIComponent(issue)}`)
    if (page.url.includes('/cas/login') || !page.html.includes(`#${issue}`)) continue

    const parsed = parseIssue(issue, page.html, page.url)
    related.push(parsed)

    for (const child of parsed.tramites_hijos || []) {
      if (!visited.has(child) && queue.length < 12) queue.push(child)
    }
  }

  return related
}

export async function loginAndReadIssue(issue) {
  const username = process.env.EGOB_USERNAME
  const password = process.env.EGOB_PASSWORD
  if (!username || !password) {
    const error = new Error('Faltan EGOB_USERNAME y EGOB_PASSWORD en variables de entorno.')
    error.statusCode = 500
    throw error
  }

  const jar = new CookieJar()
  const target = `${EGOB_BASE_URL}/issues/${encodeURIComponent(issue)}`
  let page = await follow(jar, target)

  if (/name=["']execution["']/i.test(page.html) || page.url.includes('/cas/login')) {
    const params = new URLSearchParams()
    params.set('username', username)
    params.set('password', password)
    params.set('execution', inputValue(page.html, 'execution'))
    params.set('_eventId', inputValue(page.html, '_eventId') || 'submit')
    params.set('geolocation', '')
    params.set('submit', 'INICIAR SESIÓN')

    page = await follow(jar, formAction(page.html, page.url), {
      method: 'POST',
      body: params,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: new URL(EGOB_LOGIN_URL).origin,
        referer: page.url,
      },
    })
  }

  if (page.url.includes('/cas/login') || /Introduzca su nombre de usuario/i.test(page.html)) {
    const loginText = stripText(page.html)
    const visibleReason = loginText.match(/(Credenciales[\s\S]{0,120}|Autenticaci[oó]n[\s\S]{0,120}|inv[aá]lid[\s\S]{0,120}|requerido[\s\S]{0,120})/i)?.[0]
    const error = new Error(`No se pudo iniciar sesión en eGob. ${visibleReason ? `Mensaje: ${visibleReason}` : 'Revisa usuario, contraseña o permisos.'}`)
    error.statusCode = 401
    throw error
  }

  if (!page.html.includes(`MEMORANDO #${issue}`) && !page.html.includes(`#${issue}`)) {
    const error = new Error(`No se encontró el trámite eGob ${issue}.`)
    error.statusCode = 404
    throw error
  }

  const rootIssue = parseIssue(issue, page.html, page.url)
  const relatedIssues = await readRelatedIssues(jar, issue, rootIssue.tramites_hijos)

  return mergeIssueChain(rootIssue, relatedIssues)
}

export async function handler(event) {
  try {
    const issue = event.queryStringParameters?.issue?.replace(/\D/g, '')
    if (!issue) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el parámetro issue.' }) }
    const data = await loginAndReadIssue(issue)
    return { statusCode: 200, headers, body: JSON.stringify(data) }
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({ error: error.message || 'No se pudo sincronizar eGob.' }),
    }
  }
}

// Exportado para pruebas locales con fixtures HTML (sin red).
export const __test__ = {
  stripText,
  cleanName,
  repairMojibake,
  extractMovements,
  pickLatestMovement,
  pickLatestOwner,
  parseIssue,
  mergeIssueChain,
  formatMovement,
}
