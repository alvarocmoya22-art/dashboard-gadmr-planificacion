import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../netlify/functions/egob-sync.mjs'
import { computeEgobUpdate } from '../netlify/functions/egob-sync-all.mjs'

const { parseIssue, mergeIssueChain } = __test__

// --- Constructores de fixtures HTML parecidos a eGob ------------------------
// Cada movimiento renderiza: actor (encabezado) / #secuencia / fecha-hora / cuerpo.
// stripText convierte </td></tr> en saltos de linea, dejando fecha y # antes del cuerpo.
function movementHtml({ actor, seq, date, body }) {
  return [
    `<tr><td>${actor}</td></tr>`,
    `<tr><td>#${seq}</td></tr>`,
    `<tr><td>${date}</td></tr>`,
    `<tr><td>${body}</td></tr>`,
  ].join('\n')
}

function issueHtml({ issue, estado = 'Reasignación', movements = [], links = [] }) {
  return `<html><body>
    <h2>MEMORANDO #${issue}</h2>
    <p>Estado: ${estado} Prioridad: Normal Fecha registro: 2026-07-20</p>
    ${links.map((id) => `<a href="/issues/${id}">ver ${id}</a>`).join('\n')}
    <div class="flujo">
      ${movements.map(movementHtml).join('\n')}
    </div>
  </body></html>`
}

