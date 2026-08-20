import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// Trámites activos con su tipo/área/estado (igual que el KPI del dashboard, que agrupa por nombre).
const { data: procs, error } = await supabase
  .from('processes')
  .select('id, tipo:process_types(nombre,activo), area:areas(nombre,activo), estado:process_statuses(nombre,activo)')
  .eq('activo', true)
if (error) { console.error(error); process.exit(1) }

function countBy(rows, field) {
  const map = new Map()
  for (const r of rows) {
    const c = r[field]
    const nombre = c?.nombre ?? '(sin)'
    const activo = c?.activo
    const key = `${nombre}${activo === false ? '  [tipo/área INACTIVO]' : ''}`
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

console.log(`TRÁMITES ACTIVOS: ${procs.length}\n`)
console.log('=== POR TIPO (como el KPI) ===')
for (const [k, n] of countBy(procs, 'tipo')) console.log(`  ${n}  ${k}`)
console.log('\n=== POR ÁREA ===')
for (const [k, n] of countBy(procs, 'area')) console.log(`  ${n}  ${k}`)
console.log('\n=== POR ESTADO ===')
for (const [k, n] of countBy(procs, 'estado')) console.log(`  ${n}  ${k}`)
