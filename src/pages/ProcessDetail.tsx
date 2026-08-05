import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Building2, CalendarDays, Clock3, Download, ExternalLink, FileText, History, MessageSquareText, Paperclip, Trash2, UserRound } from 'lucide-react'
import { Badge, Card, EmptyState } from '../components/ui'
import { useApp } from '../store/AppContext'
import { formatDate, repairMojibake } from '../lib/utils'
import { getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'

export function ProcessDetail() {
  const { id } = useParams()
  const { processes, logs, comments, attachments, addComment, deleteComment, uploadAttachment, deleteAttachment, openAttachment } = useApp()
  const [commentText, setCommentText] = useState('')
  const [uploading, setUploading] = useState(false)
  const process = processes.find((item) => item.id === id)
  if (!process) return <EmptyState title="Proceso no encontrado" description="El registro pudo haber sido archivado o no tienes acceso." />
  const currentProcess = process

  const processLogs = logs.filter((item) => item.process_id === currentProcess.id)
  const processComments = comments.filter((item) => item.process_id === currentProcess.id)
  const processAttachments = attachments.filter((item) => item.process_id === currentProcess.id)
  const egobNumber = getEgobIssueNumber(currentProcess)
  const egobUrl = getEgobIssueUrl(currentProcess)

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
    <Link to="/procesos" className="back-link"><ArrowLeft size={17} /> Volver a trámites</Link>
    <Card className="detail-hero"><div><small>{process.codigo_proceso}</small><h2>{repairMojibake(process.nombre_proceso)}</h2><p>{process.objetivo ? repairMojibake(process.objetivo) : 'Sin objetivo registrado.'}</p><div className="detail-badges"><Badge color={process.estado?.color}>{repairMojibake(process.estado?.nombre)}</Badge><Badge color={process.prioridad?.color}>{repairMojibake(process.prioridad?.nombre)}</Badge><Badge>{repairMojibake(process.confidencialidad)}</Badge></div></div><div className="hero-progress"><div style={{ '--progress': `${process.porcentaje_avance * 3.6}deg` } as React.CSSProperties}><span>{process.porcentaje_avance}%</span></div><small>avance registrado</small></div></Card>
    <div className="detail-grid"><div className="detail-main">
      <Card className="info-card"><h3>Información general</h3><div className="info-grid"><Info icon={UserRound} label="Responsable principal" value={process.responsable_principal} /><Info icon={UserRound} label="Responsable secundario" value={process.responsable_secundario || '—'} /><Info icon={UserRound} label="Actualmente con eGob" value={process.egob_responsable_actual || 'Pendiente de sincronizar'} /><Info icon={Building2} label="Dirección / cargo eGob" value={process.egob_responsable_cargo || 'No identificado'} /><Info icon={CalendarDays} label="Fecha inicio" value={formatDate(process.fecha_inicio)} /><Info icon={CalendarDays} label="Fin programado" value={formatDate(process.fecha_fin_programada)} /><Info icon={Clock3} label="Próxima revisión interna" value={formatDate(process.fecha_proxima_revision)} hint="Recordatorio para seguimiento del dashboard; no se envía automáticamente al eGob." /><Info icon={FileText} label="Documento respaldo" value={process.documento_respaldo || '—'} /></div></Card>
      <Card className="info-card"><h3><ExternalLink size={18} /> Vinculación eGob / eDoc</h3>{egobUrl ? <div className="egob-card egob-card-highlight"><div><span>Nro. trámite eGob</span><strong>{egobNumber}</strong></div><div><span>Estado eGob</span><strong>{repairMojibake(process.egob_estado || 'Pendiente de sincronizar')}</strong></div><div className="egob-current"><span>El trámite está actualmente con</span><strong>{repairMojibake(process.egob_responsable_actual || 'Pendiente de sincronizar')}</strong>{process.egob_responsable_cargo && <small>{repairMojibake(process.egob_responsable_cargo)}</small>}</div><div><span>Último movimiento detectado</span><strong>{repairMojibake(process.egob_ultimo_movimiento || 'Pendiente de sincronizar')}</strong></div><a className="button button-secondary" href={egobUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir en eGob</a></div> : <p className="all-clear">Este trámite aún no tiene número eGob/eDoc asociado.</p>}</Card>
      <Card className="info-card"><h3>Seguimiento</h3><div className="text-block"><span>Próxima acción</span><p>{process.proxima_accion ? repairMojibake(process.proxima_accion) : 'No definida.'}</p></div><div className="text-block"><span>Observaciones</span><p>{process.observaciones ? repairMojibake(process.observaciones) : 'Sin observaciones.'}</p></div></Card>
      <Card className="info-card"><h3><History size={18} /> Historial de cambios</h3>{processLogs.length ? processLogs.map((log) => <div className="history-row" key={log.id}><i /><div><strong>{repairMojibake(log.campo)}</strong><p>“{repairMojibake(log.valor_anterior ?? '')}” → “{repairMojibake(log.valor_nuevo ?? '')}”</p><small>{log.usuario} · {new Date(log.created_at).toLocaleString('es-EC')}</small></div></div>) : <p className="all-clear">No hay cambios posteriores registrados en esta sesión.</p>}</Card>
    </div><aside className="detail-side"><Card><h3><MessageSquareText size={18} /> Comentarios</h3><p>Se publican como comentarios internos del trámite en Supabase. No se envían al eGob.</p><textarea className="field" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Escribir comentario interno…" /><button className="button button-primary" onClick={() => void publishComment()}>Publicar comentario</button><div className="comment-list">{processComments.length ? processComments.map((comment) => <article key={comment.id}><div className="comment-head"><strong>{comment.usuario || 'Usuario institucional'}</strong><button className="icon-danger" type="button" title="Eliminar comentario" onClick={() => void removeComment(comment.id)}><Trash2 size={14} /></button></div><p>{repairMojibake(comment.contenido)}</p><small>{new Date(comment.created_at).toLocaleString('es-EC')}</small></article>) : <p className="all-clear">Aún no hay comentarios internos.</p>}</div></Card><Card><h3><Paperclip size={18} /> Adjuntos</h3><label className={`upload-zone ${uploading ? 'upload-zone-busy' : ''}`}>{uploading ? 'Cargando adjunto…' : 'Haz clic para seleccionar un archivo'}<input type="file" onChange={(event) => void pickAttachment(event.target.files?.[0])} disabled={uploading} /></label><div className="attachment-list">{processAttachments.length ? processAttachments.map((attachment) => <div className="attachment-row" key={attachment.id}><button type="button" onClick={() => void downloadAttachment(attachment)}><FileText size={15} /><span>{repairMojibake(attachment.nombre_archivo)}</span><Download size={14} /></button><button className="icon-danger" type="button" title="Eliminar adjunto" onClick={() => void removeAttachment(attachment)}><Trash2 size={14} /></button></div>) : <p className="all-clear">Aún no hay adjuntos cargados.</p>}</div></Card></aside></div>
  </div>
}

function Info({ icon: Icon, label, value, hint }: { icon: typeof UserRound; label: string; value: string; hint?: string }) {
  return <div className="info-item"><Icon size={18} /><div><span>{repairMojibake(label)}</span><strong>{repairMojibake(value)}</strong>{hint && <small>{repairMojibake(hint)}</small>}</div></div>
}

