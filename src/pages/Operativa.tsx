import { useState } from 'react'
import { Download, Plus, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui'
import { ProcessTable } from '../components/ProcessTable'
import { ProcessForm } from '../components/ProcessForm'
import { useApp } from '../store/AppContext'
import { canCreateProcesses } from '../lib/permissions'
import { exportProcessesToXlsx } from '../services/export'
import type { Process } from '../types'

// Vista operativa = lista/tabla de trámites (igual que "Gestión de trámites"):
// buscar, filtrar por área/estado, editar/eliminar y crear.
export function Operativa() {
  const { role, userEmail, processes } = useApp()
  const [view, setView] = useState<'active' | 'review'>('review')
  // undefined = cerrado · null = nuevo trámite · Process = editar ese trámite
  const [formProcess, setFormProcess] = useState<Process | null | undefined>(undefined)
  const canCreate = canCreateProcesses(role, userEmail)

  function downloadBackup() {
    if (!processes.length) { toast.info('No hay trámites para descargar.'); return }
    const fecha = new Date().toISOString().slice(0, 10)
    exportProcessesToXlsx(processes, `respaldo-tramites-${fecha}.xlsx`)
    toast.success(`Descargando ${processes.length} trámites`)
  }

  return <div>
    <div className="page-actions">
      <div className="view-tabs">
        <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><SlidersHorizontal size={15} /> Pendientes de revisión</button>
        <button className={view === 'active' ? 'active' : ''} onClick={() => setView('active')}>Trámites activos</button>
      </div>
      <div className="page-actions-right">
        <Button variant="ghost" onClick={downloadBackup} title="Descargar todos los trámites en Excel"><Download size={16} /> Descargar Excel</Button>
        {canCreate && <Button onClick={() => setFormProcess(null)}><Plus size={17} /> Nuevo trámite</Button>}
      </div>
    </div>
    <ProcessTable view={view} onEdit={(process) => setFormProcess(process)} />
    {formProcess !== undefined && <ProcessForm process={formProcess ?? undefined} onClose={() => setFormProcess(undefined)} />}
  </div>
}
