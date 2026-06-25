import { AlertCircle, CalendarX2, CircleUserRound, ListTodo, Siren } from 'lucide-react'
import { Card, Badge } from '../components/ui'
import { useApp } from '../store/AppContext'
import { formatDate } from '../lib/utils'

export function Alerts() {
  const { processes } = useApp()
  const groups = [
    { title: 'Procesos vencidos', description: 'Superaron la fecha programada y continúan abiertos.', icon: CalendarX2, tone: 'red', items: processes.filter((item) => item.semaforo === 'Rojo') },
    { title: 'Acción gerencial', description: 'Marcados para decisión o desbloqueo de gerencia.', icon: Siren, tone: 'amber', items: processes.filter((item) => item.requiere_accion_gerencial) },
    { title: 'Sin próxima acción', description: 'No tienen definido el siguiente paso operativo.', icon: ListTodo, tone: 'purple', items: processes.filter((item) => !item.proxima_accion) },
    { title: 'Sin responsable', description: 'Procesos que necesitan una persona o unidad a cargo.', icon: CircleUserRound, tone: 'blue', items: processes.filter((item) => !item.responsable_principal) },
  ]
  return <div className="alert-layout">{groups.map(({ title, description, icon: Icon, tone, items }) => <Card className="alert-group" key={title}><header><div className={`alert-icon tone-${tone}`}><Icon size={20} /></div><div><h2>{title}</h2><p>{description}</p></div><strong>{items.length}</strong></header><div>{items.length ? items.map((item) => <article key={item.id}><AlertCircle size={16} /><div><strong>{item.nombre_proceso}</strong><span>{item.codigo_proceso} · vence {formatDate(item.fecha_fin_programada)}</span></div><Badge color={item.prioridad?.color}>{item.prioridad?.nombre}</Badge></article>) : <p className="all-clear">Sin novedades en esta categoría.</p>}</div></Card>)}</div>
}
