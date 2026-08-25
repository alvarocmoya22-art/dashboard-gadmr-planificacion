import { useMemo, useState } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, CheckCircle2, ExternalLink, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Process } from '../types'
import { Badge, Button, Input, Select } from './ui'
import { formatDate, normalizeText, repairMojibake } from '../lib/utils'
import { useApp } from '../store/AppContext'
import { canEditProcesses } from '../lib/permissions'
import { getEgobIssueNumber, getEgobIssueUrl } from '../lib/egob'

const helper = createColumnHelper<Process>()

type ProcessTableFilter = 'active' | 'review'
type ProcessTableProps = {
  onEdit: (process: Process) => void
  view?: ProcessTableFilter
  processesOverride?: Process[]
}

function isFinalized(process: Process) {
  return repairMojibake(process.estado?.nombre) === 'Finalizado'
}

export function ProcessTable({ onEdit, view = 'active', processesOverride }: ProcessTableProps) {
  const { processes, deleteProcess, markReviewed, isPendingReview, reviewComment, statuses, areas, role, userEmail, globalSearch, setGlobalSearch } = useApp()
  const sourceProcesses = processesOverride ?? processes
  const [sorting, setSorting] = useState<SortingState>([])
  const [status, setStatus] = useState('')
  const [area, setArea] = useState('')
  const navigate = useNavigate()
  const search = globalSearch
  const filtered = useMemo(() => {
    const query = normalizeText(search).toLocaleLowerCase('es')
    return sourceProcesses.filter((process) => {
      if (isFinalized(process)) return false
      if (view === 'review' && !isPendingReview(process)) return false
      const matchesFilters = (!status || process.estado_id === status) && (!area || process.area_id === area)
      if (!matchesFilters) return false
      if (!query) return true
      const text = [
        process.codigo_proceso,
        repairMojibake(process.nombre_proceso),
        repairMojibake(process.responsable_principal),
        repairMojibake(process.responsable_secundario),
        repairMojibake(process.area?.nombre),
        repairMojibake(process.estado?.nombre),
        repairMojibake(process.prioridad?.nombre),
        repairMojibake(process.documento_respaldo),
        process.egob_numero,
        repairMojibake(process.egob_responsable_actual),
        repairMojibake(process.proxima_accion),
        repairMojibake(process.objetivo),
        repairMojibake(process.observaciones),
      ].map(normalizeText).join(' ').toLocaleLowerCase('es')
      return text.includes(query)
    })
  }, [sourceProcesses, status, area, search, view, isPendingReview])
  const columns = useMemo(() => {
    const reviewColumns = view === 'review' ? [
      helper.accessor('fecha_proxima_revision', { id: 'proxima', header: 'Próx. revisión', cell: ({ getValue }) => <span className="muted-cell">{getValue() ? formatDate(getValue() as string) : '—'}</span> }),
      helper.display({ id: 'ultimoComentario', header: 'Último comentario', cell: ({ row }) => {
        const c = reviewComment(row.original.id, 'operativa')
        if (!c) return <span className="muted-cell">—</span>
        return <div className="comment-cell"><span>{repairMojibake(c.contenido)}</span><small>{repairMojibake(c.usuario || '')} · {formatDate(c.created_at)}</small></div>
      } }),
    ] : []
    return [
      helper.accessor('codigo_proceso', { header: 'Código', cell: ({ row, getValue }) => <button className="code-link" onClick={() => navigate(`/procesos/${row.original.id}`)}>{getValue()}</button> }),
      helper.accessor('nombre_proceso', { header: 'Trámite', cell: ({ row, getValue }) => <div className="process-cell"><strong>{repairMojibake(getValue())}</strong><span>{repairMojibake(row.original.responsable_principal)}</span></div> }),
      helper.accessor((row) => row.area?.nombre ?? '', { id: 'area', header: 'Área', cell: (info) => <span className="muted-cell area-cell" title={repairMojibake(info.getValue())}>{repairMojibake(info.getValue())}</span> }),
      helper.accessor((row) => row.estado?.nombre ?? '', { id: 'estado', header: 'Estado', cell: ({ row, getValue }) => <Badge color={row.original.estado?.color}>{repairMojibake(getValue())}</Badge> }),
      helper.accessor((row) => row.prioridad?.nombre ?? '', { id: 'prioridad', header: 'Prioridad', cell: ({ row, getValue }) => <Badge color={row.original.prioridad?.color}>{repairMojibake(getValue())}</Badge> }),
      helper.accessor('porcentaje_avance', { header: 'Avance', cell: (info) => <div className="progress-cell"><div><i style={{ width: `${info.getValue()}%` }} /></div><span>{info.getValue()}%</span></div> }),
      helper.accessor('fecha_fin_programada', { header: 'Vencimiento', cell: ({ row, getValue }) => <div className="date-cell"><span className={`traffic traffic-${row.original.semaforo?.toLowerCase()}`} />{formatDate(getValue())}</div> }),
      ...reviewColumns,
      helper.display({ id: 'egob', header: 'eGob', cell: ({ row }) => {
        const issueNumber = getEgobIssueNumber(row.original)
        const issueUrl = getEgobIssueUrl(row.original)
        return issueUrl ? <a className="egob-link" href={issueUrl} target="_blank" rel="noreferrer" title={`Abrir trámite eGob ${issueNumber}`}><ExternalLink size={14} /> {issueNumber}</a> : <span className="muted-cell">—</span>
      } }),
      helper.display({ id: 'actions', cell: ({ row }) => <div className="row-actions">{canEditProcesses(role, userEmail) && view === 'review' && <button className="review-done" onClick={() => void markReviewed(row.original.id)} title="Marcar como revisado (lo oculta de Pendientes por hoy)"><CheckCircle2 size={16} /> Revisado</button>}{canEditProcesses(role, userEmail) && <button onClick={() => onEdit(row.original)} title="Editar"><Pencil size={16} /></button>}{role === 'admin' && <button onClick={() => confirm('¿Archivar este trámite?') && void deleteProcess(row.original.id)} title="Archivar"><Trash2 size={16} /></button>}<button title="Más acciones"><MoreHorizontal size={17} /></button></div> }),
    ]
  }, [navigate, onEdit, deleteProcess, markReviewed, reviewComment, role, userEmail, view])
  const table = useReactTable({
    data: filtered, columns, state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
  })

  return <div className="table-card">
    <div className="table-toolbar">
      <div className="table-search"><Search size={17} /><Input value={search} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar en trámites…" /></div>
      <Select value={area} onChange={(event) => setArea(event.target.value)}><option value="">Todas las áreas</option>{areas.map((item) => <option key={item.id} value={item.id}>{repairMojibake(item.nombre)}</option>)}</Select>
      <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option>{statuses.map((item) => <option key={item.id} value={item.id}>{repairMojibake(item.nombre)}</option>)}</Select>
      <Button variant="ghost" onClick={() => { setGlobalSearch(''); setArea(''); setStatus('') }}>Limpiar</Button>
    </div>
    <div className="table-scroll"><table><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getCanSort() && <ArrowUpDown size={13} />}</th>)}</tr>)}</thead>
      <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
    </table></div>
    <div className="table-footer"><span>{table.getRowModel().rows.length} trámites activos visibles</span><span>{view === 'review' ? 'Mostrando revisiones vencidas o para hoy' : 'Los finalizados quedan fuera de la tabla operativa'}</span></div>
  </div>
}
