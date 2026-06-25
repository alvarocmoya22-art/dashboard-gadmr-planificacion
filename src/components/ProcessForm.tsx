import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { X } from 'lucide-react'
import { Button, Field, Input, Select, Textarea } from './ui'
import { useApp } from '../store/AppContext'
import type { Process, ProcessFormData } from '../types'
import { todayIso } from '../lib/utils'

const schema = z.object({
  area_id: z.string().min(1, 'Seleccione un área'),
  tipo_proceso_id: z.string().min(1, 'Seleccione un tipo'),
  nombre_proceso: z.string().min(4, 'Ingrese un nombre descriptivo'),
  responsable_principal: z.string().min(2, 'Ingrese el responsable'),
  responsable_secundario: z.string().optional(),
  fecha_inicio: z.string().min(1, 'Fecha obligatoria'),
  fecha_fin_programada: z.string().min(1, 'Fecha obligatoria'),
  fecha_fin_real: z.string().optional(),
  estado_id: z.string().min(1, 'Seleccione un estado'),
  prioridad_id: z.string().min(1, 'Seleccione una prioridad'),
  porcentaje_avance: z.number().min(0).max(100),
  dependencia_externa: z.string().optional(),
  documento_respaldo: z.string().optional(),
  proxima_accion: z.string().optional(),
  objetivo: z.string().optional(),
  observaciones: z.string().optional(),
  fecha_proxima_revision: z.string().optional(),
  requiere_accion_gerencial: z.boolean(),
  confidencialidad: z.enum(['Pública', 'Interna', 'Reservada']),
}).refine((data) => !data.fecha_inicio || !data.fecha_fin_programada || data.fecha_fin_programada >= data.fecha_inicio, {
  message: 'No puede ser anterior al inicio', path: ['fecha_fin_programada'],
})

export function ProcessForm({ process, onClose }: { process?: Process; onClose: () => void }) {
  const { areas, processTypes, statuses, priorities, saveProcess } = useApp()
  const form = useForm<ProcessFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      area_id: process?.area_id ?? '', tipo_proceso_id: process?.tipo_proceso_id ?? '',
      nombre_proceso: process?.nombre_proceso ?? '', responsable_principal: process?.responsable_principal ?? '',
      responsable_secundario: process?.responsable_secundario ?? '', fecha_inicio: process?.fecha_inicio ?? todayIso(),
      fecha_fin_programada: process?.fecha_fin_programada ?? '', fecha_fin_real: process?.fecha_fin_real ?? '',
      estado_id: process?.estado_id ?? statuses[0]?.id ?? '', prioridad_id: process?.prioridad_id ?? priorities[1]?.id ?? '',
      porcentaje_avance: process?.porcentaje_avance ?? 0, dependencia_externa: process?.dependencia_externa ?? '',
      documento_respaldo: process?.documento_respaldo ?? '', proxima_accion: process?.proxima_accion ?? '',
      objetivo: process?.objetivo ?? '', observaciones: process?.observaciones ?? '',
      fecha_proxima_revision: process?.fecha_proxima_revision ?? '', requiere_accion_gerencial: process?.requiere_accion_gerencial ?? false,
      confidencialidad: process?.confidencialidad ?? 'Interna',
    },
  })
  const progress = form.watch('porcentaje_avance')
  const statusId = form.watch('estado_id')
  const finalStatus = statuses.find((item) => item.nombre === 'Finalizado')

  useEffect(() => {
    if (Number(progress) === 100 && finalStatus && statusId !== finalStatus.id) {
      form.setValue('estado_id', finalStatus.id)
    }
  }, [progress])

  async function submit(data: ProcessFormData) {
    if (finalStatus && data.estado_id === finalStatus.id && !data.fecha_fin_real) data.fecha_fin_real = todayIso()
    await saveProcess(data, process)
    onClose()
  }

  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal-panel">
      <div className="modal-header"><div><p className="eyebrow">Registro institucional</p><h2>{process ? 'Editar proceso' : 'Nuevo proceso'}</h2></div><button onClick={onClose}><X /></button></div>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="form-grid">
          <Field label="Área responsable" error={form.formState.errors.area_id?.message}><Select {...form.register('area_id')}><option value="">Seleccionar…</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
          <Field label="Tipo de proceso" error={form.formState.errors.tipo_proceso_id?.message}><Select {...form.register('tipo_proceso_id')}><option value="">Seleccionar…</option>{processTypes.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
          <Field label="Nombre del proceso" className="span-2" error={form.formState.errors.nombre_proceso?.message}><Input {...form.register('nombre_proceso')} /></Field>
          <Field label="Responsable principal" error={form.formState.errors.responsable_principal?.message}><Input {...form.register('responsable_principal')} /></Field>
          <Field label="Responsable secundario"><Input {...form.register('responsable_secundario')} /></Field>
          <Field label="Fecha inicio" error={form.formState.errors.fecha_inicio?.message}><Input type="date" {...form.register('fecha_inicio')} /></Field>
          <Field label="Fecha fin programada" error={form.formState.errors.fecha_fin_programada?.message}><Input type="date" {...form.register('fecha_fin_programada')} /></Field>
          <Field label="Fecha fin real"><Input type="date" {...form.register('fecha_fin_real')} /></Field>
          <Field label="Próxima revisión"><Input type="date" {...form.register('fecha_proxima_revision')} /></Field>
          <Field label="Estado" error={form.formState.errors.estado_id?.message}><Select {...form.register('estado_id')}><option value="">Seleccionar…</option>{statuses.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
          <Field label="Prioridad" error={form.formState.errors.prioridad_id?.message}><Select {...form.register('prioridad_id')}><option value="">Seleccionar…</option>{priorities.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
          <Field label={`Avance · ${progress}%`} className="span-2" error={form.formState.errors.porcentaje_avance?.message}><Input type="range" min="0" max="100" {...form.register('porcentaje_avance', { valueAsNumber: true })} /></Field>
          <Field label="Dependencia externa"><Input {...form.register('dependencia_externa')} /></Field>
          <Field label="Documento respaldo / URL"><Input {...form.register('documento_respaldo')} /></Field>
          <Field label="Próxima acción" className="span-2"><Textarea {...form.register('proxima_accion')} /></Field>
          <Field label="Objetivo" className="span-2"><Textarea {...form.register('objetivo')} /></Field>
          <Field label="Observaciones" className="span-2"><Textarea {...form.register('observaciones')} /></Field>
          <Field label="Confidencialidad"><Select {...form.register('confidencialidad')}><option>Pública</option><option>Interna</option><option>Reservada</option></Select></Field>
          <label className="check-field"><input type="checkbox" {...form.register('requiere_accion_gerencial')} /><span>Requiere acción gerencial</span></label>
        </div>
        <div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={form.formState.isSubmitting}>{process ? 'Guardar cambios' : 'Crear proceso'}</Button></div>
      </form>
    </div>
  </div>
}
