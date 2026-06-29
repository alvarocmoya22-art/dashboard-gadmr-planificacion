import { useState } from 'react'
import { Download, Plus, SlidersHorizontal } from 'lucide-react'
import { Button } from '../components/ui'
import { ProcessTable } from '../components/ProcessTable'
import { ProcessForm } from '../components/ProcessForm'
import type { Process } from '../types'
import { exportProcessesToXlsx } from '../services/export'
import { useApp } from '../store/AppContext'
import { canCreateProcesses, canExportReports } from '../lib/permissions'

export function Processes() {
  const [formProcess, setFormProcess] = useState<Process | null | undefined>(undefined)
  const { processes, role } = useApp()
  return <div>
    <div className="page-actions"><div className="view-tabs"><button className="active">Todos los procesos</button><button><SlidersHorizontal size={15} /> Mis filtros</button></div><div>{canExportReports(role) && <Button variant="secondary" onClick={() => exportProcessesToXlsx(processes)}><Download size={17} /> Exportar</Button>}{canCreateProcesses(role) && <Button onClick={() => setFormProcess(null)}><Plus size={17} /> Nuevo proceso</Button>}</div></div>
    <ProcessTable onEdit={(process) => setFormProcess(process)} />
    {formProcess !== undefined && <ProcessForm process={formProcess ?? undefined} onClose={() => setFormProcess(undefined)} />}
  </div>
}
