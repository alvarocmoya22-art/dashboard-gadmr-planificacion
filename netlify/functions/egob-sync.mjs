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
        const buffer = Buffer.concat(chunks)
        resolve({
          status: res.statusCode || 0,
          headers: { get: (name) => res.headers[name.toLowerCase()]?.toString() || null },
          text: async () => buffer.toString('utf8'),
          buffer,
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

// Descarga binaria (para el PDF de recorrido), siguiendo redirecciones.
async function followBinary(jar, url) {
  let currentUrl = url
  let response = await request(jar, currentUrl)
  for (let i = 0; i < 10 && response.status >= 300 && response.status < 400; i += 1) {
    const location = response.headers.get('location')
    if (!location) break
    currentUrl = absoluteUrl(location, currentUrl)
    response = await request(jar, currentUrl)
  }
  return { response, url: currentUrl, buffer: response.buffer }
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
  const re = new RegExp(`${namePattern}\\s*\\(([^)\\n]{4,120})\\)`, 'gi')
  for (const match of text.matchAll(re)) {
    const cargo = repairMojibake(match[1]).replace(/\s+/g, ' ').trim()
    // El cargo debe tener letras (evita capturar numeros de tramite como "( 1131364 )").
    if (/[A-Za-zÁÉÍÓÚÑ]/.test(cargo) && !/^[\d\s]+$/.test(cargo)) return cargo
  }
  return ''
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
// Motor de movimientos (basado en la estructura REAL del "Flujo de procesos" de eGob).
//
// Cada movimiento se renderiza como un bloque con este encabezado:
//
//   Reasignación ( 1213382 ) #3  MARIA ALEJANDRA BONIFAZ LÓPEZ (Jefe de ...)  2026-07-27 17:45
//   └─ tipo       └─ tramite   └seq └─ ACTOR = persona a quien queda asignado   └─ fecha-hora
//
// En eGob el ACTOR del encabezado es la persona a la que quedó asignado el tramite
// (el destinatario/holder), y la fecha y el # estan DENTRO del encabezado.
// Por lo tanto: responsable actual = actor del bloque de Reasignacion con la fecha
// mas reciente de toda la cadena (madre + hijos). No se usan heuristicas de texto libre
// (que capturaban el menu lateral o el usuario logueado).
// ---------------------------------------------------------------------------

// Tipos de bloque conocidos en el flujo eGob.
const MOVEMENT_TYPES = 'Reasignación|Reasignacion|Documento Enviado|Documento enviado|Nueva Respuesta|Nueva respuesta|Archivado|Archivada|Anulación|Anulacion|Anulado|Delegación|Delegacion|Delegado|Sumillado|Respuesta'

// Encabezado de bloque: TIPO ( tramite ) #seq  ACTOR (cargo opcional)  FECHA HORA
const HEADER_RE = new RegExp(
  `(${MOVEMENT_TYPES})\\s*\\(\\s*(\\d{4,})\\s*\\)\\s*#(\\d+)\\s+` +
  `([${NAME_CHARS}][^\\n(]{3,70}?)\\s*(?:\\(([^)\\n]{0,160})\\))?\\s*` +
  `(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2})`,
  'g',
)

// Solo estos tipos cambian a quien esta asignado el tramite.
const OWNER_TYPES = new Set(['Reasignación'])

// Dentro de un bloque de reasignacion, el DESTINATARIO (nuevo responsable) aparece en:
//   "Asignado ha cambiado de <ACTOR> a <DESTINATARIO>"  (el actor entrega; el "a" recibe)
//   "Asignado ha establecido a <DESTINATARIO>"          (asignacion inicial)
// El actor del encabezado es quien ENTREGA, no quien recibe.
// Palabras que NO son personas (estados/prioridades) y nunca deben tomarse como responsable.
const NON_PERSON = /^(Urgente|Finalizado|Finalizada|Nuevo|Nueva|Normal|Alta|Media|Baja|Pendiente|En\s|Archivad|Resuelt|Respondi|Cerrad|Anulad)/i

function extractDestinatario(block) {
  // Debe ser un cambio de ASIGNACION real (no un cambio de estado/prioridad).
  const cambiado = block.match(/Asignado\s+ha\s+cambiado\s+de\s+[^\n]{2,70}?\s+a\s+([A-ZÁÉÍÓÚÑÜ][^\n(]{3,70})/)
  if (cambiado) { const n = cleanName(cambiado[1]); if (n && !NON_PERSON.test(n)) return n }
  const establecido = block.match(/Asignado\s+ha\s+establecido\s+a\s+([A-ZÁÉÍÓÚÑÜ][^\n(]{3,70})/)
  if (establecido) { const n = cleanName(establecido[1]); if (n && !NON_PERSON.test(n)) return n }
  return ''
}

function normalizeTipo(tipo) {
  return tipo.replace('Reasignacion', 'Reasignación')
    .replace('Documento enviado', 'Documento Enviado')
    .replace('Nueva respuesta', 'Nueva Respuesta')
    .replace('Archivada', 'Archivado')
    .replace('Anulacion', 'Anulación')
    .replace('Delegacion', 'Delegación')
}

function movementTimestamp(date) {
  if (!date) return 0
  const dateTime = date.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/)
  if (dateTime) return new Date(`${dateTime[1]}T${dateTime[2]}`).getTime()
  const dayOnly = date.match(/(\d{4}-\d{2}-\d{2})/)
  return dayOnly ? new Date(`${dayOnly[1]}T23:59`).getTime() : 0
}

// Extrae todos los bloques de movimiento del texto plano de una pagina eGob.
// Encabezado -> fecha/#/tramite/actor (fiables). Destinatario -> del detalle del bloque.
function extractMovements(_issue, text) {
  const headers = [...text.matchAll(HEADER_RE)]
  const events = []
  for (let i = 0; i < headers.length; i += 1) {
    const match = headers[i]
    const start = match.index || 0
    const end = start + match[0].length
    const nextStart = i + 1 < headers.length ? (headers[i + 1].index || text.length) : text.length
    const block = text.slice(end, nextStart)

    const tipo = normalizeTipo(match[1])
    const date = match[6].replace(/\s+/g, ' ').trim()
    // El responsable es el DESTINATARIO del detalle; el actor del encabezado solo entrega.
    const responsable = OWNER_TYPES.has(tipo) ? extractDestinatario(block) : ''
    // Cargo del destinatario: se busca donde aparezca "DESTINATARIO (cargo)" en la pagina.
    const cargo = responsable ? parseRoleForAssignee(text, responsable) : ''

    events.push({
      issue: match[2],
      tipo,
      seq: Number(match[3]),
      actor: cleanName(match[4]),
      responsable,
      cargo,
      date,
      index: start,
      timestamp: movementTimestamp(date),
    })
  }
  return events
}

// Ordena por: fecha-hora, luego numero de secuencia (#), luego orden de aparicion (DOM).
function isNewerMovement(candidate, current) {
  if (!current) return true
  if (candidate.timestamp !== current.timestamp) return candidate.timestamp > current.timestamp
  if (candidate.seq !== current.seq) return candidate.seq > current.seq
  return candidate.index >= current.index
}

function pickLatestMovement(events) {
  return events.reduce((best, event) => (isNewerMovement(event, best) ? event : best), null)
}

// El responsable actual = destinatario del ultimo bloque de Reasignacion (los otros tipos
// -Archivado, Respuesta, etc.- no cambian a quien esta asignado el tramite).
function pickLatestOwner(events) {
  return pickLatestMovement(events.filter((event) => OWNER_TYPES.has(event.tipo) && event.responsable))
}

function formatMovement(event, rootIssue) {
  if (!event) return ''
  const prefix = event.issue && event.issue !== rootIssue ? `Trámite ${event.issue}: ` : ''
  const seq = event.seq ? ` (#${event.seq})` : ''
  const date = event.date ? `${event.date} - ` : ''
  const label = OWNER_TYPES.has(event.tipo) && event.responsable ? `${event.tipo} a ${event.responsable}` : event.tipo
  return `${prefix}${date}${label}${seq}`
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
    responsable_cargo: latestOwner?.cargo || parseRoleForAssignee(text, responsable),
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

  // El estado se toma del tramite donde ocurrio el ultimo movimiento; el cargo, del bloque owner.
  const movementIssue = candidates.find((item) => item.issue === latestMovement?.issue) || rootIssue

  return {
    issue: rootIssue.issue,
    url: rootIssue.url,
    asunto: rootIssue.asunto,
    estado: movementIssue.estado || rootIssue.estado,
    prioridad: rootIssue.prioridad,
    responsable_actual: latestOwner?.responsable || rootIssue.responsable_actual,
    responsable_cargo: latestOwner?.cargo || rootIssue.responsable_cargo,
    ultimo_movimiento: formatMovement(latestMovement, rootIssue.issue) || rootIssue.ultimo_movimiento,
    actualizado_en: movementIssue.actualizado_en || rootIssue.actualizado_en,
    tramites_hijos: [...new Set(candidates.flatMap((item) => item.tramites_hijos || []).filter((item) => item !== rootIssue.issue))],
    tramites_revisados: candidates.map((item) => item.issue),
    sincronizado_en: new Date().toISOString(),
  }
}

async function readRelatedIssues(jar, rootIssue, linkedIssues, visited = new Set([rootIssue])) {
  const MAX_PAGES = 40
  const related = []
  const queue = [...new Set(linkedIssues || [])].filter((item) => item && !visited.has(item))

  while (queue.length && visited.size <= MAX_PAGES) {
    const issue = queue.shift()
    if (!issue || visited.has(issue)) continue
    visited.add(issue)

    const page = await follow(jar, `${EGOB_BASE_URL}/issues/${encodeURIComponent(issue)}`)
    if (page.url.includes('/cas/login') || !page.html.includes(`#${issue}`)) continue

    const parsed = parseIssue(issue, page.html, page.url)
    related.push(parsed)

    for (const child of parsed.tramites_hijos || []) {
      if (!visited.has(child) && !queue.includes(child) && visited.size + queue.length < MAX_PAGES) queue.push(child)
    }
  }

  return related
}

// Abre sesion en eGob y devuelve la pagina raiz del tramite (con su cookie jar).
async function openSession(issue) {
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

  return { jar, page }
}

export async function loginAndReadIssue(issue) {
  const { jar, page } = await openSession(issue)
  const base = parseIssue(issue, page.html, page.url)

  // Fuente primaria: PDF "Hoja de Ruta" (historial COMPLETO de toda la cadena, sin paginacion).
  try {
    const key = apiKeyFrom(page.html)
    const text = await fetchRecorridoText(jar, issue, key)
    const rows = text ? parseHojaDeRuta(text) : []
    if (rows.length) {
      const roster = buildNameRoster(page.html)
      const rec = resolveRecorrido(rows, roster)
      if (rec.responsable) {
        return {
          issue,
          url: base.url,
          asunto: base.asunto,
          estado: base.estado || rec.estado,
          prioridad: base.prioridad,
          responsable_actual: rec.responsable,
          responsable_cargo: parseRoleForAssignee(stripText(page.html), rec.responsable) || base.responsable_cargo,
          ultimo_movimiento: rec.ultimo_movimiento || base.ultimo_movimiento,
          actualizado_en: rec.actualizado_en || base.actualizado_en,
          tramites_hijos: base.tramites_hijos,
          tramites_revisados: [issue],
          fuente: 'recorrido_pdf',
          sincronizado_en: new Date().toISOString(),
        }
      }
    }
  } catch {
    // Si el PDF falla, usa el metodo HTML (cadena madre/hijos) mas abajo.
  }

  const relatedIssues = await readRelatedIssues(jar, issue, base.tramites_hijos)
  return mergeIssueChain(base, relatedIssues)
}

// Diagnostico: devuelve la estructura REAL de eGob (texto aplanado + movimientos extraidos)
// para ajustar el parser contra la realidad. No escribe en ninguna base de datos.
function describePage(issue, html, url) {
  const text = stripText(html)
  const parsed = parseIssue(issue, html, url)
  const movements = extractMovements(issue, text)
  return {
    issue,
    estado: parsed.estado,
    responsable_actual: parsed.responsable_actual,
    ultimo_movimiento: parsed.ultimo_movimiento,
    hijos: parsed.tramites_hijos,
    textLen: text.length,
    movimientos: movements.map((m) => ({ tipo: m.tipo, date: m.date, seq: m.seq, index: m.index, responsable: m.responsable })),
    // Señales para detectar paginacion / cobertura del flujo.
    textLenTotal: text.length,
    numeroMovimientoMax: Math.max(0, ...[...text.matchAll(/#(\d{1,4})(?!\d)/g)].map((mm) => Number(mm[1]))),
    hayPaginacion: /Siguiente|P[aá]gina|›|»|data-page|paginate/i.test(html),
    ultimos3000: text.slice(-3000).replace(/\n/g, ' ⏎ '),
    // Texto del flujo real, para reconstruir la gramatica de los bloques de movimiento.
    flujo: (() => {
      const i = text.search(/Flujo de procesos/i)
      return i < 0 ? '(no aparece)' : text.slice(i, i + 14000).replace(/\n/g, ' ⏎ ')
    })(),
  }
}

// Diagnostico RAW: vuelca pistas del HTML crudo para encontrar el endpoint AJAX
// que carga los movimientos recientes del flujo (eGob los trae por JavaScript).
export async function diagnoseRaw(issue) {
  const { page } = await openSession(issue)
  const html = page.html
  const grab = (re, n = 20, len = 220) => {
    const out = []
    for (const m of html.matchAll(re)) { out.push(m[0].replace(/\s+/g, ' ').slice(0, len)); if (out.length >= n) break }
    return [...new Set(out)]
  }
  return {
    issue,
    htmlLen: html.length,
    scriptsSrc: grab(/<script[^>]*\bsrc=["'][^"']+["']/gi),
    dataUrls: grab(/data-[a-z-]*url=["'][^"']+["']/gi),
    dataAttrs: grab(/data-(remote|method|type|params|issue|id|page|offset|flujo|journal)=["'][^"']*["']/gi),
    ajaxCalls: grab(/(?:url\s*:\s*["'`]|fetch\(\s*["'`]|\.load\(\s*["'`]|\$\.(?:get|post|ajax)\(\s*[{("'`])[^"'`;)\n]{0,180}/gi, 40),
    issueRefs: grab(new RegExp(`["'/][a-z_/.]*${issue}[a-z0-9_/.?=&#-]*`, 'gi'), 30),
    flujoKeywords: grab(/(flujo|journals?|movimiento|timeline|historial|cargar|load[_-]?more|siguiente|paginat|per_page|page=)[^<>"'\n]{0,120}/gi, 40),
  }
}

// eGob es Redmine: prueba varias vias para obtener el historial completo (sin paginacion HTML).
export async function diagnoseJson(issue) {
  const { jar, page } = await openSession(issue)
  const key = page.html.match(/[?&]key=([a-f0-9]{20,})/i)?.[1] || ''
  const k = key ? `key=${key}` : ''
  const results = { issue, keyFound: Boolean(key) }

  const tryUrl = async (label, path) => {
    try {
      const r = await follow(jar, `${EGOB_BASE_URL}${path}`)
      const ct = r.response.headers.get('content-type') || ''
      results[label] = {
        status: r.response.status,
        contentType: ct.slice(0, 60),
        len: r.html.length,
        // muestra util: para atom, las entradas; para json, el inicio
        sample: r.html.replace(/\s+/g, ' ').slice(0, 500),
      }
      return r
    } catch (error) {
      results[label] = { error: String(error.message).slice(0, 120) }
      return null
    }
  }

  await tryUrl('json_plain', `/issues/${issue}.json?${k}`)
  await tryUrl('atom', `/issues/${issue}.atom?${k}`)
  const rec = await tryUrl('recorrido_pdf', `/issues/${issue}/download_recorrido_pdf?${k}`)
  if (rec) results.recorrido_pdf.isPdf = rec.html.slice(0, 5).includes('%PDF')

  // Busca en el HTML de la pagina el endpoint que carga mas movimientos (journals/flujo).
  results.htmlEndpoints = [...page.html.matchAll(/["'](\/issues\/\d+\/[a-z_]+|\/journals?\/[^"']+|[^"']*(?:journal|flujo|recorrido|timeline)[^"']*)["']/gi)]
    .map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 30)

  return results
}

// --- Parser de la "Hoja de Ruta" (PDF de recorrido): historial completo y estructurado ---
// Cada fila: ÁREA · FECHA · ACCIÓN · De · Para · No.días("Fecha límite …") · Comentario.
// Los nombres vienen en orden APELLIDOS NOMBRES (al reves del dashboard) y fragmentados por lineas.

const RUTA_ACCIONES = 'Reasignado|Adjunto|Archivado|Nueva respuesta|Documento enviado|Documento generado|Sumillado|Finalizado|Respondido|Respuesta|Anulado|Restaurado|Informado'

function normalizeRuta(text) {
  return repairMojibake(text)
    .replace(/[\r\n\t]+/g, ' ')
    // une fecha fragmentada "2026- 03-06 09:37" -> "2026-03-06 09:37"
    .replace(/(\d{4})-\s+(\d{2})-(\d{2})\s+(\d{2}:\d{2})/g, '$1-$2-$3 $4')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Extrae filas del recorrido: {date, accion, blob} donde blob = nombres (De [+ Para]).
function parseHojaDeRuta(text) {
  const t = normalizeRuta(text)
  const re = new RegExp(
    `(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2})\\s+(${RUTA_ACCIONES})\\b\\s*` +
    `([\\s\\S]*?)\\s*(?=Fecha\\s+l[ií]mite|\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}\\s+(?:${RUTA_ACCIONES})\\b|$)`,
    'g',
  )
  const rows = []
  for (const m of t.matchAll(re)) {
    rows.push({ date: m[1], accion: m[2], blob: m[3].replace(/\s+/g, ' ').trim(), index: m.index || 0 })
  }
  return rows
}

// Construye un roster de nombres canonicos (orden NOMBRES APELLIDOS, como el dashboard)
// a partir de las listas de usuarios del HTML de eGob (dos formatos disponibles).
function buildNameRoster(pageHtml) {
  const text = repairMojibake(stripText(pageHtml))
  const canonical = new Map() // clave: palabras ordenadas alfabeticamente -> nombre canonico
  const add = (name) => {
    const clean = name.replace(/\s+/g, ' ').trim()
    const words = clean.split(' ').filter((w) => /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ.'-]+$/.test(w))
    if (words.length < 2 || words.length > 6) return
    const keySorted = [...words].sort().join(' ')
    if (!canonical.has(keySorted)) canonical.set(keySorted, clean)
  }
  // Lista "Buscar usuarios de la Institución" (orden NOMBRES APELLIDOS, canonico).
  const dest = text.match(/Buscar usuarios de la Instituci[oó]n\s+([\s\S]{0,4000}?)(?:Destinatarios externos|Con copia|A[ñn]adir destinatarios|-->)/i)?.[1] || ''
  for (const m of dest.matchAll(/[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ.'-]+(?:\s+[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ.'-]+){1,5}/g)) add(m[0])
  return canonical
}

// Reordena "APELLIDO APELLIDO NOMBRE NOMBRE" (PDF) al canonico "NOMBRE NOMBRE APELLIDO APELLIDO",
// usando el roster por conjunto de palabras. Si no hay match, aplica swap de mitades (4 palabras).
function canonicalName(pdfName, roster) {
  const clean = repairMojibake(pdfName).replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const words = clean.split(' ')
  const key = [...words].sort().join(' ')
  if (roster.has(key)) return roster.get(key)
  if (words.length === 4) return `${words[2]} ${words[3]} ${words[0]} ${words[1]}`
  if (words.length === 3) return `${words[2]} ${words[0]} ${words[1]}`
  return clean
}

// Separa el blob "DE PARA" de una reasignacion. El "Para" (nuevo responsable) es el
// sufijo MÁS LARGO que sea un nombre completo conocido (evita truncar apellidos).
function splitDePara(blob, roster, singleNames) {
  const words = blob.split(' ')
  const n = words.length
  const isKnownName = (arr) => {
    const joined = arr.join(' ')
    if (singleNames.has(joined)) return true
    const key = [...arr].sort().join(' ')
    return roster.has(key)
  }
  // Prefiere el sufijo mas largo (nombre completo) que aparezca como nombre conocido.
  for (let paraLen = Math.min(5, n - 1); paraLen >= 2; paraLen -= 1) {
    const para = words.slice(n - paraLen)
    if (isKnownName(para)) return { de: words.slice(0, n - paraLen).join(' '), para: para.join(' ') }
  }
  // Fallback sin roster: los nombres suelen ser de 4 palabras (2 apellidos + 2 nombres).
  if (n >= 8 && n % 2 === 0) return { de: words.slice(0, n / 2).join(' '), para: words.slice(n / 2).join(' ') }
  if (n >= 4) return { de: words.slice(0, n - 4).join(' '), para: words.slice(n - 4).join(' ') }
  return { de: '', para: words.join(' ') }
}

function rutaTimestamp(date) {
  const m = String(date).match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
  return m ? new Date(`${m[1]}T${m[2]}`).getTime() : 0
}

const ACCION_LABEL = {
  Reasignado: 'Reasignación',
  Adjunto: 'Adjunto',
  Archivado: 'Archivado',
  'Nueva respuesta': 'Nueva respuesta',
  'Documento enviado': 'Documento enviado',
  'Documento generado': 'Documento generado',
  Sumillado: 'Sumillado',
  Finalizado: 'Finalizado',
  Respondido: 'Respuesta',
  Respuesta: 'Respuesta',
  Anulado: 'Anulado',
  Restaurado: 'Restaurado',
  Informado: 'Informado',
}

// Resuelve responsable y ultimo movimiento a partir de las filas del recorrido (Hoja de Ruta).
// Responsable = "Para" de la ultima Reasignacion por fecha; ultimo movimiento = ultima fila por fecha.
function resolveRecorrido(rows, roster) {
  // Nombres sueltos (Adjunto/Archivado/etc.) = nombres validos sin ambiguedad -> ayudan a cortar De/Para.
  const singleNames = new Set(
    rows.filter((r) => r.accion !== 'Reasignado').map((r) => r.blob).filter((b) => b.split(' ').length >= 2 && b.split(' ').length <= 6),
  )
  const events = rows.map((row, i) => {
    let para = ''
    if (row.accion === 'Reasignado') {
      const split = splitDePara(row.blob, roster, singleNames)
      para = split.para ? canonicalName(split.para, roster) : ''
    }
    return { ...row, para, ts: rutaTimestamp(row.date), order: i }
  })
  const byDate = [...events].sort((a, b) => a.ts - b.ts || a.order - b.order)
  const lastReassign = [...byDate].reverse().find((e) => e.accion === 'Reasignado' && e.para)
  const lastRow = byDate.at(-1)
  const formatRow = (e) => {
    if (!e) return ''
    const label = e.accion === 'Reasignado' && e.para ? `Reasignación a ${e.para}` : (ACCION_LABEL[e.accion] || e.accion)
    return `${e.date} - ${label}`
  }
  return {
    responsable: lastReassign?.para || '',
    date: lastReassign?.date || '',
    estado: lastRow ? (ACCION_LABEL[lastRow.accion] || lastRow.accion) : '',
    ultimo_movimiento: formatRow(lastRow),
    actualizado_en: lastRow?.date || '',
    reasignaciones: events.filter((e) => e.para).map((e) => ({ date: e.date, para: e.para })),
  }
}

// Obtiene el texto del PDF de "recorrido" (historial COMPLETO del tramite, sin paginacion).
async function fetchRecorridoText(jar, issue, key) {
  const url = `${EGOB_BASE_URL}/issues/${encodeURIComponent(issue)}/download_recorrido_pdf${key ? `?key=${key}` : ''}`
  const { response, buffer } = await followBinary(jar, url)
  if (response.status !== 200 || !buffer || !buffer.slice(0, 5).toString('latin1').includes('%PDF')) return ''
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return repairMojibake(result?.text || '')
}

function apiKeyFrom(html) {
  return html.match(/[?&]key=([a-f0-9]{20,})/i)?.[1] || ''
}

export async function diagnosePdf(issue) {
  const { jar, page } = await openSession(issue)
  const key = apiKeyFrom(page.html)
  const out = { issue, keyFound: Boolean(key) }
  try {
    const text = await fetchRecorridoText(jar, issue, key)
    const roster = buildNameRoster(page.html)
    const rows = parseHojaDeRuta(text)
    const resolved = resolveRecorrido(rows, roster)
    out.textLen = text.length
    out.rosterSize = roster.size
    out.filas = rows.length
    out.reasignaciones = resolved.reasignaciones.length
    out.RESPONSABLE = resolved.responsable
    out.fecha = resolved.date
    out.ultimas6Filas = rows.slice(-6).map((r) => `${r.date} · ${r.accion} · ${r.blob.slice(0, 60)}`)
    out.ultimasReasignaciones = resolved.reasignaciones.slice(-5)
  } catch (error) {
    out.error = String(error?.message || error).slice(0, 200)
  }
  return out
}

export async function diagnoseIssue(issue) {
  const { jar, page } = await openSession(issue)
  const rootDesc = describePage(issue, page.html, page.url)

  const childIds = [...new Set(rootDesc.hijos || [])].slice(0, 8)
  const children = []
  for (const child of childIds) {
    const childPage = await follow(jar, `${EGOB_BASE_URL}/issues/${encodeURIComponent(child)}`)
    if (childPage.url.includes('/cas/login') || !childPage.html.includes(`#${child}`)) continue
    children.push(describePage(child, childPage.html, childPage.url))
  }

  const merged = await loginAndReadIssue(issue)
  return {
    root: rootDesc,
    children,
    RESULTADO_FINAL: {
      responsable_actual: merged.responsable_actual,
      estado: merged.estado,
      ultimo_movimiento: merged.ultimo_movimiento,
      tramites_revisados: merged.tramites_revisados?.length,
    },
  }
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
