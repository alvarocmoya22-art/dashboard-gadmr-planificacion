import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, ExternalLink, FileText, ListChecks, MessageSquareText, Paperclip, Pencil, PencilLine, Plus, Search, SlidersHorizontal, Tag, UserRound } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../components/ui'
import { ProcessForm } from '../components/ProcessForm'
import { useApp } from '../store/AppContext'
import { canCreateProcesses, canEditProcesses } from '../lib/permissions'
import { formatDate, repairMojibake, todayIso } from '../lib/utils'
import { getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'
import type { Process } from '../types'

export function Operativa() {
  const { processes, comments, attachments, openAttachment, role, userEmail } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'active' | 'review'>('active')
  // undefined = cerrado · null = nuevo trámite · Process = editar ese trámite
  const [formProcess, setFormProcess] = useState<Process | null | undefined>(undefined)
  const canCreate = canCreateProcesses(role, userEmail)
  const canEdit = canEditProcesses(role, userEmail)

  const visible = useMemo(() => processes.filter((process) => {
    if (repairMojibake(process.estado?.nombre ?? '') === 'Finalizado') return false
    if (view === 'review') return Boolean(process.fecha_proxima_revision && process.fecha_proxima_revision <= todayIso())
    return true
  }), [processes, view])

  const q = query.trim().toLowerCase()
  const filtered = visible.filter((process) => {
    if (!q) return true
    const haystack = [process.codigo_proceso, process.nombre_proceso, process.egob_numero, process.egob_responsable_actual, getEgobIssueNumber(process)]
      .map((value) => repairMojibake(String(value ?? '')).toLowerCase())
    return haystack.some((value) => value.includes(q))
  })

  const lastComment = (id: string) => comments.find((item) => item.process_id === id)
  const lastAttachment = (id: string) => attachments.find((item) => item.process_id === id)

  async function open(attachment: NonNullable<ReturnType<typeof lastAttachment>>) {
    try {
      await openAttachment(attachment)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el adjunto.')
    }
  }

  return <div className="operativa">
    <div className="operativa-top">
      <div className="view-tabs">
        <button className={view === 'active' ? 'active' : ''} onClick={() => setView('active')}>Trámites activos</button>
        <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><SlidersHorizontal size={15} /> Pendientes de revisión</button>
      </div>
      {canCreate && <Button onClick={() => setFormProcess(null)}><Plus size={17} /> Nuevo trámite</Button>}
    </div>
    <div className="operativa-search">
      <Search size={18} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nº eGob, nombre o responsable…" />
    </div>
    <p className="operativa-count">{filtered.length} trámite{filtered.length === 1 ? '' : 's'} {view === 'review' ? 'por revisar' : 'por gestionar'}</p>

    {filtered.length ? <div className="operativa-list">
      {filtered.map((process) => {
        const egobNumber = getEgobIssueNumber(process)
        const egobUrl = getEgobIssueUrl(process)
        const comment = lastComment(process.id)
        const attachment = lastAttachment(process.id)
        return <Card key={process.id} className="operativa-card">
          <div className="operativa-card-head">
            <div>
              <small>{egobNumber ? `eGob #${egobNumber}` : process.codigo_proceso}</small>
              <h3>{repairMojibake(process.nombre_proceso)}</h3>
            </div>
            <div className="operativa-card-head-right">
              <Badge color={process.estado?.color}>{repairMojibake(process.estado?.nombre ?? 'Sin estado')}</Badge>
              {canEdit && <button type="button" className="operativa-edit-btn" title="Editar trámite" onClick={() => setFormProcess(process)}><Pencil size={15} /></button>}
            </div>
          </div>

          <div className="operativa-card-grid">
            <div>
              <span><Tag size={13} /> Tipo de proyecto</span>
              <strong>{repairMojibake(process.tipo?.nombre || '—')}</strong>
            </div>
            <div>
              <span><UserRound size={13} /> Actualmente con</span>
              <strong>{repairMojibake(process.egob_responsable_actual || 'Pendiente de sincronizar')}</strong>
              {process.egob_responsable_cargo && <small>{repairMojibake(process.egob_responsable_cargo)}</small>}
            </div>
            <div>
              <span><ListChecks size={13} /> Próxima acción</span>
              <strong>{process.proxima_accion ? repairMojibake(process.proxima_accion) : 'Sin próxima acción'}</strong>
            </div>
            <div>
              <span><CalendarClock size={13} /> Próxima revisión</span>
              <strong>{process.fecha_proxima_revision ? formatDate(process.fecha_proxima_revision) : '—'}</strong>
            </div>
            <div>
              <span>Último movimiento eGob</span>
              <strong>{repairMojibake(process.egob_ultimo_movimiento || '—')}</strong>
            </div>
            <div>
              <span><MessageSquareText size={13} /> Último comentario</span>
              <strong>{comment ? repairMojibake(comment.contenido) : 'Sin comentario interno'}</strong>
            </div>
            <div>
              <span><Paperclip size={13} /> Último adjunto</span>
              {attachment
                ? <button type="button" className="operativa-link" onClick={() => void open(attachment)}><FileText size={13} /> {repairMojibake(attachment.nombre_archivo)}</button>
                : <strong>Sin adjunto</strong>}
            </div>
          </div>

          <div className="operativa-card-actions">
            {egobUrl && <a className="button button-secondary" href={egobUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir en eGob</a>}
            <button type="button" className="button button-primary" onClick={() => navigate(`/procesos/${process.id}`)}><PencilLine size={15} /> Gestionar</button>
          </div>
        </Card>
      })}
    </div> : <EmptyState title={view === 'review' ? 'Sin trámites por revisar' : 'Sin trámites por gestionar'} description={view === 'review' ? 'No hay trámites con revisión pendiente para hoy.' : 'No hay trámites activos que coincidan con tu búsqueda.'} />}
    {formProcess !== undefined && <ProcessForm process={formProcess ?? undefined} onClose={() => setFormProcess(undefined)} />}
  </div>
}
