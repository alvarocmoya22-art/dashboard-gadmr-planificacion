import { useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { Button } from '../components/ui'
import { ProcessTable } from '../components/ProcessTable'
import { ProcessForm } from '../components/ProcessForm'
import { useApp } from '../store/AppContext'
import { canCreateProcesses } from '../lib/permissions'
import type { Process } from '../types'

// Vista operativa = lista/tabla de trámites (igual que "Gestión de trámites"):
// buscar, filtrar por área/estado, editar/eliminar y crear.
export function Operativa() {
  const { role, userEmail } = useApp()
  const [view, setView] = useState<'active' | 'review'>('active')
  // undefined = cerrado · null = nuevo trámite · Process = editar ese trámite
  const [formProcess, setFormProcess] = useState<Process | null | undefined>(undefined)
  const canCreate = canCreateProcesses(role, userEmail)

  return <div>
    <div className="page-actions">
      <div className="view-tabs">
        <button className={view === 'active' ? 'active' : ''} onClick={() => setView('active')}>Trámites activos</button>
        <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><SlidersHorizontal size={15} /> Pendientes de revisión</button>
      </div>
      {canCreate && <Button onClick={() => setFormProcess(null)}><Plus size={17} /> Nuevo trámite</Button>}
    </div>
    <ProcessTable view={view} onEdit={(process) => setFormProcess(process)} />
    {formProcess !== undefined && <ProcessForm process={formProcess ?? undefined} onClose={() => setFormProcess(undefined)} />}
  </div>
}
