import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, CircleGauge, ExternalLink, FileText, Flag, Layers3, Paperclip, Search, ShieldCheck } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, Badge } from '../components/ui'
import { useApp } from '../store/AppContext'
import { getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'
import { formatDate, normalizeText, repairMojibake } from '../lib/utils'


export function Dashboard() {
  const { processes, comments, attachments, openAttachment } = useApp()
  const [portfolioSearch, setPortfolioSearch] = useState('')

  const latestCommentByProcess = useMemo(() => comments.reduce<Record<string, string>>((acc, comment) => {
    if (!acc[comment.process_id]) acc[comment.process_id] = repairMojibake(comment.contenido)
    return acc
  }, {}), [comments])

  const latestAttachmentByProcess = useMemo(() => attachments.reduce<Record<string, typeof attachments[number]>>((acc, attachment) => {
    if (!acc[attachment.process_id]) acc[attachment.process_id] = attachment
    return acc
  }, {}), [attachments])

  const metrics = useMemo(() => {
    const active = processes.filter((item) => repairMojibake(item.estado?.nombre) !== 'Finalizado')
    const finished = processes.filter((item) => repairMojibake(item.estado?.nombre) === 'Finalizado')
    const overdue = processes.filter((item) => item.semaforo === 'Rojo')
    const expiring = processes.filter((item) => item.semaforo === 'Amarillo')
    const average = processes.length ? Math.round(processes.reduce((sum, item) => sum + item.porcentaje_avance, 0) / processes.length) : 0
    return { active, finished, overdue, expiring, average }
  }, [processes])

  const statusData = useMemo(() => Object.values(processes.reduce<Record<string, { name: string; value: number; color: string }>>((acc, item) => {
    const name = repairMojibake(item.estado?.nombre ?? 'Sin estado')
    acc[name] ??= { name, value: 0, color: item.estado?.color ?? '#94a3b8' }
    acc[name].value += 1
    return acc
  }, {})), [processes])


  const executivePortfolio = processes
    .filter((item) => repairMojibake(item.estado?.nombre) !== 'Finalizado')
    .sort((a, b) => {
      const priorityScore = (item: typeof a) => item.semaforo === 'Rojo' ? 0 : repairMojibake(item.prioridad?.nombre) === 'Alta' ? 1 : item.semaforo === 'Amarillo' ? 2 : 3
      return priorityScore(a) - priorityScore(b) || String(a.fecha_fin_programada ?? '').localeCompare(String(b.fecha_fin_programada ?? ''))
    })

  const executiveQuery = normalizeText(portfolioSearch).toLocaleLowerCase('es')
  const executiveFiltered = executivePortfolio.filter((process) => {
    if (!executiveQuery) return true
    const latestComment = latestCommentByProcess[process.id] ?? ''
    const latestAttachment = latestAttachmentByProcess[process.id]?.nombre_archivo ?? ''
    const text = [
      process.codigo_proceso,
      process.nombre_proceso,
      process.responsable_principal,
      process.responsable_secundario,
      process.area?.nombre,
      process.egob_numero,
      process.egob_responsable_actual,
      process.egob_ultimo_movimiento,
      process.proxima_accion,
      latestComment,
      latestAttachment,
    ].map((value) => normalizeText(repairMojibake(value ?? ''))).join(' ').toLocaleLowerCase('es')
    return text.includes(executiveQuery)
  })
  const executivePreview = executiveFiltered.slice(0, 6)

  const kpis = [
    { label: 'Trámites activos', value: metrics.active.length, note: `${processes.length} en seguimiento`, icon: BriefcaseBusiness, tone: 'teal' },
    { label: 'Finalizados', value: metrics.finished.length, note: 'Cumplimiento acumulado', icon: CheckCircle2, tone: 'blue' },
    { label: 'Vencidos', value: metrics.overdue.length, note: metrics.overdue.length ? 'Requieren intervención' : 'Sin retrasos críticos', icon: AlertTriangle, tone: 'red' },
    { label: 'Por vencer', value: metrics.expiring.length, note: 'Próximos 7 días', icon: CalendarClock, tone: 'amber' },
    { label: 'Avance general', value: `${metrics.average}%`, note: 'Promedio institucional', icon: CircleGauge, tone: 'purple' },
  ]

  const syncedWithEgob = processes.filter((item) => item.egob_ultimo_movimiento && item.egob_ultimo_movimiento !== 'Pendiente de sincronizar')
  const withEgobOwner = processes.filter((item) => item.egob_responsable_actual && item.egob_responsable_actual !== 'Pendiente de sincronizar')
  const directorSignals = [
    { label: 'Ubicación eGob identificada', value: withEgobOwner.length, detail: 'Trámites con responsable actual detectado' },
    { label: 'Movimientos eGob detectados', value: syncedWithEgob.length, detail: 'Último movimiento disponible para seguimiento' },
    { label: 'Comentarios internos', value: comments.length, detail: 'Notas cargadas por el equipo para decisión' },
    { label: 'Adjuntos internos', value: attachments.length, detail: 'Respaldos disponibles dentro del dashboard' },
  ]
  const onTrack = metrics.active.filter((item) => item.semaforo !== 'Rojo' && item.semaforo !== 'Amarillo')
  const signalTotal = Math.max(metrics.active.length, 1)
  const followupSignals = [
    { label: 'Requieren atención', value: metrics.overdue.length, detail: 'Vencidos o con semáforo rojo', color: '#e84d4d', width: `${Math.round((metrics.overdue.length / signalTotal) * 100)}%` },
    { label: 'Revisión próxima', value: metrics.expiring.length, detail: 'Próximos 7 días', color: '#df8b2d', width: `${Math.round((metrics.expiring.length / signalTotal) * 100)}%` },
    { label: 'En seguimiento estable', value: onTrack.length, detail: 'Activos sin alerta inmediata', color: '#168378', width: `${Math.round((onTrack.length / signalTotal) * 100)}%` },
    { label: 'Con movimiento eGob', value: syncedWithEgob.length, detail: 'Ya registran último movimiento detectado', color: '#2f6bed', width: `${Math.round((syncedWithEgob.length / Math.max(processes.length, 1)) * 100)}%` },
  ]
  return <div className="dashboard-grid">
    <section className="kpi-grid">{kpis.map(({ label, value, note, icon: Icon, tone }) => <Card className={`kpi-card tone-${tone}`} key={label}><div className="kpi-icon"><Icon size={20} /></div><div><span>{repairMojibake(label)}</span><strong>{value}</strong><small>{repairMojibake(note)}</small></div></Card>)}</section>
    <section className="attention-banner">
      <div className="attention-icon"><Flag size={22} /></div>
      <div><p className="eyebrow">Qué requiere atención hoy</p><h2>{metrics.overdue.length || metrics.expiring.length ? `${metrics.overdue.length + metrics.expiring.length} trámites necesitan seguimiento cercano` : 'La operación está bajo control'}</h2><p>Priorizamos vencimientos, alta prioridad y solicitudes explícitas de acción gerencial.</p></div>
      <Link to="/alertas">Revisar alertas <ArrowRight size={17} /></Link>
    </section>
    <section className="director-summary-grid">
      {directorSignals.map((item) => <article className="director-summary-card" key={item.label}>
        <span>{repairMojibake(item.label)}</span>
        <strong>{item.value}</strong>
        <small>{repairMojibake(item.detail)}</small>
      </article>)}
    </section>
    <section className="chart-grid">
      <Card className="chart-card"><div className="card-heading"><div><p className="eyebrow">Distribución</p><h3>Trámites por estado</h3></div><Layers3 size={20} /></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={4}>{statusData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{processes.length}</strong><span>Total</span></div></div><div className="legend">{statusData.map((item) => <span key={item.name}><i style={{ background: item.color }} />{repairMojibake(item.name)}<b>{item.value}</b></span>)}</div></Card>
      <Card className="chart-card wide institutional-card"><div className="card-heading"><div><p className="eyebrow">Seguimiento</p><h3>Semáforo institucional de seguimiento</h3></div><ShieldCheck size={20} /></div><div className="signal-list">{followupSignals.map((item) => <article key={item.label} className="signal-row"><div className="signal-copy"><span>{item.label}</span><small>{item.detail}</small></div><strong>{item.value}</strong><div className="signal-track"><i style={{ width: item.width, background: item.color }} /></div></article>)}</div><div className="institutional-note"><strong>Lectura ejecutiva</strong><p>Este bloque muestra el nivel de atención requerido por el portafolio sin comparar direcciones ni generar rankings internos.</p></div></Card>
    </section>
    <section className="critical-section">
      <div className="section-title"><div><p className="eyebrow">Agenda del Director</p><h2>Vista ejecutiva de trámites</h2><span>{executivePortfolio.length} trámites activos con responsable eGob, último movimiento, comentario y adjunto disponible cuando exista · se muestran 6 por defecto</span></div><Link to="/procesos">Ver portafolio completo <ArrowRight size={16} /></Link></div>
      <div className="executive-search"><Search size={16} /><input value={portfolioSearch} onChange={(event) => setPortfolioSearch(event.target.value)} placeholder="Buscar trámite, código, área, responsable o eGob…" /></div>
      <div className="critical-list">{executivePreview.length ? executivePreview.map((process) => {
        const egobNumber = getEgobIssueNumber(process)
        const egobUrl = getEgobIssueUrl(process)
        const latestComment = latestCommentByProcess[process.id]
        const latestAttachment = latestAttachmentByProcess[process.id]
        const areaName = repairMojibake(process.area?.nombre ?? 'Sin área')
        const processName = repairMojibake(process.nombre_proceso)
        const egobOwner = repairMojibake(process.egob_responsable_actual || 'Pendiente de sincronizar')
        const commentText = repairMojibake(latestComment || 'Sin comentario interno')
        const movementText = repairMojibake(process.egob_ultimo_movimiento || 'Pendiente de sincronizar')
        const attachmentName = repairMojibake(latestAttachment?.nombre_archivo || 'Sin adjunto cargado')
        return <article className="critical-row" key={process.id}>
          <span className={`traffic traffic-${process.semaforo?.toLowerCase()}`} />
          <div className="critical-main">
            <small>{process.codigo_proceso} · {areaName}</small>
            <strong>{processName}</strong>
            <span className="executive-info-line line-attachment"><Paperclip size={12} /><b>Último adjunto</b><em>{attachmentName}</em></span>
            <span className="executive-info-line line-owner"><b>Actualmente con eGob</b><em>{egobOwner}</em></span>
            <span className="executive-info-line line-comment"><b>Último comentario</b><em>{commentText}</em></span>
            <span className="executive-info-line line-movement"><b>Último movimiento eGob</b><em>{movementText}</em></span>
          </div>
          <div className="critical-actions">
            <div className="critical-meta"><Badge color={process.prioridad?.color}>{repairMojibake(process.prioridad?.nombre)}</Badge><span>{formatDate(process.fecha_fin_programada)}</span></div>
            <div className="egob-actions">
              {egobNumber ? <span className="egob-number">eGob #{egobNumber}</span> : <span className="egob-number muted">Sin eGob</span>}
              {egobUrl ? <a className="egob-open" href={egobUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir eGob</a> : null}
              {latestAttachment ? <button className="attachment-open" type="button" onClick={() => void openAttachment(latestAttachment)}><FileText size={14} /> Abrir adjunto</button> : null}
            </div>
          </div>
          <Link className="row-detail-link" to={`/procesos/${process.id}`} aria-label={`Ver detalle de ${processName}`}><ArrowRight size={17} /></Link>
        </article>
      }) : <p className="all-clear">No se encontraron trámites con ese criterio.</p>}</div>
    </section>
  </div>
}


