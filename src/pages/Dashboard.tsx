import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, CircleGauge, ExternalLink, FileText, Layers3, Paperclip, Search } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, Badge } from '../components/ui'
import { useApp } from '../store/AppContext'
import { getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'
import { formatDate, normalizeText, repairMojibake } from '../lib/utils'


export function Dashboard() {
  const { processes, comments, attachments, openAttachment, isPendingReview, reviewComment } = useApp()
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

  const priorityData = useMemo(() => {
    const colors: Record<string, string> = {
      Alta: '#e84d4d',
      Media: '#df8b2d',
      Baja: '#4aa65b',
      'Sin prioridad': '#94a3b8',
    }
    const totals = processes.reduce<Record<string, number>>((acc, item) => {
      const name = repairMojibake(item.prioridad?.nombre ?? 'Sin prioridad')
      acc[name] = (acc[name] ?? 0) + 1
      return acc
    }, {})

    return ['Alta', 'Media', 'Baja', 'Sin prioridad']
      .map((name) => ({ name, value: totals[name] ?? 0, color: colors[name] }))
      .filter((item) => item.value > 0)
  }, [processes])
  const priorityMax = Math.max(...priorityData.map((item) => item.value), 1)

  const TYPE_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5', '#b45309', '#65a30d', '#9333ea', '#dc2626']
  const typeData = useMemo(() => {
    const totals = processes.reduce<Record<string, number>>((acc, item) => {
      const name = repairMojibake(item.tipo?.nombre ?? 'Sin tipo')
      acc[name] = (acc[name] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({ ...item, color: TYPE_COLORS[index % TYPE_COLORS.length] }))
  }, [processes])
  const typeMax = Math.max(...typeData.map((item) => item.value), 1)


  // La agenda del Director muestra los trámites pendientes de revisión según sus reglas (#13):
  // comentario de Scar o fin programado a una semana (y lo que marcó revisado se oculta ese día).
  const executivePortfolio = processes
    .filter((item) => repairMojibake(item.estado?.nombre) !== 'Finalizado' && isPendingReview(item))
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
      process.egob_responsable_cargo,
      process.egob_ultimo_movimiento,
      process.proxima_accion,
      latestComment,
      latestAttachment,
    ].map((value) => normalizeText(repairMojibake(value ?? ''))).join(' ').toLocaleLowerCase('es')
    return text.includes(executiveQuery)
  })
  const executivePreview = executiveFiltered

  const kpis = [
    { label: 'Trámites activos', value: metrics.active.length, note: `${processes.length} en seguimiento`, icon: BriefcaseBusiness, tone: 'teal' },
    { label: 'Finalizados', value: metrics.finished.length, note: 'Cumplimiento acumulado', icon: CheckCircle2, tone: 'blue' },
    { label: 'Vencidos', value: metrics.overdue.length, note: metrics.overdue.length ? 'Requieren intervención' : 'Sin retrasos críticos', icon: AlertTriangle, tone: 'red' },
    { label: 'Por vencer', value: metrics.expiring.length, note: 'Próximos 7 días', icon: CalendarClock, tone: 'amber' },
    { label: 'Avance general', value: `${metrics.average}%`, note: 'Promedio institucional', icon: CircleGauge, tone: 'purple' },
  ]

  return <div className="dashboard-grid">
    <section className="kpi-grid">{kpis.map(({ label, value, note, icon: Icon, tone }) => <Card className={`kpi-card tone-${tone}`} key={label}><div className="kpi-icon"><Icon size={20} /></div><div><span>{repairMojibake(label)}</span><strong>{value}</strong><small>{repairMojibake(note)}</small></div></Card>)}</section>
    <section className="portfolio-composition-section">
      <Card className="chart-card portfolio-composition-card">
        <div className="card-heading"><div><p className="eyebrow">Composición</p><h3>Distribución del portafolio</h3></div><Layers3 size={20} /></div>
        <div className="portfolio-composition-grid">
          <div className="portfolio-status-panel">
            <div className="subchart-heading"><strong>Por estado</strong><span>Situación actual de los trámites</span></div>
            <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={4}>{statusData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{processes.length}</strong><span>Total</span></div></div>
            <div className="legend status-legend">{statusData.map((item) => <span key={item.name}><i style={{ background: item.color }} /><em>{repairMojibake(item.name)}</em><b>{item.value}</b></span>)}</div>
          </div>
          <div className="portfolio-priority-panel">
            <div className="subchart-heading"><strong>Por prioridad</strong><span>Nivel de atención definido para el portafolio</span></div>
            <div className="priority-bars">{priorityData.map((item) => <article className="priority-row" key={item.name}>
              <div className="priority-row-copy"><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}</strong></div>
              <div className="priority-track"><i style={{ width: `${Math.max((item.value / priorityMax) * 100, 4)}%`, background: item.color }} /></div>
              <small>{Math.round((item.value / Math.max(processes.length, 1)) * 100)}% del portafolio</small>
            </article>)}</div>
          </div>
          <div className="portfolio-type-panel">
            <div className="subchart-heading"><strong>Por tipo de proyecto</strong><span>Distribución por tipo de trámite</span></div>
            <div className="priority-bars type-panel-bars">{typeData.map((item) => <article className="priority-row" key={item.name}>
              <div className="priority-row-copy"><span><i style={{ background: item.color }} />{repairMojibake(item.name)}</span><strong>{item.value}</strong></div>
              <div className="priority-track"><i style={{ width: `${Math.max((item.value / typeMax) * 100, 4)}%`, background: item.color }} /></div>
            </article>)}</div>
          </div>
        </div>
      </Card>
    </section>
    <section className="critical-section">
      <div className="section-title"><div><p className="eyebrow">Agenda del Director</p><h2>Trámites pendientes de revisión</h2><span>{executivePortfolio.length} trámite{executivePortfolio.length === 1 ? '' : 's'} pendiente{executivePortfolio.length === 1 ? '' : 's'} de revisión (fecha llegada o vencida) · responsable eGob, último movimiento, comentario y adjunto cuando exista</span></div><Link to="/procesos">Ver portafolio completo <ArrowRight size={16} /></Link></div>
      <div className="executive-search"><Search size={16} /><input value={portfolioSearch} onChange={(event) => setPortfolioSearch(event.target.value)} placeholder="Buscar trámite, código, área, responsable o eGob…" /></div>
      <div className="critical-list">{executivePreview.length ? executivePreview.map((process) => {
        const egobNumber = getEgobIssueNumber(process)
        const egobUrl = getEgobIssueUrl(process)
        const agendaComment = reviewComment(process.id, 'ejecutiva')
        const latestAttachment = latestAttachmentByProcess[process.id]
        const areaName = repairMojibake(process.area?.nombre ?? 'Sin área')
        const processName = repairMojibake(process.nombre_proceso)
        const egobOwner = repairMojibake(process.egob_responsable_actual || 'Pendiente de sincronizar')
        const egobRole = repairMojibake(process.egob_responsable_cargo || '')
        const commentText = agendaComment ? `${repairMojibake(agendaComment.contenido)} — ${repairMojibake(agendaComment.usuario || '')}` : 'Sin comentario interno'
        const movementText = repairMojibake(process.egob_ultimo_movimiento || 'Pendiente de sincronizar')
        const attachmentName = repairMojibake(latestAttachment?.nombre_archivo || 'Sin adjunto cargado')
        return <article className="critical-row" key={process.id}>
          <span className={`traffic traffic-${process.semaforo?.toLowerCase()}`} />
          <div className="critical-main">
            <small>{egobNumber ? `eGob #${egobNumber}` : 'Sin número eGob'} · {areaName}</small>
            <strong>{processName}</strong>
            <span className="executive-info-line line-attachment"><Paperclip size={12} /><b>Último adjunto</b><em>{attachmentName}</em></span>
            <span className="executive-info-line line-owner"><b>Actualmente con eGob</b><em>{egobOwner}{egobRole ? ` · ${egobRole}` : ''}</em></span>
            <span className="executive-info-line line-action"><b>Próxima acción</b><em>{process.proxima_accion ? repairMojibake(process.proxima_accion) : 'Sin próxima acción'}</em></span>
            <span className="executive-info-line line-review"><b>Próxima revisión</b><em>{process.fecha_proxima_revision ? formatDate(process.fecha_proxima_revision) : '—'}</em></span>
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
      }) : <p className="all-clear">{portfolioSearch ? 'No se encontraron trámites con ese criterio.' : 'No hay trámites pendientes de revisión por ahora.'}</p>}</div>
    </section>
  </div>
}


