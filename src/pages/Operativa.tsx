import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ExternalLink, FileText, MessageSquareText, Paperclip, PencilLine, Plus, Search, UserRound } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../components/ui'
import { ProcessForm } from '../components/ProcessForm'
import { useApp } from '../store/AppContext'
import { canCreateProcesses } from '../lib/permissions'
import { repairMojibake } from '../lib/utils'
import { getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'

export function Operativa() {
  const { processes, comments, attachments, openAttachment, role, userEmail } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const canCreate = canCreateProcesses(role, userEmail)

  const active = useMemo(
    () => processes.filter((process) => repairMojibake(process.estado?.nombre ?? '') !== 'Finalizado'),
    [processes],
  )

  const q = query.trim().toLowerCase()
  const filtered = active.filter((process) => {
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
      <div className="operativa-search">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nº eGob, nombre o responsable…" />
      </div>
      {canCreate && <Button onClick={() => setCreating(true)}><Plus size={17} /> Nuevo trámite</Button>}
    </div>
    <p className="operativa-count">{filtered.length} trámite{filtered.length === 1 ? '' : 's'} por gestionar</p>

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
            <Badge color={process.estado?.color}>{repairMojibake(process.estado?.nombre ?? 'Sin estado')}</Badge>
          </div>

          <div className="operativa-card-grid">
            <div>
              <span><UserRound size={13} /> Actualmente con</span>
              <strong>{repairMojibake(process.egob_responsable_actual || 'Pendiente de sincronizar')}</strong>
              {process.egob_responsable_cargo && <small>{repairMojibake(process.egob_responsable_cargo)}</small>}
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
    </div> : <EmptyState title="Sin trámites por gestionar" description="No hay trámites activos que coincidan con tu búsqueda." />}
    {creating && <ProcessForm onClose={() => setCreating(false)} />}
  </div>
}
