import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, CircleGauge, Flag, Layers3, MoveUpRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, Badge } from '../components/ui'
import { useApp } from '../store/AppContext'
import { formatDate } from '../lib/utils'

export function Dashboard() {
  const { processes } = useApp()
  const metrics = useMemo(() => {
    const active = processes.filter((item) => item.estado?.nombre !== 'Finalizado')
    const finished = processes.filter((item) => item.estado?.nombre === 'Finalizado')
    const overdue = processes.filter((item) => item.semaforo === 'Rojo')
    const expiring = processes.filter((item) => item.semaforo === 'Amarillo')
    const average = processes.length ? Math.round(processes.reduce((sum, item) => sum + item.porcentaje_avance, 0) / processes.length) : 0
    return { active, finished, overdue, expiring, average }
  }, [processes])
  const statusData = useMemo(() => Object.values(processes.reduce<Record<string, { name: string; value: number; color: string }>>((acc, item) => {
    const name = item.estado?.nombre ?? 'Sin estado'
    acc[name] ??= { name, value: 0, color: item.estado?.color ?? '#94a3b8' }
    acc[name].value += 1
    return acc
  }, {})), [processes])
  const areaData = useMemo(() => Object.values(processes.reduce<Record<string, { name: string; procesos: number; avance: number; total: number }>>((acc, item) => {
    const name = (item.area?.nombre ?? 'Sin área').replace('Subgerencia de ', '').replace('Jefatura de ', '')
    acc[name] ??= { name, procesos: 0, avance: 0, total: 0 }
    acc[name].procesos += 1; acc[name].total += item.porcentaje_avance; acc[name].avance = Math.round(acc[name].total / acc[name].procesos)
    return acc
  }, {})).slice(0, 6), [processes])
  const critical = processes.filter((item) => item.requiere_accion_gerencial || item.semaforo === 'Rojo' || item.prioridad?.nombre === 'Alta').slice(0, 4)

  const kpis = [
    { label: 'Procesos activos', value: metrics.active.length, note: `${processes.length} en el portafolio`, icon: BriefcaseBusiness, tone: 'teal' },
    { label: 'Finalizados', value: metrics.finished.length, note: 'Cumplimiento acumulado', icon: CheckCircle2, tone: 'blue' },
    { label: 'Vencidos', value: metrics.overdue.length, note: metrics.overdue.length ? 'Requieren intervención' : 'Sin retrasos críticos', icon: AlertTriangle, tone: 'red' },
    { label: 'Por vencer', value: metrics.expiring.length, note: 'Próximos 7 días', icon: CalendarClock, tone: 'amber' },
    { label: 'Avance general', value: `${metrics.average}%`, note: 'Promedio institucional', icon: CircleGauge, tone: 'purple' },
  ]

  return <div className="dashboard-grid">
    <section className="kpi-grid">{kpis.map(({ label, value, note, icon: Icon, tone }) => <Card className={`kpi-card tone-${tone}`} key={label}><div className="kpi-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></Card>)}</section>
    <section className="attention-banner">
      <div className="attention-icon"><Flag size={22} /></div>
      <div><p className="eyebrow">Qué requiere atención hoy</p><h2>{critical.length ? `${critical.length} procesos necesitan una decisión o seguimiento cercano` : 'La operación está bajo control'}</h2><p>Priorizamos vencimientos, alta prioridad y solicitudes explícitas de acción gerencial.</p></div>
      <Link to="/alertas">Revisar alertas <ArrowRight size={17} /></Link>
    </section>
    <section className="chart-grid">
      <Card className="chart-card"><div className="card-heading"><div><p className="eyebrow">Distribución</p><h3>Procesos por estado</h3></div><Layers3 size={20} /></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={4}>{statusData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{processes.length}</strong><span>Total</span></div></div><div className="legend">{statusData.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<b>{item.value}</b></span>)}</div></Card>
      <Card className="chart-card wide"><div className="card-heading"><div><p className="eyebrow">Desempeño</p><h3>Avance promedio por área</h3></div><MoveUpRight size={20} /></div><ResponsiveContainer width="100%" height={300}><BarChart data={areaData} margin={{ left: 0, right: 10, top: 15 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9e7" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => `${value}%`} /><Bar dataKey="avance" fill="#0f766e" radius={[7, 7, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer></Card>
    </section>
    <section className="critical-section"><div className="section-title"><div><p className="eyebrow">Foco ejecutivo</p><h2>Procesos críticos</h2></div><Link to="/procesos">Ver portafolio completo <ArrowRight size={16} /></Link></div><div className="critical-list">{critical.map((process) => <Link className="critical-row" to={`/procesos/${process.id}`} key={process.id}><span className={`traffic traffic-${process.semaforo?.toLowerCase()}`} /><div className="critical-main"><small>{process.codigo_proceso} · {process.area?.nombre}</small><strong>{process.nombre_proceso}</strong><span>Próxima acción: {process.proxima_accion || 'No definida'}</span></div><div className="critical-meta"><Badge color={process.prioridad?.color}>{process.prioridad?.nombre}</Badge><span>{formatDate(process.fecha_fin_programada)}</span></div><ArrowRight size={17} /></Link>)}</div></section>
  </div>
}
