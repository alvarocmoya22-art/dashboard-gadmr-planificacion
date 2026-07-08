import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { areas as demoAreas, demoProcesses, priorities as demoPriorities, processTypes as demoTypes, statuses as demoStatuses } from '../data/tramites'
import { deriveProcess, uid } from '../lib/utils'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { CatalogItem, ChangeLog, Process, ProcessFormData, Role } from '../types'

interface AppState {
  processes: Process[]
  areas: CatalogItem[]
  processTypes: CatalogItem[]
  statuses: CatalogItem[]
  priorities: CatalogItem[]
  logs: ChangeLog[]
  loading: boolean
  demoMode: boolean
  role: Role
  userName: string
  userEmail: string
  userAreaName: string
  canAccessManagement: boolean
  saveProcess: (data: ProcessFormData, current?: Process) => Promise<void>
  deleteProcess: (id: string) => Promise<void>
  importProcesses: (rows: ProcessFormData[]) => Promise<number>
  addCatalogItem: (kind: 'areas' | 'processTypes' | 'statuses' | 'priorities', name: string) => void
}

const AppContext = createContext<AppState | null>(null)
const storageKey = 'tramites-varios-processes-v1'

function hydrate(process: Process, areas: CatalogItem[], types: CatalogItem[], statuses: CatalogItem[], priorities: CatalogItem[]) {
  return deriveProcess({
    ...process,
    area: areas.find((item) => item.id === process.area_id),
    tipo: types.find((item) => item.id === process.tipo_proceso_id),
    estado: statuses.find((item) => item.id === process.estado_id),
    prioridad: priorities.find((item) => item.id === process.prioridad_id),
  })
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [processes, setProcesses] = useState<Process[]>([])
  const [areas, setAreas] = useState(demoAreas)
  const [processTypes, setProcessTypes] = useState(demoTypes)
  const [statuses, setStatuses] = useState(demoStatuses)
  const [priorities, setPriorities] = useState(demoPriorities)
  const [logs, setLogs] = useState<ChangeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>('admin')
  const [userName, setUserName] = useState(isSupabaseConfigured ? 'Usuario institucional' : 'Administrador demo')
  const [userEmail, setUserEmail] = useState('')
  const [userAreaId, setUserAreaId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!supabase) {
        const stored = localStorage.getItem(storageKey)
        const raw = stored ? JSON.parse(stored) as Process[] : demoProcesses
        setProcesses(raw.map((item) => hydrate(item, areas, processTypes, statuses, priorities)))
        setLoading(false)
        return
      }
      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        const { data: profile } = await supabase.from('profiles').select('nombre_completo, role, area_id').eq('id', authData.user.id).single()
        setUserEmail(authData.user.email ?? '')
        setUserName(profile?.nombre_completo || authData.user.email || 'Usuario institucional')
        if (profile?.role) setRole(profile.role as Role)
        if (profile?.area_id) setUserAreaId(profile.area_id)
      }
      const [areaResult, typeResult, statusResult, priorityResult] = await Promise.all([
        supabase.from('areas').select('*').eq('activo', true).order('nombre'),
        supabase.from('process_types').select('*').eq('activo', true).order('nombre'),
        supabase.from('process_statuses').select('*').eq('activo', true).order('orden'),
        supabase.from('priorities').select('*').eq('activo', true).order('orden'),
      ])
      const nextAreas = areaResult.data ?? []
      const nextTypes = typeResult.data ?? []
      const nextStatuses = statusResult.data ?? []
      const nextPriorities = priorityResult.data ?? []
      setAreas(nextAreas); setProcessTypes(nextTypes); setStatuses(nextStatuses); setPriorities(nextPriorities)
      const result = await supabase.from('processes').select('*, area:areas(*), tipo:process_types(*), estado:process_statuses(*), prioridad:priorities(*)').eq('activo', true).order('updated_at', { ascending: false })
      if (result.error) toast.error(result.error.message)
      setProcesses((result.data ?? []).map(deriveProcess))
      setLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) return
    const channel = client.channel('processes-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'processes' }, () => {
      toast.info('Un trámite fue actualizado. Sincronizando…')
      client.from('processes').select('*, area:areas(*), tipo:process_types(*), estado:process_statuses(*), prioridad:priorities(*)').eq('activo', true)
        .then(({ data }) => data && setProcesses(data.map(deriveProcess)))
    }).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!supabase && processes.length) localStorage.setItem(storageKey, JSON.stringify(processes))
  }, [processes])

  async function saveProcess(data: ProcessFormData, current?: Process) {
    if (supabase) {
      const payload = {
        ...data,
        responsable_secundario: data.responsable_secundario || null,
        fecha_fin_real: data.fecha_fin_real || null,
        dependencia_externa: data.dependencia_externa || null,
        documento_respaldo: data.documento_respaldo || null,
        proxima_accion: data.proxima_accion || null,
        objetivo: data.objetivo || null,
        observaciones: data.observaciones || null,
        fecha_proxima_revision: data.fecha_proxima_revision || null,
        updated_at: new Date().toISOString(),
      }
      const response = current
        ? await supabase.from('processes').update(payload).eq('id', current.id).select('*, area:areas(*), tipo:process_types(*), estado:process_statuses(*), prioridad:priorities(*)').single()
        : await supabase.from('processes').insert(payload).select('*, area:areas(*), tipo:process_types(*), estado:process_statuses(*), prioridad:priorities(*)').single()
      if (response.error) throw response.error
      if (response.data) {
        const full = deriveProcess(response.data)
        setProcesses((old) => current ? old.map((item) => item.id === current.id ? full : item) : [full, ...old])
      }
      toast.success(current ? 'Trámite actualizado' : 'Trámite creado')
      return
    }
    const now = new Date().toISOString()
    const base: Process = {
      ...data,
      id: current?.id ?? uid(),
      codigo_proceso: current?.codigo_proceso ?? `TRV-${new Date().getFullYear()}-${String(processes.length + 1).padStart(4, '0')}`,
      activo: true,
      created_at: current?.created_at ?? now,
      updated_at: now,
    }
    if (current) {
      const tracked = Object.keys(data) as Array<keyof ProcessFormData>
      const changes = tracked.filter((key) => String(current[key] ?? '') !== String(data[key] ?? ''))
      setLogs((old) => [
        ...changes.map((key) => ({
          id: uid(), process_id: current.id, campo: key,
          valor_anterior: String(current[key] ?? ''), valor_nuevo: String(data[key] ?? ''),
          usuario: userName, created_at: now,
        })),
        ...old,
      ])
    }
    const full = hydrate(base, areas, processTypes, statuses, priorities)
    setProcesses((old) => current ? old.map((item) => item.id === current.id ? full : item) : [full, ...old])
    toast.success(current ? 'Trámite actualizado' : 'Trámite creado')
  }

  async function deleteProcess(id: string) {
    if (supabase) {
      const { error } = await supabase.from('processes').update({ activo: false }).eq('id', id)
      if (error) throw error
    }
    setProcesses((old) => old.filter((item) => item.id !== id))
    toast.success('Trámite archivado')
  }

  async function importProcesses(rows: ProcessFormData[]) {
    for (const row of rows) await saveProcess(row)
    return rows.length
  }

  function addCatalogItem(kind: 'areas' | 'processTypes' | 'statuses' | 'priorities', nombre: string) {
    const item = { id: uid(), nombre, activo: true }
    if (kind === 'areas') setAreas((old) => [...old, item])
    if (kind === 'processTypes') setProcessTypes((old) => [...old, item])
    if (kind === 'statuses') setStatuses((old) => [...old, item])
    if (kind === 'priorities') setPriorities((old) => [...old, item])
    toast.success('Catálogo actualizado')
  }

  const userAreaName = areas.find((item) => item.id === userAreaId)?.nombre ?? ''
  const canAccessManagement = role === 'admin' || role === 'gerente' || userAreaName.trim().toLowerCase() === 'gerencia general'

  const value = useMemo(() => ({
    processes, areas, processTypes, statuses, priorities, logs, loading,
    demoMode: !isSupabaseConfigured, role, userName, userEmail, userAreaName, canAccessManagement,
    saveProcess, deleteProcess, importProcesses, addCatalogItem,
  }), [processes, areas, processTypes, statuses, priorities, logs, loading, role, userName, userEmail, userAreaName, canAccessManagement])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider')
  return context
}
