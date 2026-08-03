import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Plus, SlidersHorizontal } from 'lucide-react'
import { Button } from '../components/ui'
import { ProcessTable } from '../components/ProcessTable'
import { ProcessForm } from '../components/ProcessForm'
import type { Process } from '../types'
import { exportProcessesToXlsx } from '../services/export'
import { useApp } from '../store/AppContext'
import { canCreateProcesses, canExportReports } from '../lib/permissions'
import { repairMojibake } from '../lib/utils'

export function Processes() {
  const [formProcess, setFormProcess] = useState<Process | null | undefined>(undefined)
  const [view, setView] = useState<'active' | 'review'>('active')
  const [searchParams, setSearchParams] = useSearchParams()
  const { processes, comments, role, userEmail } = useApp()

  const onlyWithComments = searchParams.get('comentarios') === '1'
  const commentedProcessIds = useMemo(() => new Set(comments.map((comment) => comment.process_id)), [comments])

  const visibleProcesses = processes.filter((process) => {
    if (repairMojibake(process.estado?.nombre) === 'Finalizado') return false
    if (onlyWithComments && !commentedProcessIds.has(process.id)) return false
    if (view === 'review') return Boolean(process.fecha_proxima_revision && process.fecha_proxima_revision <= new Date().toISOString().slice(0, 10))
    return true
  })

  const clearCommentFilter = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('comentarios')
    setSearchParams(nextParams, { replace: true })
  }

  return <div>
    <div className="page-actions">
      <div className="view-tabs">
        <button className={view === 'active' ? 'active' : ''} onClick={() => setView('active')}>Trámites activos</button>
        <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><SlidersHorizontal size={15} /> Pendientes de revisión</button>
      </div>
      <div>
        {onlyWithComments && <button className="filter-pill active" type="button" onClick={clearCommentFilter}>Con comentarios internos ×</button>}
        {canExportReports(role) && <Button variant="secondary" onClick={() => exportProcessesToXlsx(visibleProcesses)}><Download size={17} /> Exportar</Button>}
        {canCreateProcesses(role, userEmail) && <Button onClick={() => setFormProcess(null)}><Plus size={17} /> Nuevo trámite</Button>}
      </div>
    </div>
    <ProcessTable view={view} processesOverride={visibleProcesses} onEdit={(process) => setFormProcess(process)} />
    {formProcess !== undefined && <ProcessForm process={formProcess ?? undefined} onClose={() => setFormProcess(undefined)} />}
  </div>
}
