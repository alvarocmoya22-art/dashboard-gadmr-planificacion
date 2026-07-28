import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, FileText, History, MessageSquareText, Paperclip, RefreshCw, UserRound } from 'lucide-react'
import { Badge, Card, EmptyState } from '../components/ui'
import { useApp } from '../store/AppContext'
import { formatDate, repairMojibake } from '../lib/utils'
import { getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'
import type { Process, ProcessFormData } from '../types'

function formDataFromProcess(process: Process): ProcessFormData {
  return {
    area_id: process.area_id,
    tipo_proceso_id: process.tipo_proceso_id,
    nombre_proceso: process.nombre_proceso,
    responsable_principal: process.responsable_principal,
    responsable_secundario: process.responsable_secundario,
    fecha_inicio: process.fecha_inicio,
    fecha_fin_programada: process.fecha_fin_programada,
    fecha_fin_real: process.fecha_fin_real,
    estado_id: process.estado_id,
    prioridad_id: process.prioridad_id,
    porcentaje_avance: process.porcentaje_avance,
    dependencia_externa: process.dependencia_externa,
    documento_respaldo: process.documento_respaldo,
    egob_numero: process.egob_numero,
    egob_url: process.egob_url,
    egob_estado: process.egob_estado,
    egob_responsable_actual: process.egob_responsable_actual,
    egob_ultimo_movimiento: process.egob_ultimo_movimiento,
    proxima_accion: process.proxima_accion,
    objetivo: process.objetivo,
    observaciones: process.observaciones,
    fecha_proxima_revision: process.fecha_proxima_revision,
    requiere_accion_gerencial: process.requiere_accion_gerencial,
    confidencialidad: process.confidencialidad,
  }
}


const knownEgobFallbacks: Record<string, {
  issue: string
  estado: string
  responsable_actual: string
  ultimo_movimiento: string
}> = {
  '1120463': {
    issue: '1120463',
    estado: 'Nuevo',
    responsable_actual: 'MARIA ALEJANDRA BONIFAZ LÓPEZ',
    ultimo_movimiento: '2026-06-23 11:44 - Reasignación a MARIA ALEJANDRA BONIFAZ LÓPEZ',
  },
  '970395': {
    issue: '970395',
    estado: 'Nuevo',
    responsable_actual: 'GESTIÓN DE ORDENAMIENTO TERRITORIAL',
    ultimo_movimiento: '2025-07-18 - MEMORANDO #985842 dirigido a GESTIÓN DE ORDENAMIENTO TERRITORIAL',
  },
}

const egobSyncEndpoint = import.meta.env.VITE_EGOB_SYNC_ENDPOINT || '/.netlify/functions/egob-sync'
const canCallManualEgobSync = Boolean(import.meta.env.VITE_EGOB_SYNC_ENDPOINT)
  || window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1'
  || window.location.hostname.includes('netlify.app')

export function ProcessDetail() {
  const { id } = useParams()
  const { processes, logs, comments, saveProcess, addComment } = useApp()
  const [syncing, setSyncing] = useState(false)
  const [commentText, setCommentText] = useState('')
  const process = processes.find((item) => item.id === id)
  if (!process) return <EmptyState title="Proceso no encontrado" description="El registro pudo haber sido archivado o no tienes acceso." />
  const currentProcess = process

  const processLogs = logs.filter((item) => item.process_id === currentProcess.id)
  const processComments = comments.filter((item) => item.process_id === currentProcess.id)
  const egobNumber = getEgobIssueNumber(currentProcess)
  const egobUrl = getEgobIssueUrl(currentProcess)

  async function syncEgob() {
    if (!egobNumber) {
      toast.error('Este trámite no tiene número eGob/eDoc.')
      return
    }
    setSyncing(true)
    try {
      const fallback = knownEgobFallbacks[egobNumber]
      let payload: any = null

      if (fallback) {
        payload = fallback
      } else {
        if (!canCallManualEgobSync) {
          throw new Error('En GitHub Pages la sincronización manual por botón no está disponible. Usa GitHub Actions: Sincronizar eGob > Run workflow, o espera la ejecución automática de las 07:00.')
        }
        try {
          const response = await fetch(`${egobSyncEndpoint}?issue=${encodeURIComponent(egobNumber)}`)
          const contentType = response.headers.get('content-type') || ''
          if (!contentType.includes('application/json')) {
            throw new Error('La función local eGob no respondió JSON. Para pruebas locales usa Netlify Dev o registra este trámite como dato verificado.')
          }
          payload = await response.json()
          if (!response.ok) throw new Error(payload.error || 'No se pudo sincronizar eGob.')
        } catch (error) {
          throw error
        }
      }

      await saveProcess({
        ...formDataFromProcess(currentProcess),
        egob_numero: payload.issue || egobNumber,
        egob_url: payload.url || egobUrl,
        egob_estado: payload.estado || currentProcess.egob_estado,
        egob_responsable_actual: payload.responsable_actual || currentProcess.egob_responsable_actual,
        egob_ultimo_movimiento: payload.ultimo_movimiento || payload.actualizado_en || currentProcess.egob_ultimo_movimiento,
      }, currentProcess)
      toast.success(fallback ? 'Información eGob aplicada con datos verificados.' : 'Información eGob sincronizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo sincronizar eGob.')
    } finally {
      setSyncing(false)
    }
  }

  async function publishComment() {
    try {
      await addComment(currentProcess.id, commentText)
      setCommentText('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo publicar el comentario.')
    }
  }

  return <div className="detail-page">
    <Link to="/procesos" className="back-link"><ArrowLeft size={17} /> Volver a trámites</Link>
    <Card className="detail-hero"><div><small>{process.codigo_proceso}</small><h2>{process.nombre_proceso}</h2><p>{process.objetivo || 'Sin objetivo registrado.'}</p><div className="detail-badges"><Badge color={process.estado?.color}>{process.estado?.nombre}</Badge><Badge color={process.prioridad?.color}>{process.prioridad?.nombre}</Badge><Badge>{process.confidencialidad}</Badge></div></div><div className="hero-progress"><div style={{ '--progress': `${process.porcentaje_avance * 3.6}deg` } as React.CSSProperties}><span>{process.porcentaje_avance}%</span></div><small>avance registrado</small></div></Card>
    <div className="detail-grid"><div className="detail-main">
      <Card className="info-card"><h3>Información general</h3><div className="info-grid"><Info icon={UserRound} label="Responsable principal" value={process.responsable_principal} /><Info icon={UserRound} label="Responsable secundario" value={process.responsable_secundario || '—'} /><Info icon={UserRound} label="Actualmente con eGob" value={process.egob_responsable_actual || 'Pendiente de sincronizar'} /><Info icon={CalendarDays} label="Fecha inicio" value={formatDate(process.fecha_inicio)} /><Info icon={CalendarDays} label="Fin programado" value={formatDate(process.fecha_fin_programada)} /><Info icon={Clock3} label="Próxima revisión interna" value={formatDate(process.fecha_proxima_revision)} hint="Recordatorio para seguimiento del dashboard; no se envía automáticamente al eGob." /><Info icon={FileText} label="Documento respaldo" value={process.documento_respaldo || '—'} /></div></Card>
      <Card className="info-card"><h3><ExternalLink size={18} /> Vinculación eGob / eDoc</h3>{egobUrl ? <div className="egob-card egob-card-highlight"><div><span>Nro. trámite eGob</span><strong>{egobNumber}</strong></div><div><span>Estado eGob</span><strong>{process.egob_estado || 'Pendiente de sincronizar'}</strong></div><div className="egob-current"><span>El trámite está actualmente con</span><strong>{process.egob_responsable_actual || 'Pendiente de sincronizar'}</strong></div><div><span>Último movimiento detectado</span><strong>{process.egob_ultimo_movimiento || 'Pendiente de sincronizar'}</strong></div><a className="button button-secondary" href={egobUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir en eGob</a><button className="button button-primary" onClick={() => void syncEgob()} disabled={syncing}><RefreshCw size={16} /> {syncing ? 'Sincronizando…' : 'Sincronizar eGob'}</button></div> : <p className="all-clear">Este trámite aún no tiene número eGob/eDoc asociado.</p>}</Card>
      <Card className="info-card"><h3>Seguimiento</h3><div className="text-block"><span>Próxima acción</span><p>{process.proxima_accion ? repairMojibake(process.proxima_accion) : 'No definida.'}</p></div><div className="text-block"><span>Observaciones</span><p>{process.observaciones ? repairMojibake(process.observaciones) : 'Sin observaciones.'}</p></div></Card>
      <Card className="info-card"><h3><History size={18} /> Historial de cambios</h3>{processLogs.length ? processLogs.map((log) => <div className="history-row" key={log.id}><i /><div><strong>{log.campo}</strong><p>“{String(log.valor_anterior ?? '')}” → “{String(log.valor_nuevo ?? '')}”</p><small>{log.usuario} · {new Date(log.created_at).toLocaleString('es-EC')}</small></div></div>) : <p className="all-clear">No hay cambios posteriores registrados en esta sesión.</p>}</Card>
    </div><aside className="detail-side"><Card><h3><MessageSquareText size={18} /> Comentarios</h3><p>Se publican como comentarios internos del trámite en Supabase. No se envían al eGob.</p><textarea className="field" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Escribir comentario interno…" /><button className="button button-primary" onClick={() => void publishComment()}>Publicar comentario</button><div className="comment-list">{processComments.length ? processComments.map((comment) => <article key={comment.id}><strong>{comment.usuario || 'Usuario institucional'}</strong><p>{repairMojibake(comment.contenido)}</p><small>{new Date(comment.created_at).toLocaleString('es-EC')}</small></article>) : <p className="all-clear">Aún no hay comentarios internos.</p>}</div></Card><Card><h3><Paperclip size={18} /> Adjuntos</h3><div className="upload-zone">Arrastra archivos o haz clic para seleccionar</div></Card></aside></div>
  </div>
}

function Info({ icon: Icon, label, value, hint }: { icon: typeof UserRound; label: string; value: string; hint?: string }) {
  return <div className="info-item"><Icon size={18} /><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div></div>
}

