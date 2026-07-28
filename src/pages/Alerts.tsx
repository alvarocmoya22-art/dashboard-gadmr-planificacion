import { AlertCircle, CalendarCheck2, CalendarX2, CircleUserRound, ListTodo, RefreshCw, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, Badge } from '../components/ui'
import { useApp } from '../store/AppContext'
import { formatDate, repairMojibake, todayIso } from '../lib/utils'
import type { Process } from '../types'

function isFinalized(item: Process) {
  return item.estado?.nombre === 'Finalizado'
}

function needsReviewToday(item: Process) {
  return Boolean(item.fecha_proxima_revision && item.fecha_proxima_revision <= todayIso() && !isFinalized(item))
}

export function Alerts() {
  const { processes, logs } = useApp()
  const activeProcesses = processes.filter((item) => !isFinalized(item))
  const egobLogs = logs.filter((item) => String(item.campo).startsWith('egob_')).slice(0, 20)
  const egobProcesses = egobLogs
    .map((log) => processes.find((process) => process.id === log.process_id))
    .filter((item): item is Process => Boolean(item))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)

  const groups = [
    { title: 'Revisión para hoy o vencida', description: 'Tienen fecha de próxima revisión igual o anterior a hoy.', icon: CalendarCheck2, tone: 'amber', items: activeProcesses.filter(needsReviewToday), meta: (item: Process) => `revisión ${formatDate(item.fecha_proxima_revision)}` },
    { title: 'Procesos vencidos', description: 'Superaron la fecha programada y continúan abiertos.', icon: CalendarX2, tone: 'red', items: activeProcesses.filter((item) => item.semaforo === 'Rojo'), meta: (item: Process) => `vence ${formatDate(item.fecha_fin_programada)}` },
    { title: 'Movimientos eGob detectados', description: 'Trámites cuyo estado, ubicación o último movimiento eGob cambió al sincronizar.', icon: RefreshCw, tone: 'teal', items: egobProcesses, meta: (item: Process) => repairMojibake(item.egob_ultimo_movimiento || 'Movimiento eGob registrado') },
    { title: 'Acción gerencial', description: 'Marcados para decisión o desbloqueo de gerencia.', icon: Siren, tone: 'purple', items: activeProcesses.filter((item) => item.requiere_accion_gerencial), meta: () => 'requiere acción gerencial' },
    { title: 'Sin próxima acción', description: 'No tienen definido el siguiente paso operativo.', icon: ListTodo, tone: 'blue', items: activeProcesses.filter((item) => !item.proxima_accion), meta: () => 'sin próxima acción' },
    { title: 'Sin responsable', description: 'Procesos que necesitan una persona o unidad a cargo.', icon: CircleUserRound, tone: 'blue', items: activeProcesses.filter((item) => !item.responsable_principal), meta: () => 'sin responsable principal' },
  ]

  return <div className="alert-layout">{groups.map(({ title, description, icon: Icon, tone, items, meta }) => <Card className="alert-group" key={title}><header><div className={`alert-icon tone-${tone}`}><Icon size={20} /></div><div><h2>{title}</h2><p>{description}</p></div><strong>{items.length}</strong></header><div>{items.length ? items.map((item) => <Link to={`/procesos/${item.id}`} className="alert-row-link" key={`${title}-${item.id}`}><AlertCircle size={16} /><div><strong>{item.nombre_proceso}</strong><span>{item.codigo_proceso} · {meta(item)}</span></div><Badge color={item.prioridad?.color}>{item.prioridad?.nombre}</Badge></Link>) : <p className="all-clear">Sin novedades en esta categoría.</p>}</div></Card>)}</div>
}
