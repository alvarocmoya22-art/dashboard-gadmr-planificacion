import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../netlify/functions/egob-sync.mjs'
import { computeEgobUpdate } from '../netlify/functions/egob-sync-all.mjs'

const { parseIssue, mergeIssueChain, extractMovements, stripText } = __test__

// --- Fixtures con la estructura REAL del "Flujo de procesos" de eGob ---------
// Cada bloque de movimiento: TIPO ( tramite ) #seq  ACTOR (cargo)  FECHA HORA.
// El ACTOR del encabezado es la persona a la que quedó asignado el tramite.
function blockHtml({ tipo = 'Reasignación', issue, seq, actor, cargo = 'FUNCIONARIO', date }) {
  return [
    `<tr><td>${tipo}</td></tr>`,
    `<tr><td>( ${issue} )</td></tr>`,
    `<tr><td>#${seq}</td></tr>`,
    `<tr><td>${actor}</td></tr>`,
    `<tr><td>(${cargo})</td></tr>`,
    `<tr><td>${date}</td></tr>`,
    `<tr><td>Nota: detalle del movimiento</td></tr>`,
  ].join('\n')
}

// Barra lateral que aparece en TODAS las paginas eGob (usuario logueado + menus).
// El parser debe ignorarla por completo.
const SIDEBAR = `<div class="side">
  Documentos Trámites Compartidos Copias Enviados Archivados Reasignados Cerrados Inicio
  MB MARIA ALEJANDRA BONIFAZ LÓPEZ maria.bonifaz@gadmriobamba.gob.ec
  DIRECCIÓN GENERAL DE GESTIÓN DE PLANIFICACIÓN, HABITAT Y DESARROLLO URBANÍSTICO
</div>`

function issueHtml({ issue, estado = 'Nuevo', blocks = [], links = [] }) {
  return `<html><body>
    ${SIDEBAR}
    <h2>MEMORANDO #${issue}</h2>
    <p>Estado: ${estado} Prioridad: Normal Fecha registro: 2026-07-20</p>
    ${links.map((id) => `<a href="/issues/${id}">ver ${id}</a>`).join('\n')}
    <div class="flujo"><h3>Flujo de procesos</h3>
      ${blocks.map(blockHtml).join('\n')}
    </div>
  </body></html>`
}

// --- 1. Reasignación: responsable = actor del bloque (caso real 914830/1213382)
test('1. Reasignación toma el actor del bloque como responsable', () => {
  const html = issueHtml({
    issue: '1213382',
    estado: 'Nuevo',
    blocks: [{ issue: '1213382', seq: 3, actor: 'MARIA ALEJANDRA BONIFAZ LÓPEZ', cargo: 'Jefe de Habilitación de Suelo y Edificación', date: '2026-07-27 17:45' }],
  })
  const parsed = parseIssue('1213382', html)
  assert.equal(parsed.responsable_actual, 'MARIA ALEJANDRA BONIFAZ LÓPEZ')
  assert.match(parsed.ultimo_movimiento, /Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ/)
  assert.match(parsed.responsable_cargo, /Habilitación de Suelo/)
})

// --- 2. La barra lateral y el usuario logueado NO se cuelan como movimiento ---
test('2. Ignora el menú lateral y el usuario logueado (no genera falsos movimientos)', () => {
  const soloSidebar = `<html><body>${SIDEBAR}<h2>MEMORANDO #999</h2></body></html>`
  const movs = extractMovements('999', stripText(soloSidebar))
  assert.equal(movs.length, 0, 'la barra lateral no debe producir movimientos')
})

// --- 3. Varias reasignaciones: gana la de fecha más reciente --------------------
test('3. Con varias reasignaciones escoge la de fecha más reciente', () => {
  const html = issueHtml({
    issue: '900001',
    blocks: [
      { issue: '900001', seq: 2, actor: 'PEDRO PEREZ MORA', date: '2026-03-01 09:00' },
      { issue: '900001', seq: 8, actor: 'LUISA TORRES VACA', date: '2026-07-15 14:30' },
      { issue: '900001', seq: 5, actor: 'ANA GOMEZ SALAS', date: '2026-05-10 11:00' },
    ],
  })
  const parsed = parseIssue('900001', html)
  assert.equal(parsed.responsable_actual, 'LUISA TORRES VACA')
})