// --- Escenario 1: "Asignado ha cambiado de A a B" -> destinatario B ----------
test('1. Reasignación toma el destinatario tras "a", no el actor del encabezado', () => {
  const html = issueHtml({
    issue: '1213382',
    estado: 'Reasignación',
    movements: [{
      actor: 'JUAN DIEGO REMACHE RIVERA',
      seq: 189,
      date: '2026-07-27 17:45',
      body: 'Asignado ha cambiado de JUAN DIEGO REMACHE RIVERA a MARIA ALEJANDRA BONIFAZ LÓPEZ',
    }],
  })
  const parsed = parseIssue('1213382', html)
  assert.equal(parsed.responsable_actual, 'MARIA ALEJANDRA BONIFAZ LÓPEZ')
  assert.match(parsed.ultimo_movimiento, /Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ/)
  assert.match(parsed.ultimo_movimiento, /#189/)
  assert.doesNotMatch(parsed.responsable_actual, /JUAN DIEGO/)
})

// --- Escenario 2: "Documento enviado a PERSONA" -> PERSONA -------------------
test('2. Documento enviado toma al destinatario', () => {
  const html = issueHtml({
    issue: '1013958',
    estado: 'Nuevo',
    movements: [{
      actor: 'ANA GOMEZ SALAS',
      seq: 12,
      date: '2026-07-01 09:00',
      body: 'Documento enviado a JUAN DIEGO REMACHE RIVERA',
    }],
  })
  const parsed = parseIssue('1013958', html)
  assert.equal(parsed.responsable_actual, 'JUAN DIEGO REMACHE RIVERA')
  assert.match(parsed.ultimo_movimiento, /Documento enviado a JUAN DIEGO REMACHE RIVERA/)
})

// --- Escenario 3: misma fecha, distinto # -> gana el # mayor -----------------
test('3. Con igual fecha, escoge el número de movimiento mayor', () => {
  const html = issueHtml({
    issue: '900001',
    movements: [
      { actor: 'X', seq: 150, date: '2026-07-27 10:00', body: 'Asignado ha cambiado de X a PEDRO PEREZ MORA' },
      { actor: 'Y', seq: 189, date: '2026-07-27 10:00', body: 'Asignado ha cambiado de Y a LUISA TORRES VACA' },
    ],
  })
  const parsed = parseIssue('900001', html)
  assert.equal(parsed.responsable_actual, 'LUISA TORRES VACA')
  assert.match(parsed.ultimo_movimiento, /#189/)
})

// --- Escenario 4: madre con varios hijos -> último de toda la cadena ---------
test('4. Cadena madre/hijos escoge el movimiento cronológico más reciente', () => {
  const rootHtml = issueHtml({
    issue: '914830',
    estado: 'En trámite',
    links: ['1213382', '1100000'],
    movements: [{
      actor: 'SECRETARIA GENERAL',
      seq: 20,
      date: '2026-07-10 08:00',
      body: 'Documento enviado a JUAN DIEGO REMACHE RIVERA',
    }],
  })
  const childNew = issueHtml({
    issue: '1213382',
    estado: 'Reasignación',
    movements: [{
      actor: 'JUAN DIEGO REMACHE RIVERA',
      seq: 189,
      date: '2026-07-27 17:45',
      body: 'Asignado ha cambiado de JUAN DIEGO REMACHE RIVERA a MARIA ALEJANDRA BONIFAZ LÓPEZ',
    }],
  })
  const childOld = issueHtml({
    issue: '1100000',
    estado: 'Nuevo',
    movements: [{
      actor: 'MESA DE PARTES',
      seq: 5,
      date: '2026-07-25 12:00',
      body: 'Documento enviado a CARLOS RUIZ',
    }],
  })

  const root = parseIssue('914830', rootHtml)
  const c1 = parseIssue('1213382', childNew)
  const c2 = parseIssue('1100000', childOld)
  const merged = mergeIssueChain(root, [c1, c2])

  assert.equal(merged.responsable_actual, 'MARIA ALEJANDRA BONIFAZ LÓPEZ')
  assert.match(merged.ultimo_movimiento, /^Trámite 1213382:/)
  assert.match(merged.ultimo_movimiento, /2026-07-27 17:45/)
  assert.deepEqual(merged.tramites_revisados.sort(), ['1100000', '1213382', '914830'])
})

// --- Escenario 5: movimiento nuevo -> una sola notificación ------------------
test('5. Un movimiento nuevo genera exactamente una notificación', () => {
  const process = {
    egob_numero: '914830',
    egob_responsable_actual: 'JUAN DIEGO REMACHE RIVERA',
    egob_ultimo_movimiento: 'Trámite 914830: 2026-07-10 08:00 - Documento enviado a JUAN DIEGO REMACHE RIVERA (#20)',
    egob_estado: 'En trámite',
  }
  const egob = {
    issue: '914830',
    responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    ultimo_movimiento: 'Trámite 1213382: 2026-07-27 17:45 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ (#189)',
    estado: 'Reasignación',
    responsable_cargo: '',
  }
  const result = computeEgobUpdate(process, egob, '2026-08-13T12:00:00.000Z')
  assert.ok(result, 'debe detectar cambios')
  assert.equal(result.changes.length, 1, 'una sola notificación por movimiento')
  assert.equal(result.changes[0].campo, 'egob_ultimo_movimiento')
  assert.equal(result.payload.egob_responsable_actual, 'MARIA ALEJANDRA BONIFAZ LÓPEZ')
  assert.equal(result.payload.egob_sincronizado_en, '2026-08-13T12:00:00.000Z')
})

// --- Escenario 6: segunda sincronización sin cambios -> sin duplicados -------
test('6. Segunda sincronización sin cambios no genera notificaciones', () => {
  const process = {
    egob_numero: '914830',
    egob_url: 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/914830',
    egob_responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    egob_responsable_cargo: '',
    egob_ultimo_movimiento: 'Trámite 1213382: 2026-07-27 17:45 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ (#189)',
    egob_estado: 'Reasignación',
  }
  const egob = {
    issue: '914830',
    url: 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/914830',
    responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    responsable_cargo: '',
    ultimo_movimiento: 'Trámite 1213382: 2026-07-27 17:45 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ (#189)',
    estado: 'Reasignación',
  }
  const result = computeEgobUpdate(process, egob)
  assert.equal(result, null, 'sin cambios -> null -> no update, no notificación')
})

// --- Extra: no sobrescribir un dato válido con vacío (requisito 7) -----------
test('7. No borra un responsable válido con un valor vacío', () => {
  const process = {
    egob_numero: '914830',
    egob_responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    egob_ultimo_movimiento: '2026-07-27 17:45 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ (#189)',
    egob_estado: 'Reasignación',
    egob_url: 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/914830',
  }
  const egob = { issue: '914830', responsable_actual: '', ultimo_movimiento: '', estado: '' }
  const result = computeEgobUpdate(process, egob)
  assert.equal(result, null, 'no debe proponer cambios que borren datos válidos')
})
