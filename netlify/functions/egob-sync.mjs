import http from 'node:http'
import https from 'node:https'

const EGOB_BASE_URL = process.env.EGOB_BASE_URL || 'https://egobedoc.gadmriobamba.gob.ec:8081'
const EGOB_LOGIN_URL = process.env.EGOB_LOGIN_URL || 'https://egob.gadmriobamba.gob.ec:8443/cas/login'
const REJECT_UNAUTHORIZED = process.env.EGOB_TLS_REJECT_UNAUTHORIZED === 'true'

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

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

function repairMojibake(value = '') {
  return String(value)
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
}

function stripText(html) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|tr|h1|h2|h3|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function matchBetween(text, start, end) {
  const pattern = new RegExp(`${start}([\\s\\S]*?)${end}`, 'i')
  return text.match(pattern)?.[1]?.replace(/\s+/g, ' ').trim() || ''
}

function parseCurrentAssignee(text) {
  const block = matchBetween(text, 'Reasignado/s:', 'Estado:')
  if (!block) return ''
  const reassigned = block.match(/([A-ZÁÉÍÓÚÑ ]{6,}?)\s*\([^)]*\)\s*\(\s*Reasignado\s*\)/i)
  if (reassigned) return reassigned[1].replace(/\s+/g, ' ').trim()
  const archivedRemoved = block.replace(/\([^)]*Archivado[^)]*\)/gi, '')
  const names = archivedRemoved.match(/[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){2,}/g)
  return names?.at(-1)?.trim() || ''
}

function parseLatestAttachment(text) {
  const block = matchBetween(text, 'Adjuntos subidos posterior al envío / Expediente', 'Flujo de procesos') || ''
  const match = block.match(/([A-ZÁÉÍÓÚÑ0-9_.\- ]+\.(?:pdf|png|jpg|jpeg|rar|zip|docx?))\s*\([^)]+\)[\s\S]*?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+[AP]M)/i)
  return match ? `${match[2]} - ${match[1].replace(/\s+/g, ' ').trim()}` : ''
}

function parseLatestReassignment(text) {
  const pattern = /Reasignaci[oó?]n[\s\S]{0,500}?\(\s*(\d+)\s*\)[\s\S]{0,500}?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})[\s\S]{0,700}?Asignado ha cambiado de\s+(.+?)\s+a\s+(.+?)(?:\n|$)/gi
  const matches = [...text.matchAll(pattern)]
  const latest = matches.at(-1)
  if (!latest) return null
  const to = latest[4].replace(/\s+/g, ' ').trim()
  const date = latest[2].replace(/\s+/g, ' ').trim()
  return {
    responsable_actual: to,
    ultimo_movimiento: `${date} - Reasignación a ${to}`,
  }
}

function parseLatestReassignmentFromBlocks(text) {
  const blocks = text
    .split(/\n(?=Reasignaci[oó?]n\b)/i)
    .filter((block) => /Reasignaci[oó?]n/i.test(block) && /Asignado ha cambiado de/i.test(block))

  const latest = blocks.at(-1)
  if (!latest) return null

  const date = latest.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/)?.[1]?.replace(/\s+/g, ' ').trim() || ''
  const assignment = latest.match(/Asignado ha cambiado de\s+(.+?)\s+a\s+([^\n]+)/i)
  if (!assignment) return null

  const to = assignment[2].replace(/\s+/g, ' ').trim()
  return {
    responsable_actual: to,
    ultimo_movimiento: `${date} - Reasignación a ${to}`,
  }
}

function parseIssue(issue, html, finalUrl) {
  const text = stripText(html)
  const estado = text.match(/Estado:\s*([^\n]+?)\s*Prioridad:/i)?.[1]?.trim() || ''
  const prioridad = text.match(/Prioridad:\s*([^\n]+?)\s*Fecha registro:/i)?.[1]?.trim() || ''
  const actualizado = text.match(/Actualizado el\s+(.+?)\s*\./i)?.[1]?.trim() || ''
  const asunto = text.match(/Asunto:\s*(.+?)\s*Creado por/i)?.[1]?.trim() || ''
  const latestReassignment = parseLatestReassignmentFromBlocks(text) || parseLatestReassignment(text)
  const responsableActual = latestReassignment?.responsable_actual || parseCurrentAssignee(text)
  const latestAttachment = parseLatestAttachment(text)
  const children = [...html.matchAll(/href=["']\/issues\/(\d+)["']/g)].map((item) => item[1]).filter((value, index, array) => array.indexOf(value) === index && value !== issue)

  return {
    issue,
    url: finalUrl || `${EGOB_BASE_URL}/issues/${issue}`,
    asunto,
    estado,
    prioridad,
    responsable_actual: responsableActual,
    ultimo_movimiento: latestReassignment?.ultimo_movimiento || latestAttachment || (actualizado ? `Actualizado el ${actualizado}` : ''),
    actualizado_en: actualizado,
    tramites_hijos: children,
    sincronizado_en: new Date().toISOString(),
  }
}

function movementTime(issueData) {
  const raw = issueData?.ultimo_movimiento || issueData?.actualizado_en || ''
  const match = String(raw).match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/)
  return match ? new Date(match[1].replace(' ', 'T')).getTime() : 0
}

function withIssuePrefix(issueData) {
  if (!issueData?.ultimo_movimiento) return issueData
  return {
    ...issueData,
    ultimo_movimiento: `Trámite ${issueData.issue}: ${issueData.ultimo_movimiento}`,
  }
}

function mergeIssueChain(rootIssue, relatedIssues) {
  const candidates = [rootIssue, ...relatedIssues].filter(Boolean)
  const latest = candidates.reduce((best, item) => (movementTime(item) > movementTime(best) ? item : best), rootIssue)

  return {
    ...rootIssue,
    estado: latest.estado || rootIssue.estado,
    responsable_actual: latest.responsable_actual || rootIssue.responsable_actual,
    ultimo_movimiento: latest.issue === rootIssue.issue
      ? latest.ultimo_movimiento
      : withIssuePrefix(latest).ultimo_movimiento,
    actualizado_en: latest.actualizado_en || rootIssue.actualizado_en,
    tramites_hijos: [...new Set(candidates.flatMap((item) => item.tramites_hijos || []).filter((item) => item !== rootIssue.issue))],
    tramites_revisados: candidates.map((item) => item.issue),
  }
}

async function readRelatedIssues(jar, rootIssue, linkedIssues, visited = new Set([rootIssue])) {
  const related = []
  const queue = [...new Set(linkedIssues || [])].filter((item) => item && !visited.has(item)).slice(0, 10)

  while (queue.length) {
    const issue = queue.shift()
    if (!issue || visited.has(issue)) continue
    visited.add(issue)

    const page = await follow(jar, `${EGOB_BASE_URL}/issues/${encodeURIComponent(issue)}`)
    if (page.url.includes('/cas/login') || !page.html.includes(`#${issue}`)) continue

    const parsed = parseIssue(issue, page.html, page.url)
    related.push(parsed)

    for (const child of parsed.tramites_hijos || []) {
      if (!visited.has(child) && queue.length < 10) queue.push(child)
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
