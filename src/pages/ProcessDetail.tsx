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

export function ProcessDetail() {
  const { id } = useParams()
  const { processes, logs, saveProcess } = useApp()
  const [syncing, setSyncing] = useState(false)
  const process = processes.find((item) => item.id === id)
  if (!process) return <EmptyState title="Proceso no encontrado" description="El registro pudo haber sido archivado o no tienes acceso." />
  const currentProcess = process

  const processLogs = logs.filter((item) => item.process_id === currentProcess.id)
  const egobNumber = getEgobIssueNumber(currentProcess)
  const egobUrl = getEgobIssueUrl(currentProcess)

  async function syncEgob() {
    if (!egobNumber) {
      toast.error('Este trámite no tiene número eGob/eDoc.')
      return
    }
    setSyncing(true)
    try {
      const response = await fetch(`/.netlify/functions/egob-sync?issue=${encodeURIComponent(egobNumber)}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo sincronizar eGob.')
      await saveProcess({
        ...formDataFromProcess(currentProcess),
        egob_numero: payload.issue || egobNumber,
        egob_url: payload.url || egobUrl,
        egob_estado: payload.estado || currentProcess.egob_estado,
        egob_responsable_actual: payload.responsable_actual || currentProcess.egob_responsable_actual,
        egob_ultimo_movimiento: payload.ultimo_movimiento || payload.actualizado_en || currentProcess.egob_ultimo_movimiento,
      }, currentProcess)
      toast.success('Información eGob sincronizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo sincronizar eGob.')
    } finally {
      setSyncing(false)
    }
  }

  return <div className="detail-page">
    <Link to="/procesos" className="back-link"><ArrowLeft size={17} /> Volver a trámites</Link>
    <Card className="detail-hero"><div><small>{process.codigo_proceso}</small><h2>{process.nombre_proceso}</h2><p>{process.objetivo || 'Sin objetivo registrado.'}</p><div className="detail-badges"><Badge color={process.estado?.color}>{process.estado?.nombre}</Badge><Badge color={process.prioridad?.color}>{process.prioridad?.nombre}</Badge><Badge>{process.confidencialidad}</Badge></div></div><div className="hero-progress"><div style={{ '--progress': `${process.porcentaje_avance * 3.6}deg` } as React.CSSProperties}><span>{process.porcentaje_avance}%</span></div><small>avance registrado</small></div></Card>
    <div className="detail-grid"><div className="detail-main">
      <Card className="info-card"><h3>Información general</h3><div className="info-grid"><Info icon={UserRound} label="Responsable principal" value={process.responsable_principal} /><Info icon={UserRound} label="Responsable secundario" value={process.responsable_secundario || '—'} /><Info icon={UserRound} label="Actualmente con eGob" value={process.egob_responsable_actual || 'Pendiente de sincronizar'} /><Info icon={CalendarDays} label="Fecha inicio" value={formatDate(process.fecha_inicio)} /><Info icon={CalendarDays} label="Fin programado" value={formatDate(process.fecha_fin_programada)} /><Info icon={Clock3} label="Próxima revisión" value={formatDate(process.fecha_proxima_revision)} /><Info icon={FileText} label="Documento respaldo" value={process.documento_respaldo || '—'} /></div></Card>
      <Card className="info-card"><h3><ExternalLink size={18} /> Vinculación eGob / eDoc</h3>{egobUrl ? <div className="egob-card"><div><span>Nro. trámite eGob</span><strong>{egobNumber}</strong></div><div><span>Estado eGob</span><strong>{process.egob_estado || 'Pendiente de sincronizar'}</strong></div><div><span>Actualmente con</span><strong>{process.egob_responsable_actual || 'Pendiente de sincronizar'}</strong></div><div><span>Último movimiento</span><strong>{process.egob_ultimo_movimiento || 'Pendiente de sincronizar'}</strong></div><a className="button button-secondary" href={egobUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir en eGob</a><button className="button button-primary" onClick={() => void syncEgob()} disabled={syncing}><RefreshCw size={16} /> {syncing ? 'Sincronizando…' : 'Sincronizar eGob'}</button></div> : <p className="all-clear">Este trámite aún no tiene número eGob/eDoc asociado.</p>}</Card>
      <Card className="info-card"><h3>Seguimiento</h3><div className="text-block"><span>Próxima acción</span><p>{process.proxima_accion ? repairMojibake(process.proxima_accion) : 'No definida.'}</p></div><div className="text-block"><span>Observaciones</span><p>{process.observaciones ? repairMojibake(process.observaciones) : 'Sin observaciones.'}</p></div></Card>
      <Card className="info-card"><h3><History size={18} /> Historial de cambios</h3>{processLogs.length ? processLogs.map((log) => <div className="history-row" key={log.id}><i /><div><strong>{log.campo}</strong><p>“{String(log.valor_anterior ?? '')}” → “{String(log.valor_nuevo ?? '')}”</p><small>{log.usuario} · {new Date(log.created_at).toLocaleString('es-EC')}</small></div></div>) : <p className="all-clear">No hay cambios posteriores registrados en esta sesión.</p>}</Card>
    </div><aside className="detail-side"><Card><h3><MessageSquareText size={18} /> Comentarios</h3><p>Los comentarios institucionales se habilitan al conectar Supabase.</p><textarea className="field" placeholder="Escribir comentario interno…" /><button className="button button-primary">Publicar comentario</button></Card><Card><h3><Paperclip size={18} /> Adjuntos</h3><div className="upload-zone">Arrastra archivos o haz clic para seleccionar</div></Card></aside></div>
  </div>
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="info-item"><Icon size={18} /><div><span>{label}</span><strong>{value}</strong></div></div>
}
