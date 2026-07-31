import { useApp } from '../store/AppContext'
import { Badge } from '../components/ui'
import { formatDate, repairMojibake } from '../lib/utils'

export function Kanban() {
  const { statuses, processes } = useApp()
  return <div className="kanban-board">{statuses.map((status) => {
    const items = processes.filter((process) => process.estado_id === status.id)
    return <section className="kanban-column" key={status.id}><header><div><i style={{ background: status.color }} /><strong>{repairMojibake(status.nombre)}</strong></div><span>{items.length}</span></header><div className="kanban-stack">{items.map((process) => <article className="kanban-card" key={process.id}><small>{process.codigo_proceso}</small><h3>{repairMojibake(process.nombre_proceso)}</h3><p>{repairMojibake(process.area?.nombre)}</p><div className="progress-cell"><div><i style={{ width: `${process.porcentaje_avance}%` }} /></div><span>{process.porcentaje_avance}%</span></div><footer><Badge color={process.prioridad?.color}>{repairMojibake(process.prioridad?.nombre)}</Badge><span>{formatDate(process.fecha_fin_programada)}</span></footer></article>)}</div></section>
  })}</div>
}
