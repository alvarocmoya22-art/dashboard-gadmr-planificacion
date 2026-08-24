import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../netlify/functions/egob-sync.mjs'
import { computeEgobUpdate } from '../netlify/functions/egob-sync-all.mjs'

const { parseIssue, mergeIssueChain, extractMovements, stripText, canonicalName, parseParents, extractCargoDirectory, lookupCargo, nameKey } = __test__

// --- Reordenamiento de nombres del PDF (apellidos primero -> nombres primero) ---------
test('0. canonicalName reordena apellidos->nombres (incluye apellidos compuestos)', () => {
  const cases = [
    ['OLEAS BAQUERO CARLOS IGNACIO', 'CARLOS IGNACIO OLEAS BAQUERO'],
    ['SUBIA ANDRADE NATALIA ELIZABETH', 'NATALIA ELIZABETH SUBIA ANDRADE'],
    ['DEL POZO SIERRA LUIS ENRIQUE', 'LUIS ENRIQUE DEL POZO SIERRA'],
    ['DE LA TORRE PONCE ANA MARIA', 'ANA MARIA DE LA TORRE PONCE'],
    ['MAZON BONILLA MARISOL PAULINA', 'MARISOL PAULINA MAZON BONILLA'],
  ]
  for (const [input, expected] of cases) assert.equal(canonicalName(input, null), expected)
})