// --- 4. Misma fecha, distinto # -> gana el # mayor -----------------------------
test('4. Con igual fecha-hora, escoge el número de movimiento mayor', () => {
  const html = issueHtml({
    issue: '900002',
    blocks: [
      { issue: '900002', seq: 12, actor: 'CARLOS RUIZ LEON', date: '2026-07-20 10:00' },
      { issue: '900002', seq: 25, actor: 'DIANA MORA PAZ', date: '2026-07-20 10:00' },
    ],
  })
  const parsed = parseIssue('900002', html)
  assert.equal(parsed.responsable_actual, 'DIANA MORA PAZ')
  assert.match(parsed.ultimo_movimiento, /#25/)
})

// --- 5. Cadena madre/hijos: último de toda la cadena; Archivado no cambia dueño -
test('5. Cadena madre/hijos: responsable del último Reasignación; Archivado no lo cambia', () => {
  const root = parseIssue('914830', issueHtml({
    issue: '914830', estado: 'En trámite', links: ['1213382', '1100000'],
    blocks: [{ issue: '914830', seq: 8, actor: 'JUAN DIEGO REMACHE RIVERA', date: '2025-04-25 18:00' }],
  }))
  const child1 = parseIssue('1213382', issueHtml({
    issue: '1213382',
    blocks: [{ issue: '1213382', seq: 3, actor: 'MARIA ALEJANDRA BONIFAZ LÓPEZ', date: '2026-07-27 17:45' }],
  }))
  // Hijo con un Archivado posterior: NO debe cambiar el responsable.
  const child2 = parseIssue('1100000', issueHtml({
    issue: '1100000',
    blocks: [{ tipo: 'Archivado', issue: '1100000', seq: 9, actor: 'BODEGA GENERAL', date: '2026-07-30 08:00' }],
  }))
  const merged = mergeIssueChain(root, [child1, child2])
  assert.equal(merged.responsable_actual, 'MARIA ALEJANDRA BONIFAZ LÓPEZ')
  assert.match(merged.ultimo_movimiento, /^Trámite 1100000: .*Archivado/)
  assert.deepEqual(merged.tramites_revisados.sort(), ['1100000', '1213382', '914830'])
})

// --- 6. computeEgobUpdate: un movimiento nuevo = una sola notificación ----------
test('6. Un movimiento nuevo genera exactamente una notificación', () => {
  const process = {
    egob_numero: '914830',
    egob_responsable_actual: 'JUAN DIEGO REMACHE RIVERA',
    egob_ultimo_movimiento: 'Trámite 914830: 2025-04-25 18:00 - Reasignación a JUAN DIEGO REMACHE RIVERA (#8)',
    egob_estado: 'En trámite',
  }
  const egob = {
    issue: '914830',
    responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    ultimo_movimiento: 'Trámite 1213382: 2026-07-27 17:45 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ (#3)',
    estado: 'Nuevo',
    responsable_cargo: 'Jefe de Habilitación de Suelo y Edificación',
  }
  const result = computeEgobUpdate(process, egob, '2026-08-13T12:00:00.000Z')
  assert.ok(result)
  assert.equal(result.changes.length, 1)
  assert.equal(result.changes[0].campo, 'egob_ultimo_movimiento')
  assert.equal(result.payload.egob_responsable_actual, 'MARIA ALEJANDRA BONIFAZ LÓPEZ')
})

// --- 7. Segunda sincronización sin cambios -> sin duplicados --------------------
test('7. Segunda sincronización sin cambios no genera notificaciones', () => {
  const same = {
    egob_numero: '914830',
    egob_url: 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/914830',
    egob_responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    egob_responsable_cargo: 'Jefe de Habilitación de Suelo y Edificación',
    egob_ultimo_movimiento: 'Trámite 1213382: 2026-07-27 17:45 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ (#3)',
    egob_estado: 'Nuevo',
  }
  const egob = {
    issue: '914830',
    url: same.egob_url,
    responsable_actual: same.egob_responsable_actual,
    responsable_cargo: same.egob_responsable_cargo,
    ultimo_movimiento: same.egob_ultimo_movimiento,
    estado: same.egob_estado,
  }
  assert.equal(computeEgobUpdate(same, egob), null)
})

// --- 8. No borra un responsable válido con vacío (requisito 7) ------------------
test('8. No borra un responsable válido con un valor vacío', () => {
  const process = {
    egob_numero: '914830',
    egob_responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    egob_ultimo_movimiento: '2026-07-27 17:45 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ (#3)',
    egob_estado: 'Nuevo',
    egob_url: 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/914830',
  }
  const egob = { issue: '914830', responsable_actual: '', ultimo_movimiento: '', estado: '' }
  assert.equal(computeEgobUpdate(process, egob), null)
})
