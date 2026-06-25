import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock3, FileText, History, MessageSquareText, Paperclip, UserRound } from 'lucide-react'
import { Badge, Card, EmptyState } from '../components/ui'
import { useApp } from '../store/AppContext'
import { formatDate } from '../lib/utils'

export function ProcessDetail() {
  const { id } = useParams()
  const { processes, logs } = useApp()
  const process = processes.find((item) => item.id === id)
  if (!process) return <EmptyState title="Proceso no encontrado" description="El registro pudo haber sido archivado o no tienes acceso." />
  const processLogs = logs.filter((item) => item.process_id === process.id)
  return <div className="detail-page">
    <Link to="/procesos" className="back-link"><ArrowLeft size={17} /> Volver a procesos</Link>
    <Card className="detail-hero"><div><small>{process.codigo_proceso}</small><h2>{process.nombre_proceso}</h2><p>{process.objetivo || 'Sin objetivo registrado.'}</p><div className="detail-badges"><Badge color={process.estado?.color}>{process.estado?.nombre}</Badge><Badge color={process.prioridad?.color}>{process.prioridad?.nombre}</Badge><Badge>{process.confidencialidad}</Badge></div></div><div className="hero-progress"><div style={{ '--progress': `${process.porcentaje_avance * 3.6}deg` } as React.CSSProperties}><span>{process.porcentaje_avance}%</span></div><small>avance registrado</small></div></Card>
    <div className="detail-grid"><div className="detail-main">
      <Card className="info-card"><h3>Información general</h3><div className="info-grid"><Info icon={UserRound} label="Responsable principal" value={process.responsable_principal} /><Info icon={UserRound} label="Responsable secundario" value={process.responsable_secundario || '—'} /><Info icon={CalendarDays} label="Fecha inicio" value={formatDate(process.fecha_inicio)} /><Info icon={CalendarDays} label="Fin programado" value={formatDate(process.fecha_fin_programada)} /><Info icon={Clock3} label="Próxima revisión" value={formatDate(process.fecha_proxima_revision)} /><Info icon={FileText} label="Documento respaldo" value={process.documento_respaldo || '—'} /></div></Card>
      <Card className="info-card"><h3>Seguimiento</h3><div className="text-block"><span>Próxima acción</span><p>{process.proxima_accion || 'No definida.'}</p></div><div className="text-block"><span>Observaciones</span><p>{process.observaciones || 'Sin observaciones.'}</p></div></Card>
      <Card className="info-card"><h3><History size={18} /> Historial de cambios</h3>{processLogs.length ? processLogs.map((log) => <div className="history-row" key={log.id}><i /><div><strong>{log.campo}</strong><p>“{log.valor_anterior}” → “{log.valor_nuevo}”</p><small>{log.usuario} · {new Date(log.created_at).toLocaleString('es-EC')}</small></div></div>) : <p className="all-clear">No hay cambios posteriores registrados en esta sesión.</p>}</Card>
    </div><aside className="detail-side"><Card><h3><MessageSquareText size={18} /> Comentarios</h3><p>Los comentarios institucionales se habilitan al conectar Supabase.</p><textarea className="field" placeholder="Escribir comentario interno…" /><button className="button button-primary">Publicar comentario</button></Card><Card><h3><Paperclip size={18} /> Adjuntos</h3><div className="upload-zone">Arrastra archivos o haz clic para seleccionar</div></Card></aside></div>
  </div>
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="info-item"><Icon size={18} /><div><span>{label}</span><strong>{value}</strong></div></div>
}
