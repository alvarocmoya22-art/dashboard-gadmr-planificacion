import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: areas } = await supabase.from('areas').select('nombre').eq('activo', true).order('nombre')
console.log(`=== ÁREAS ACTIVAS (${areas?.length ?? 0}) ===`)
for (const a of areas ?? []) console.log('  -', a.nombre)

const { data: tipos } = await supabase.from('process_types').select('nombre').eq('activo', true).order('nombre')
console.log(`\n=== TIPOS DE TRÁMITE ACTIVOS (${tipos?.length ?? 0}) ===`)
for (const t of tipos ?? []) console.log('  -', t.nombre)

const { data: estados } = await supabase.from('process_statuses').select('nombre').eq('activo', true).order('orden')
console.log(`\n=== ESTADOS ACTIVOS (${estados?.length ?? 0}) ===`)
for (const s of estados ?? []) console.log('  -', s.nombre)