// --- Fixtures con la estructura REAL del "Flujo de procesos" de eGob ---------
// Cada bloque: TIPO ( tramite ) #seq  ACTOR (cargo)  FECHA  Nota  "Asignado ha cambiado de ACTOR a DESTINO".
// El ACTOR entrega el tramite; el DESTINO (tras "a") es el nuevo responsable.
function blockHtml({ tipo = 'Reasignación', issue, seq, actor = 'JOHN HENRY VINUEZA SALINAS', destino, cargo = 'FUNCIONARIO', date }) {
  const rows = [
    `<tr><td>${tipo}</td></tr>`,
    `<tr><td>( ${issue} )</td></tr>`,
    `<tr><td>#${seq}</td></tr>`,
    `<tr><td>${actor}</td></tr>`,
    `<tr><td>(${cargo})</td></tr>`,
    `<tr><td>${date}</td></tr>`,
    `<tr><td>Nota: detalle del movimiento</td></tr>`,
  ]
  if (destino && tipo === 'Reasignación') rows.push(`<tr><td>Asignado ha cambiado de ${actor} a ${destino}</td></tr>`)
  return rows.join('\n')
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

// --- 1. Reasignación: responsable = DESTINATARIO tras "a" (caso real 914830/1213382)
test('1. Reasignación toma el destinatario ("a"), no el actor que entrega', () => {
  const html = issueHtml({
    issue: '1213382',
    estado: 'Nuevo',
    blocks: [{ issue: '1213382', seq: 3, actor: 'JUAN DIEGO REMACHE RIVERA', destino: 'MARIA ALEJANDRA BONIFAZ LÓPEZ', date: '2026-07-27 17:45' }],
  })
  const parsed = parseIssue('1213382', html)
  assert.equal(parsed.responsable_actual, 'MARIA ALEJANDRA BONIFAZ LÓPEZ')
  assert.match(parsed.ultimo_movimiento, /Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ/)
  assert.doesNotMatch(parsed.responsable_actual, /JUAN DIEGO/)
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
      { issue: '900001', seq: 2, actor: 'JOHN HENRY VINUEZA SALINAS', destino: 'PEDRO PEREZ MORA', date: '2026-03-01 09:00' },
      { issue: '900001', seq: 8, actor: 'PEDRO PEREZ MORA', destino: 'LUISA TORRES VACA', date: '2026-07-15 14:30' },
      { issue: '900001', seq: 5, actor: 'PEDRO PEREZ MORA', destino: 'ANA GOMEZ SALAS', date: '2026-05-10 11:00' },
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
      { issue: '900002', seq: 12, actor: 'JOHN HENRY VINUEZA SALINAS', destino: 'CARLOS RUIZ LEON', date: '2026-07-20 10:00' },
      { issue: '900002', seq: 25, actor: 'CARLOS RUIZ LEON', destino: 'DIANA MORA PAZ', date: '2026-07-20 10:00' },
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
    blocks: [{ issue: '914830', seq: 8, actor: 'JOHN HENRY VINUEZA SALINAS', destino: 'JUAN DIEGO REMACHE RIVERA', date: '2025-04-25 18:00' }],
  }))
  const child1 = parseIssue('1213382', issueHtml({
    issue: '1213382',
    blocks: [{ issue: '1213382', seq: 3, actor: 'JUAN DIEGO REMACHE RIVERA', destino: 'MARIA ALEJANDRA BONIFAZ LÓPEZ', date: '2026-07-27 17:45' }],
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

// --- Trámite madre (Tarea padre en eGob/Redmine) -------------------------------------
test('9. parseParents extrae la madre (parent/root) y excluye el propio trámite', () => {
  // Un hijo: parent_issue_id y root_id apuntan a la madre 1013958.
  const hijo = 'author_id: author_id, parent_issue_id: "1013958", parent_id: 1013958, root_id: 1013958, lft: 4'
  assert.deepEqual(parseParents(hijo, '1049194'), ['1013958'])

  // La propia madre: sin padre; root_id es ella misma -> lista vacía (no se muestra a sí misma).
  const madre = 'parent_issue_id: "", parent_id: nil, root_id: 1013958, lft: 1'
  assert.deepEqual(parseParents(madre, '1013958'), [])
})

test('10. computeEgobUpdate persiste egob_tramites_madre cuando cambia', () => {
  const process = { egob_numero: '1049194', egob_tramites_madre: [] }
  const egob = { issue: '1049194', tramites_madre: ['1013958'] }
  const result = computeEgobUpdate(process, egob)
  assert.deepEqual(result.payload.egob_tramites_madre, ['1013958'])
})

test('11. Al cambiar el responsable sin cargo nuevo, limpia el cargo del anterior', () => {
  const process = {
    egob_numero: '934149',
    egob_responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    egob_responsable_cargo: 'Jefe de Habilitación de Suelo y Edificación',
  }
  const egob = { issue: '934149', responsable_actual: 'DANIELA MARINA GARCIA PAREDES', responsable_cargo: '' }
  const result = computeEgobUpdate(process, egob)
  assert.equal(result.payload.egob_responsable_actual, 'DANIELA MARINA GARCIA PAREDES')
  assert.equal(result.payload.egob_responsable_cargo, null) // cargo huerfano limpiado
})

test('12. Mismo responsable sin cargo nuevo: conserva el cargo (fallo transitorio)', () => {
  const process = {
    egob_numero: '934149',
    egob_url: 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/934149',
    egob_responsable_actual: 'DANIELA MARINA GARCIA PAREDES',
    egob_responsable_cargo: 'Jefe de Habilitación de Suelo y Edificación',
    egob_ultimo_movimiento: '2026-08-21 19:07 - Archivado',
  }
  const egob = {
    issue: '934149',
    url: 'https://egobedoc.gadmriobamba.gob.ec:8081/issues/934149',
    responsable_actual: 'DANIELA MARINA GARCIA PAREDES',
    responsable_cargo: '',
    ultimo_movimiento: '2026-08-21 19:07 - Archivado',
  }
  const result = computeEgobUpdate(process, egob)
  assert.equal(result, null) // sin cambios: no toca el cargo
})

// --- Directorio de cargos (NOMBRE (CARGO) de watchers/destinatarios) -----------------
test('13. extractCargoDirectory saca NOMBRE (CARGO) de watchers, /users, <option> y <b>', () => {
  const html = `
    <select><option value="3475">GARCIA PAREDES DANIELA MARINA - AYUDANTE DE GESTION DE PLANIFICACION, HABITAT Y DESARROLLO URBANISTICO 3</option>
    <option value="0">ODONTOLOGO</option></select>
    <ul class="watchers">
      <li class="user-1735">RAUL GUSTAVO ARRIETA AGUAGALLO (AYUDANTE 3 DE SECRETARIA GENERAL) </li>
      <li class="user-3475"><b style='font-weight: 1000;'>DANIELA MARINA GARCIA PAREDES (AYUDANTE DE GESTION DE PLANIFICACION, HABITAT Y DESARROLLO URBANISTICO 3)</b> ( Archivado )</li>
      <li class="user-9">123 456 (999)</li>
    </ul>
    <a class="user active" href="/users/4528">MARCELO ISAIAS BASTIDAS PASMAY</a> (AYUDANTE DE DESARROLLO ECONOMICO Y TURISMO)`
  const dir = extractCargoDirectory(html)
  const map = Object.fromEntries(dir.map((d) => [d.nombre, d.cargo]))
  assert.equal(map['RAUL GUSTAVO ARRIETA AGUAGALLO'], 'AYUDANTE 3 DE SECRETARIA GENERAL')
  assert.equal(map['MARCELO ISAIAS BASTIDAS PASMAY'], 'AYUDANTE DE DESARROLLO ECONOMICO Y TURISMO')
  // El <option> del selector institucional (NOMBRE - CARGO) y el <b> del watcher.
  assert.equal(lookupCargo(dir, 'DANIELA MARINA GARCIA PAREDES'), 'AYUDANTE DE GESTION DE PLANIFICACION, HABITAT Y DESARROLLO URBANISTICO 3')
  assert.ok(!('123 456' in map)) // descarta cargos numéricos / nombres inválidos
})

test('14. nameKey casa aunque cambie el orden y los acentos; lookupCargo lo usa', () => {
  assert.equal(nameKey('GARCÍA PAREDES DANIELA MARINA'), nameKey('Daniela Marina Garcia Paredes'))
  const dir = [{ nombre: 'DANIELA MARINA GARCIA PAREDES', cargo: 'AYUDANTE DE GESTION 3' }]
  assert.equal(lookupCargo(dir, 'GARCIA PAREDES DANIELA MARINA'), 'AYUDANTE DE GESTION 3')
  assert.equal(lookupCargo(dir, 'OTRA PERSONA DISTINTA'), '')
})
