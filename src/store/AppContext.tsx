import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { areas as demoAreas, demoProcesses, priorities as demoPriorities, processTypes as demoTypes, statuses as demoStatuses } from '../data/tramites'
import { deriveProcess, repairMojibake, uid } from '../lib/utils'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isPendingReview as computePending } from '../lib/review'
import { reviewViewerFor } from '../lib/permissions'
import type { CatalogItem, ChangeLog, Process, ProcessAttachment, ProcessComment, ProcessFormData, Role } from '../types'

interface AppState {
  processes: Process[]
  areas: CatalogItem[]
  processTypes: CatalogItem[]
  statuses: CatalogItem[]
  priorities: CatalogItem[]
  logs: ChangeLog[]
  comments: ProcessComment[]
  attachments: ProcessAttachment[]
  loading: boolean
  demoMode: boolean
  role: Role
  userName: string
  userEmail: string
  userAreaName: string
  canAccessManagement: boolean
  globalSearch: string
  setGlobalSearch: (value: string) => void
  saveProcess: (data: ProcessFormData, current?: Process) => Promise<Process | undefined>
  deleteProcess: (id: string) => Promise<void>
  markReviewed: (id: string) => Promise<void>
  isPendingReview: (process: Process) => boolean
  latestComment: (processId: string) => ProcessComment | undefined
  addManualRelated: (processId: string, issue: string) => Promise<void>
  removeManualRelated: (processId: string, issue: string) => Promise<void>
  addComment: (processId: string, contenido: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
  uploadAttachment: (processId: string, file: File) => Promise<void>
  deleteAttachment: (attachment: ProcessAttachment) => Promise<void>
  openAttachment: (attachment: ProcessAttachment) => Promise<void>
  importProcesses: (rows: ProcessFormData[]) => Promise<number>
  addCatalogItem: (kind: CatalogKind, name: string) => Promise<CatalogItem | undefined>
  updateCatalogItem: (kind: CatalogKind, id: string, name: string) => Promise<void>
  deleteCatalogItem: (kind: CatalogKind, id: string) => Promise<void>
}

const AppContext = createContext<AppState | null>(null)
const storageKey = 'tramites-varios-processes-v1'
export type CatalogKind = 'areas' | 'processTypes' | 'statuses' | 'priorities'

const catalogTables: Record<CatalogKind, 'areas' | 'process_types' | 'process_statuses' | 'priorities'> = {
  areas: 'areas',
  processTypes: 'process_types',
  statuses: 'process_statuses',
  priorities: 'priorities',
}

function cleanCatalogs(items: CatalogItem[]) {
  return items.map((item) => ({ ...item, nombre: repairMojibake(item.nombre) }))
}

function cleanLog(item: ChangeLog): ChangeLog {
  return {
    ...item,
    campo: repairMojibake(item.campo),
    valor_anterior: item.valor_anterior == null ? item.valor_anterior : repairMojibake(item.valor_anterior),
    valor_nuevo: item.valor_nuevo == null ? item.valor_nuevo : repairMojibake(item.valor_nuevo),
  }
}

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
  const [comments, setComments] = useState<ProcessComment[]>([])
  const [attachments, setAttachments] = useState<ProcessAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>('admin')
  const [userName, setUserName] = useState(isSupabaseConfigured ? 'Usuario institucional' : 'Administrador demo')
  const [userEmail, setUserEmail] = useState('')
  const [userAreaId, setUserAreaId] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')
  // Mapa id -> nombre para resolver el autor de comentarios/adjuntos (profiles es legible por todos).
  const profilesRef = useRef<Map<string, string>>(new Map())
  const authUserIdRef = useRef<string | null>(null)
  // Reglas de "Pendientes de revisión" (#13): ids de Scar / Juan Diego y marcas de revisado por día.
  const [scarId, setScarId] = useState<string | null>(null)
  const [juanDiegoId, setJuanDiegoId] = useState<string | null>(null)
  // reviewMarks: key = `${processId}:${userId}` -> ISO de la última revisión de esa persona.
  const [reviewMarks, setReviewMarks] = useState<Map<string, string>>(new Map())

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
        authUserIdRef.current = authData.user.id
        const { data: profile } = await supabase.from('profiles').select('nombre_completo, role, area_id').eq('id', authData.user.id).single()
        setUserEmail(authData.user.email ?? '')
        setUserName(profile?.nombre_completo || authData.user.email || 'Usuario institucional')
        if (profile?.role) setRole(profile.role as Role)
        if (profile?.area_id) setUserAreaId(profile.area_id)
      }
      // Directorio de nombres para mostrar quién dejó cada comentario/adjunto,
      // y resolución de los ids de Scar / Juan Diego por email (para las reglas de #13).
      let profileRows: Array<{ id: string; nombre_completo?: string; email?: string }> = []
      const withEmail = await supabase.from('profiles').select('id, nombre_completo, email')
      if (withEmail.error) {
        // La columna email puede no existir aún (migración no aplicada): degrada sin romper.
        const basic = await supabase.from('profiles').select('id, nombre_completo')
        profileRows = (basic.data ?? []) as typeof profileRows
      } else {
        profileRows = (withEmail.data ?? []) as typeof profileRows
      }
      const nameMap = new Map<string, string>()
      for (const p of profileRows) {
        if (!p.id) continue
        nameMap.set(p.id, repairMojibake(p.nombre_completo || '') || 'Usuario institucional')
        const email = (p.email || '').trim().toLowerCase()
        if (email === 'nietosj@gadmriobamba.gob.ec') setScarId(p.id)
        if (email === 'remachejd@gadmriobamba.gob.ec') setJuanDiegoId(p.id)
      }
      profilesRef.current = nameMap
      // Marcas de "revisado" (para ocultar por el día). Tabla puede no existir aún.
      try {
        const { data: marks } = await supabase.from('process_review_marks').select('process_id, reviewed_by, reviewed_at')
        if (marks) setReviewMarks(new Map(marks.map((m) => [`${m.process_id}:${m.reviewed_by}`, m.reviewed_at])))
      } catch { /* tabla process_review_marks no existe aún */ }
      const [areaResult, typeResult, statusResult, priorityResult] = await Promise.all([
        supabase.from('areas').select('*').eq('activo', true).order('nombre'),
        supabase.from('process_types').select('*').eq('activo', true).order('nombre'),
        supabase.from('process_statuses').select('*').eq('activo', true).order('orden'),
        supabase.from('priorities').select('*').eq('activo', true).order('orden'),
      ])
      const nextAreas = cleanCatalogs(areaResult.data ?? [])
      const nextTypes = cleanCatalogs(typeResult.data ?? [])
      const nextStatuses = cleanCatalogs(statusResult.data ?? [])
      const nextPriorities = cleanCatalogs(priorityResult.data ?? [])
      setAreas(nextAreas); setProcessTypes(nextTypes); setStatuses(nextStatuses); setPriorities(nextPriorities)
      const result = await supabase.from('processes').select('*, area:areas(*), tipo:process_types(*), estado:process_statuses(*), prioridad:priorities(*)').eq('activo', true).order('updated_at', { ascending: false })
      if (result.error) toast.error(result.error.message)
      setProcesses((result.data ?? []).map(deriveProcess))
      const logResult = await supabase.from('process_change_log').select('*').order('created_at', { ascending: false }).limit(80)
      if (!logResult.error) {
        setLogs((logResult.data ?? []).map((item) => cleanLog({ ...item, usuario: 'Sistema' })))
      }
      const commentResult = await supabase
        .from('process_comments')
        .select('id,process_id,contenido,created_by,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!commentResult.error) {
        setComments((commentResult.data ?? []).map((item) => ({
          ...item,
          contenido: repairMojibake(item.contenido),
          usuario: profilesRef.current.get(item.created_by ?? '') || 'Usuario institucional',
        })))
      }
      const attachmentResult = await supabase
        .from('process_attachments')
        .select('id,process_id,nombre_archivo,storage_path,mime_type,tamano_bytes,created_by,created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (!attachmentResult.error) {
        setAttachments((attachmentResult.data ?? []).map((item) => ({
          ...item,
          nombre_archivo: repairMojibake(item.nombre_archivo),
          usuario: profilesRef.current.get(item.created_by ?? '') || 'Usuario institucional',
        })))
      }
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
    }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'process_change_log' }, (payload) => {
      const log = cleanLog({ ...(payload.new as ChangeLog), usuario: 'Sistema' })
      setLogs((old) => [log, ...old].slice(0, 80))
      if (log.campo === 'estado_id') toast.info('Un trámite cambió de estado. Revisa la campana de notificaciones.')
    }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'process_comments' }, (payload) => {
      const comment = payload.new as ProcessComment
      const usuario = profilesRef.current.get(comment.created_by ?? '')
        || (comment.created_by === authUserIdRef.current ? userName : 'Usuario institucional')
      setComments((old) => old.some((item) => item.id === comment.id)
        ? old
        : [{ ...comment, contenido: repairMojibake(comment.contenido), usuario }, ...old].slice(0, 200))
    }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'process_comments' }, (payload) => {
      const comment = payload.old as ProcessComment
      setComments((old) => old.filter((item) => item.id !== comment.id))
    }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'process_attachments' }, (payload) => {
      const attachment = payload.new as ProcessAttachment
      const usuario = profilesRef.current.get(attachment.created_by ?? '')
        || (attachment.created_by === authUserIdRef.current ? userName : 'Usuario institucional')
      setAttachments((old) => old.some((item) => item.id === attachment.id)
        ? old
        : [{ ...attachment, nombre_archivo: repairMojibake(attachment.nombre_archivo), usuario }, ...old].slice(0, 300))
    }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'process_attachments' }, (payload) => {
      const attachment = payload.old as ProcessAttachment
      setAttachments((old) => old.filter((item) => item.id !== attachment.id))
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
        egob_numero: data.egob_numero || null,
        egob_url: data.egob_url || null,
        egob_estado: data.egob_estado || null,
        egob_responsable_actual: data.egob_responsable_actual || null,
        egob_responsable_cargo: data.egob_responsable_cargo || null,
        egob_ultimo_movimiento: data.egob_ultimo_movimiento || null,
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
      let saved: Process | undefined
      if (response.data) {
        saved = deriveProcess(response.data)
        const full = saved
        setProcesses((old) => current ? old.map((item) => item.id === current.id ? full : item) : [full, ...old])
      }
      toast.success(current ? 'Trámite actualizado' : 'Trámite creado')
      return saved
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
    return full
  }

  async function deleteProcess(id: string) {
    if (supabase) {
      const { error } = await supabase.from('processes').update({ activo: false }).eq('id', id)
      if (error) throw error
    }
    setProcesses((old) => old.filter((item) => item.id !== id))
    toast.success('Trámite archivado')
  }

  // "Marcar como revisado": registra la marca del día para la persona que mira, lo que oculta
  // el trámite de SU vista de Pendientes ese día (reaparece mañana si sigue pendiente, o antes
  // si llega una señal nueva). No borra la fecha de próxima revisión.
  async function markReviewed(id: string) {
    const nowIso = new Date().toISOString()
    const userId = authUserIdRef.current || 'demo-user'
    if (supabase && authUserIdRef.current) {
      // Si la tabla aún no existe (migración no aplicada), no rompas la UI: guarda solo local.
      const { error } = await supabase
        .from('process_review_marks')
        .upsert({ process_id: id, reviewed_by: authUserIdRef.current, reviewed_at: nowIso }, { onConflict: 'process_id,reviewed_by' })
      if (error && !/process_review_marks/.test(String(error.message || ''))) throw error
    }
    setReviewMarks((old) => new Map(old).set(`${id}:${userId}`, nowIso))
    toast.success('Marcado como revisado por hoy')
  }

  // Trámites relacionados agregados a mano (además de la madre automática).
  async function setManualRelated(processId: string, list: string[]) {
    if (supabase) {
      const { error } = await supabase.from('processes').update({ egob_relacionados_manual: list, updated_at: new Date().toISOString() }).eq('id', processId)
      if (error && !/egob_relacionados_manual/.test(String(error.message || ''))) throw error
    }
    setProcesses((old) => old.map((p) => p.id === processId ? { ...p, egob_relacionados_manual: list } : p))
  }
  async function addManualRelated(processId: string, issue: string) {
    const num = String(issue).replace(/\D/g, '')
    if (!num) return
    const current = processes.find((x) => x.id === processId)?.egob_relacionados_manual ?? []
    if (current.includes(num)) { toast.info('Ese trámite ya está en la lista'); return }
    await setManualRelated(processId, [...current, num])
    toast.success('Trámite relacionado agregado')
  }
  async function removeManualRelated(processId: string, issue: string) {
    const current = processes.find((x) => x.id === processId)?.egob_relacionados_manual ?? []
    await setManualRelated(processId, current.filter((n) => n !== issue))
  }

  async function addComment(processId: string, contenido: string) {
    const cleanContent = repairMojibake(contenido).trim()
    if (!cleanContent) return
    if (supabase) {
      const { data: authData } = await supabase.auth.getUser()
      const createdBy = authData.user?.id
      if (!createdBy) throw new Error('Debes iniciar sesión para publicar comentarios.')
      const { data, error } = await supabase
        .from('process_comments')
        .insert({ process_id: processId, contenido: cleanContent, created_by: createdBy })
        .select('id,process_id,contenido,created_by,created_at,updated_at')
        .single()
      if (error) throw error
      if (data) setComments((old) => [{ ...data, contenido: repairMojibake(data.contenido), usuario: userName }, ...old].slice(0, 200))
    } else {
      setComments((old) => [{
        id: uid(),
        process_id: processId,
        contenido: cleanContent,
        usuario: userName,
        created_at: new Date().toISOString(),
      }, ...old].slice(0, 200))
    }
    toast.success('Comentario publicado')
  }

  async function deleteComment(id: string) {
    if (supabase) {
      const { error } = await supabase.from('process_comments').delete().eq('id', id)
      if (error) throw error
    }
    setComments((old) => old.filter((item) => item.id !== id))
    toast.success('Comentario eliminado')
  }

  async function uploadAttachment(processId: string, file: File) {
    if (!file) return
    if (!supabase) {
      const attachment: ProcessAttachment = {
        id: uid(),
        process_id: processId,
        nombre_archivo: repairMojibake(file.name),
        storage_path: URL.createObjectURL(file),
        mime_type: file.type,
        tamano_bytes: file.size,
        usuario: userName,
        created_at: new Date().toISOString(),
      }
      setAttachments((old) => [attachment, ...old].slice(0, 300))
      toast.success('Adjunto agregado en modo demo')
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    const createdBy = authData.user?.id
    if (!createdBy) throw new Error('Debes iniciar sesión para cargar adjuntos.')
    const safeName = repairMojibake(file.name).replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/g, '_')
    const storagePath = `${processId}/${Date.now()}-${safeName}`
    const upload = await supabase.storage.from('process-attachments').upload(storagePath, file, { upsert: false })
    if (upload.error) throw upload.error
    const { data, error } = await supabase
      .from('process_attachments')
      .insert({
        process_id: processId,
        nombre_archivo: repairMojibake(file.name),
        storage_path: storagePath,
        mime_type: file.type || null,
        tamano_bytes: file.size,
        created_by: createdBy,
      })
      .select('id,process_id,nombre_archivo,storage_path,mime_type,tamano_bytes,created_by,created_at')
      .single()
    if (error) throw error
    if (data) setAttachments((old) => [{ ...data, nombre_archivo: repairMojibake(data.nombre_archivo), usuario: userName }, ...old].slice(0, 300))
    toast.success('Adjunto cargado')
  }

  async function deleteAttachment(attachment: ProcessAttachment) {
    if (supabase) {
      const remove = await supabase.storage.from('process-attachments').remove([attachment.storage_path])
      if (remove.error) throw remove.error
      const { error } = await supabase.from('process_attachments').delete().eq('id', attachment.id)
      if (error) throw error
    } else if (attachment.storage_path.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.storage_path)
    }
    setAttachments((old) => old.filter((item) => item.id !== attachment.id))
    toast.success('Adjunto eliminado')
  }

  async function openAttachment(attachment: ProcessAttachment) {
    const pendingWindow = window.open('', '_blank')
    if (pendingWindow) pendingWindow.opener = null
    const openUrl = (url: string) => {
      if (pendingWindow) {
        pendingWindow.location.href = url
      } else {
        window.location.assign(url)
      }
    }

    if (!supabase) {
      openUrl(attachment.storage_path)
      return
    }
    try {
      const { data, error } = await supabase.storage.from('process-attachments').createSignedUrl(attachment.storage_path, 60 * 10)
      if (error) throw error
      openUrl(data.signedUrl)
    } catch (error) {
      pendingWindow?.close()
      throw error
    }
  }

  async function importProcesses(rows: ProcessFormData[]) {
    for (const row of rows) await saveProcess(row)
    return rows.length
  }

  function setCatalogState(kind: CatalogKind, updater: (old: CatalogItem[]) => CatalogItem[]) {
    if (kind === 'areas') setAreas(updater)
    if (kind === 'processTypes') setProcessTypes(updater)
    if (kind === 'statuses') setStatuses(updater)
    if (kind === 'priorities') setPriorities(updater)
  }

  async function addCatalogItem(kind: CatalogKind, nombre: string): Promise<CatalogItem | undefined> {
    const cleanName = repairMojibake(nombre).trim()
    if (!cleanName) return undefined
    let created: CatalogItem | undefined
    if (supabase) {
      const payload: Partial<CatalogItem> = { nombre: cleanName, activo: true }
      if (kind === 'statuses' || kind === 'priorities') payload.orden = (kind === 'statuses' ? statuses.length : priorities.length) + 1
      const { data, error } = await supabase.from(catalogTables[kind]).insert(payload).select('*').single()
      if (error) throw error
      if (data) {
        created = { ...data, nombre: repairMojibake(data.nombre) }
        setCatalogState(kind, (old) => [...old, created!])
      }
    } else {
      created = { id: uid(), nombre: cleanName, activo: true }
      setCatalogState(kind, (old) => [...old, created!])
    }
    toast.success('Catálogo actualizado')
    return created
  }

  async function updateCatalogItem(kind: CatalogKind, id: string, nombre: string) {
    const cleanName = repairMojibake(nombre).trim()
    if (!cleanName) return
    if (supabase) {
      const { error } = await supabase.from(catalogTables[kind]).update({ nombre: cleanName }).eq('id', id)
      if (error) throw error
    }
    setCatalogState(kind, (old) => old.map((item) => item.id === id ? { ...item, nombre: cleanName } : item))
    toast.success('Catálogo actualizado')
  }

  async function deleteCatalogItem(kind: CatalogKind, id: string) {
    if (supabase) {
      const { error } = await supabase.from(catalogTables[kind]).update({ activo: false }).eq('id', id)
      if (error) throw error
    }
    setCatalogState(kind, (old) => old.filter((item) => item.id !== id))
    toast.success('Elemento archivado')
  }

  const userAreaName = areas.find((item) => item.id === userAreaId)?.nombre ?? ''
  const canAccessManagement = role === 'admin' || role === 'gerente' || userAreaName.trim().toLowerCase() === 'gerencia general'

  // --- Pendientes de revisión (#13): señales por trámite ---------------------------------
  function latestComment(processId: string): ProcessComment | undefined {
    let best: ProcessComment | undefined
    for (const c of comments) {
      if (c.process_id !== processId) continue
      if (!best || String(c.created_at) > String(best.created_at)) best = c
    }
    return best
  }
  function lastEgobChangeAt(processId: string): string | null {
    let best: string | null = null
    for (const l of logs) {
      if (l.process_id !== processId || !String(l.campo || '').startsWith('egob_')) continue
      const t = String(l.created_at)
      if (!best || t > best) best = t
    }
    return best
  }
  function lastCommentAtBy(processId: string, userId: string | null): string | null {
    if (!userId) return null
    let best: string | null = null
    for (const c of comments) {
      if (c.process_id !== processId || c.created_by !== userId) continue
      const t = String(c.created_at)
      if (!best || t > best) best = t
    }
    return best
  }
  function isPendingReview(process: Process): boolean {
    const viewer = reviewViewerFor(userEmail)
    const finalized = repairMojibake(process.estado?.nombre) === 'Finalizado'
    const reviewedAt = reviewMarks.get(`${process.id}:${authUserIdRef.current || 'demo-user'}`) ?? null
    return computePending(viewer, {
      finalized,
      proximaRevision: process.fecha_proxima_revision ?? null,
      finProgramada: process.fecha_fin_programada ?? null,
      reviewedAt,
      lastEgobChangeAt: lastEgobChangeAt(process.id),
      lastCommentFromScarAt: lastCommentAtBy(process.id, scarId),
      lastCommentFromJuanDiegoAt: lastCommentAtBy(process.id, juanDiegoId),
    }, new Date().toISOString())
  }

  const value = useMemo(() => ({
    processes, areas, processTypes, statuses, priorities, logs, comments, attachments, loading,
    demoMode: !isSupabaseConfigured, role, userName, userEmail, userAreaName, canAccessManagement, globalSearch, setGlobalSearch,
    saveProcess, deleteProcess, markReviewed, isPendingReview, latestComment, addManualRelated, removeManualRelated, addComment, deleteComment, uploadAttachment, deleteAttachment, openAttachment, importProcesses, addCatalogItem, updateCatalogItem, deleteCatalogItem,
  }), [processes, areas, processTypes, statuses, priorities, logs, comments, attachments, loading, role, userName, userEmail, userAreaName, canAccessManagement, globalSearch, reviewMarks, scarId, juanDiegoId])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider')
  return context
}
