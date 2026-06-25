import { useMemo, useState } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Process } from '../types'
import { Badge, Button, Input, Select } from './ui'
import { formatDate } from '../lib/utils'
import { useApp } from '../store/AppContext'

const helper = createColumnHelper<Process>()

export function ProcessTable({ onEdit }: { onEdit: (process: Process) => void }) {
  const { processes, deleteProcess, statuses, areas } = useApp()
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [area, setArea] = useState('')
  const navigate = useNavigate()
  const filtered = useMemo(() => processes.filter((process) => (!status || process.estado_id === status) && (!area || process.area_id === area)), [processes, status, area])
  const columns = useMemo(() => [
    helper.accessor('codigo_proceso', { header: 'Código', cell: ({ row, getValue }) => <button className="code-link" onClick={() => navigate(`/procesos/${row.original.id}`)}>{getValue()}</button> }),
    helper.accessor('nombre_proceso', { header: 'Proceso', cell: ({ row, getValue }) => <div className="process-cell"><strong>{getValue()}</strong><span>{row.original.responsable_principal}</span></div> }),
    helper.accessor((row) => row.area?.nombre ?? '', { id: 'area', header: 'Área', cell: (info) => <span className="muted-cell">{info.getValue()}</span> }),
    helper.accessor((row) => row.estado?.nombre ?? '', { id: 'estado', header: 'Estado', cell: ({ row, getValue }) => <Badge color={row.original.estado?.color}>{getValue()}</Badge> }),
    helper.accessor((row) => row.prioridad?.nombre ?? '', { id: 'prioridad', header: 'Prioridad', cell: ({ row, getValue }) => <Badge color={row.original.prioridad?.color}>{getValue()}</Badge> }),
    helper.accessor('porcentaje_avance', { header: 'Avance', cell: (info) => <div className="progress-cell"><div><i style={{ width: `${info.getValue()}%` }} /></div><span>{info.getValue()}%</span></div> }),
    helper.accessor('fecha_fin_programada', { header: 'Vencimiento', cell: ({ row, getValue }) => <div className="date-cell"><span className={`traffic traffic-${row.original.semaforo?.toLowerCase()}`} />{formatDate(getValue())}</div> }),
    helper.display({ id: 'actions', cell: ({ row }) => <div className="row-actions"><button onClick={() => onEdit(row.original)} title="Editar"><Pencil size={16} /></button><button onClick={() => confirm('¿Archivar este proceso?') && void deleteProcess(row.original.id)} title="Archivar"><Trash2 size={16} /></button><button title="Más acciones"><MoreHorizontal size={17} /></button></div> }),
  ], [navigate, onEdit, deleteProcess])
  const table = useReactTable({
    data: filtered, columns, state: { sorting, globalFilter: search },
    onSortingChange: setSorting, onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
  })

  return <div className="table-card">
    <div className="table-toolbar">
      <div className="table-search"><Search size={17} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en procesos…" /></div>
      <Select value={area} onChange={(event) => setArea(event.target.value)}><option value="">Todas las áreas</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
      <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option>{statuses.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
      <Button variant="ghost" onClick={() => { setSearch(''); setArea(''); setStatus('') }}>Limpiar</Button>
    </div>
    <div className="table-scroll"><table><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getCanSort() && <ArrowUpDown size={13} />}</th>)}</tr>)}</thead>
      <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
    </table></div>
    <div className="table-footer"><span>{table.getRowModel().rows.length} de {processes.length} procesos</span><span>Datos actualizados en tiempo real</span></div>
  </div>
}
