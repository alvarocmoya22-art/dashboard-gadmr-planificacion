import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Clock3, Download, ExternalLink, FileText, History, MessageSquareText, Paperclip, SlidersHorizontal, Trash2, UserRound } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '../components/ui'
import { useApp } from '../store/AppContext'
import { canEditProcesses } from '../lib/permissions'
import { formatDate, repairMojibake, todayIso } from '../lib/utils'
import { EGOB_BASE_URL, getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'
import { FlujoEditor, stepsToText, textToSteps } from '../components/FlujoEditor'
import type { FlujoStep, Process, ProcessFormData } from '../types'

// Iniciales para el avatar del autor en la conversación (máx. 2 letras).
function initials(name: string): string {
  const parts = repairMojibake(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toLocaleUpperCase('es')
}

export function ProcessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { processes, logs, comments, attachments, addComment, deleteComment, uploadAttachment, deleteAttachment, openAttachment, role, userEmail, userName, canAccessManagement } = useApp()
  const [commentText, setCommentText] = useState('')
  const [uploading, setUploading] = useState(false)
  const process = processes.find((item) => item.id === id)
  if (!process) return <EmptyState title="Proceso no encontrado" description="El registro pudo haber sido archivado o no tienes acceso." />
  const currentProcess = process
  // "Atrás" regresa a la vista de donde entraste (lista de trámites, ejecutiva, etc.).
  // Si no hay historial (enlace directo), cae a una lista por defecto según el rol.
  const backFallback = canAccessManagement ? '/procesos' : '/operativa'
  const goBack = () => { if (window.history.length > 1) navigate(-1); else navigate(backFallback) }
  const canEdit = canEditProcesses(role, userEmail)

  const processLogs = logs.filter((item) => item.process_id === currentProcess.id)
  const processComments = comments.filter((item) => item.process_id === currentProcess.id)
  const processAttachments = attachments.filter((item) => item.process_id === currentProcess.id)
  const egobNumber = getEgobIssueNumber(currentProcess)
  const egobUrl = getEgobIssueUrl(currentProcess)
  // Solo el/los trámite(s) madre (la "Tarea padre" en eGob). Los hijos e "insistos" quedan fuera.
  const relatedIssues = (currentProcess.egob_tramites_madre ?? [])
    .map((value) => String(value).replace(/\D/g, ''))
    .filter((value, index, array) => value && value !== egobNumber && array.indexOf(value) === index)

  async function publishComment() {
    try {
      await addComment(currentProcess.id, commentText)
      setCommentText('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo publicar el comentario.')
    }
  }

  async function pickAttachment(file?: File) {
    if (!file) return
    setUploading(true)
    try {
      await uploadAttachment(currentProcess.id, file)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el adjunto.')
    } finally {
      setUploading(false)
    }
  }

  async function downloadAttachment(attachment: typeof processAttachments[number]) {
    try {
      await openAttachment(attachment)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el adjunto.')
    }
  }

  async function removeComment(id: string) {
    if (!window.confirm('¿Eliminar este comentario interno?')) return
    try {
      await deleteComment(id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el comentario.')
    }
  }

  async function removeAttachment(attachment: typeof processAttachments[number]) {
    if (!window.confirm(`¿Eliminar el adjunto "${repairMojibake(attachment.nombre_archivo)}"?`)) return
    try {
      await deleteAttachment(attachment)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el adjunto.')
    }
  }

  return <div className="detail-page">
    <button type="button" onClick={goBack} className="back-link"><ArrowLeft size={17} /> Volver a trámites</button>
    <Card className="detail-hero"><div><small>{process.codigo_proceso}</small><h2>{repairMojibake(process.nombre_proceso)}</h2><p>{process.objetivo ? repairMojibake(process.objetivo) : 'Sin objetivo registrado.'}</p><div className="detail-badges"><Badge color={process.estado?.color}>{repairMojibake(process.estado?.nombre)}</Badge><Badge color={process.prioridad?.color}>{repairMojibake(process.prioridad?.nombre)}</Badge><Badge>{repairMojibake(process.confidencialidad)}</Badge></div></div><div className="hero-progress"><div style={{ '--progress': `${process.porcentaje_avance * 3.6}deg` } as React.CSSProperties}><span>{process.porcentaje_avance}%</span></div><small>avance registrado</small></div></Card>
    <div className="detail-grid"><div className="detail-main">
      <Card className="info-card"><h3>Información general</h3><div className="info-grid"><Info icon={UserRound} label="Responsable principal" value={process.responsable_principal} /><Info icon={UserRound} label="Responsable secundario" value={process.responsable_secundario || '—'} /><Info icon={UserRound} label="Actualmente con eGob" value={process.egob_responsable_actual || 'Pendiente de sincronizar'} /><Info icon={Building2} label="Dirección / cargo eGob" value={process.egob_responsable_cargo || 'No identificado'} /><Info icon={CalendarDays} label="Fecha inicio" value={formatDate(process.fecha_inicio)} /><Info icon={CalendarDays} label="Fin programado" value={formatDate(process.fecha_fin_programada)} /><Info icon={Clock3} label="Próxima revisión interna" value={formatDate(process.fecha_proxima_revision)} hint="Recordatorio para seguimiento del dashboard; no se envía automáticamente al eGob." /><Info icon={FileText} label="Documento respaldo" value={process.documento_respaldo || '—'} /></div></Card>
      <Card className="info-card"><h3><ExternalLink size={18} /> Vinculación eGob / eDoc</h3>{egobUrl ? <div className="egob-card egob-card-highlight"><div><span>Nro. trámite eGob</span><strong>{egobNumber}</strong></div><div><span>Estado eGob</span><strong>{repairMojibake(process.egob_estado || 'Pendiente de sincronizar')}</strong></div><div className="egob-current"><span>El trámite está actualmente con</span><strong>{repairMojibake(process.egob_responsable_actual || 'Pendiente de sincronizar')}</strong>{process.egob_responsable_cargo && <small>{repairMojibake(process.egob_responsable_cargo)}</small>}</div><div><span>Último movimiento detectado</span><strong>{repairMojibake(process.egob_ultimo_movimiento || 'Pendiente de sincronizar')}</strong></div><a className="button button-secondary" href={egobUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir en eGob</a></div> : <p className="all-clear">Este trámite aún no tiene número eGob/eDoc asociado.</p>}</Card>
      {relatedIssues.length > 0 && <Card className="info-card"><h3><ExternalLink size={18} /> {relatedIssues.length > 1 ? 'Trámites madre' : 'Trámite madre'}</h3><div className="related-list">{relatedIssues.map((num) => <a key={num} className="related-chip" href={`${EGOB_BASE_URL}/issues/${num}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> eGob #{num}</a>)}</div><p className="related-note">La "Tarea padre" del trámite en eGob. Los hijos e "insistos" quedan fuera para no saturar la vista.</p></Card>}
      {canEdit && <OperativeEdit process={currentProcess} />}
      <Card className="info-card"><h3><History size={18} /> Historial de cambios</h3>{processLogs.length ? processLogs.map((log) => <div className="history-row" key={log.id}><i /><div><strong>{repairMojibake(log.campo)}</strong><p>“{repairMojibake(log.valor_anterior ?? '')}” → “{repairMojibake(log.valor_nuevo ?? '')}”</p><small>{log.usuario} · {new Date(log.created_at).toLocaleString('es-EC')}</small></div></div>) : <p className="all-clear">No hay cambios posteriores registrados en esta sesión.</p>}</Card>
    </div><aside className="detail-side"><Card><h3><MessageSquareText size={18} /> Conversación</h3><p>Hilo interno del trámite en Supabase. Cada mensaje muestra quién lo dejó. No se envía al eGob.</p><div className="chat-thread">{processComments.length ? processComments.map((comment) => { const autor = comment.usuario || 'Usuario institucional'; const mine = autor === userName; return <article key={comment.id} className={`chat-msg ${mine ? 'chat-mine' : ''}`}><span className="chat-avatar" aria-hidden="true">{initials(autor)}</span><div className="chat-body"><div className="chat-meta"><strong>{mine ? 'Tú' : repairMojibake(autor)}</strong><small>{new Date(comment.created_at).toLocaleString('es-EC')}</small></div><p>{repairMojibake(comment.contenido)}</p></div><button className="icon-danger chat-del" type="button" title="Eliminar mensaje" onClick={() => void removeComment(comment.id)}><Trash2 size={14} /></button></article> }) : <p className="all-clear">Aún no hay mensajes. Inicia la conversación.</p>}</div><textarea className="field" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Escribir mensaje…" /><button className="button button-primary" onClick={() => void publishComment()}>Enviar mensaje</button></Card><Card><h3><Paperclip size={18} /> Adjuntos</h3><label className={`upload-zone ${uploading ? 'upload-zone-busy' : ''}`}>{uploading ? 'Cargando adjunto…' : 'Haz clic para seleccionar un archivo'}<input type="file" onChange={(event) => void pickAttachment(event.target.files?.[0])} disabled={uploading} /></label><div className="attachment-list">{processAttachments.length ? processAttachments.map((attachment) => <div className="attachment-row" key={attachment.id}><button type="button" onClick={() => void downloadAttachment(attachment)}><FileText size={15} /><span>{repairMojibake(attachment.nombre_archivo)}</span><Download size={14} /></button><button className="icon-danger" type="button" title="Eliminar adjunto" onClick={() => void removeAttachment(attachment)}><Trash2 size={14} /></button></div>) : <p className="all-clear">Aún no hay adjuntos cargados.</p>}</div></Card></aside></div>
  </div>
}

function Info({ icon: Icon, label, value, hint }: { icon: typeof UserRound; label: string; value: string; hint?: string }) {
  return <div className="info-item"><Icon size={18} /><div><span>{repairMojibake(label)}</span><strong>{repairMojibake(value)}</strong>{hint && <small>{repairMojibake(hint)}</small>}</div></div>
}

function toFormData(process: Process): ProcessFormData {
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
    egob_responsable_cargo: process.egob_responsable_cargo,
    egob_ultimo_movimiento: process.egob_ultimo_movimiento,
    proxima_accion: process.proxima_accion,
    flujo: process.flujo,
    objetivo: process.objetivo,
    observaciones: process.observaciones,
    fecha_proxima_revision: process.fecha_proxima_revision,
    requiere_accion_gerencial: process.requiere_accion_gerencial,
    confidencialidad: process.confidencialidad,
  }
}

// Panel de gestión para el operador (y gerencia): estado, Próxima acción (checklist/flujo con
// avance automático), observaciones y próxima revisión. No crea ni elimina trámites.
function OperativeEdit({ process }: { process: Process }) {
  const { statuses, saveProcess } = useApp()
  const [estadoId, setEstadoId] = useState(process.estado_id)
  const [avance, setAvance] = useState(process.porcentaje_avance)
  const [flujo, setFlujo] = useState<FlujoStep[]>(() => (
    Array.isArray(process.flujo) && process.flujo.length ? process.flujo : textToSteps(process.proxima_accion)
  ))
  const [observaciones, setObservaciones] = useState(repairMojibake(process.observaciones ?? ''))
  const [revision, setRevision] = useState(process.fecha_proxima_revision ?? '')
  const [saving, setSaving] = useState(false)

  const hasFlujo = flujo.length > 0
  const done = flujo.filter((step) => step.hecho).length
  const flujoAvance = hasFlujo ? Math.round((done / flujo.length) * 100) : avance

  async function save(nextRevision = revision) {
    setSaving(true)
    try {
      await saveProcess({
        ...toFormData(process),
        estado_id: estadoId,
        porcentaje_avance: flujoAvance,
        flujo,
        proxima_accion: hasFlujo ? stepsToText(flujo) : process.proxima_accion,
        observaciones,
        fecha_proxima_revision: nextRevision || undefined,
      }, process)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el trámite.')
    } finally {
      setSaving(false)
    }
  }

  return <Card className="operative-edit">
    <h3><SlidersHorizontal size={18} /> Gestionar trámite</h3>
    <div className="operative-edit-grid">
      <Field label="Estado"><Select value={estadoId} onChange={(event) => setEstadoId(event.target.value)}>{statuses.map((item) => <option key={item.id} value={item.id}>{repairMojibake(item.nombre)}</option>)}</Select></Field>
      {!hasFlujo && <Field label={`Avance · ${avance}%`}><Input type="range" min="0" max="100" value={avance} onChange={(event) => setAvance(Number(event.target.value))} /></Field>}

      <div className="span-2"><FlujoEditor flujo={flujo} onChange={setFlujo} /></div>

      <Field label="Observaciones" className="span-2"><Textarea value={observaciones} onChange={(event) => setObservaciones(event.target.value)} placeholder="Notas de seguimiento…" /></Field>
      <Field label="Próxima revisión interna"><Input type="date" value={revision} onChange={(event) => setRevision(event.target.value)} /></Field>
      <div className="operative-edit-review">
        <button type="button" className="operativa-link" onClick={() => { setRevision(''); void save('') }} disabled={saving}><CheckCircle2 size={15} /> Marcar como revisado</button>
      </div>
    </div>
    <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
  </Card>
}

