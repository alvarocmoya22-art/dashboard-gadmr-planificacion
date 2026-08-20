import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Field, Input, Select, Textarea } from './ui'
import { useApp } from '../store/AppContext'
import type { Process, ProcessFormData } from '../types'
import { repairMojibake, todayIso } from '../lib/utils'

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
  egob_numero: z.string().optional(),
  egob_url: z.string().optional(),
  egob_estado: z.string().optional(),
  egob_responsable_actual: z.string().optional(),
  egob_ultimo_movimiento: z.string().optional(),
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
  const { areas, processTypes, statuses, priorities, saveProcess, addComment } = useApp()
  const [initialComment, setInitialComment] = useState('')
  const form = useForm<ProcessFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      area_id: process?.area_id ?? '', tipo_proceso_id: process?.tipo_proceso_id ?? '',
      nombre_proceso: repairMojibake(process?.nombre_proceso ?? ''), responsable_principal: repairMojibake(process?.responsable_principal ?? ''),
      responsable_secundario: repairMojibake(process?.responsable_secundario ?? ''), fecha_inicio: process?.fecha_inicio ?? todayIso(),
      fecha_fin_programada: process?.fecha_fin_programada ?? '', fecha_fin_real: process?.fecha_fin_real ?? '',
      estado_id: process?.estado_id ?? statuses[0]?.id ?? '', prioridad_id: process?.prioridad_id ?? priorities[1]?.id ?? '',
      porcentaje_avance: process?.porcentaje_avance ?? 0, dependencia_externa: repairMojibake(process?.dependencia_externa ?? ''),
      documento_respaldo: repairMojibake(process?.documento_respaldo ?? ''), proxima_accion: repairMojibake(process?.proxima_accion ?? ''),
      egob_numero: process?.egob_numero ?? '', egob_url: process?.egob_url ?? '',
      egob_estado: repairMojibake(process?.egob_estado ?? ''), egob_responsable_actual: repairMojibake(process?.egob_responsable_actual ?? ''),
      egob_ultimo_movimiento: repairMojibake(process?.egob_ultimo_movimiento ?? ''),
      objetivo: repairMojibake(process?.objetivo ?? ''), observaciones: repairMojibake(process?.observaciones ?? ''),
      fecha_proxima_revision: process?.fecha_proxima_revision ?? '', requiere_accion_gerencial: process?.requiere_accion_gerencial ?? false,
      confidencialidad: process?.confidencialidad ?? 'Interna',
    },
  })
  const progress = form.watch('porcentaje_avance')
  const statusId = form.watch('estado_id')
  const finalStatus = statuses.find((item) => repairMojibake(item.nombre) === 'Finalizado')

  useEffect(() => {
    if (Number(progress) === 100 && finalStatus && statusId !== finalStatus.id) {
      form.setValue('estado_id', finalStatus.id)
    }
  }, [progress, finalStatus, statusId, form])

  async function submit(data: ProcessFormData) {
    try {
      if (finalStatus && data.estado_id === finalStatus.id && !data.fecha_fin_real) data.fecha_fin_real = todayIso()
      const saved = await saveProcess(data, process)
      if (!process && initialComment.trim() && saved) {
        try { await addComment(saved.id, initialComment) } catch { /* el trámite ya se creó; el comentario es opcional */ }
      }
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el trámite.')
    }
  }

  function showValidationHelp() {
    toast.error('Faltan campos obligatorios. Revisa área, tipo, nombre, responsable y fecha fin programada.')
    document.querySelector('.modal-panel')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal-panel">
      <div className="modal-header"><div><p className="eyebrow">Registro institucional</p><h2>{process ? 'Editar trámite' : 'Nuevo trámite'}</h2></div><button onClick={onClose}><X /></button></div>
      <form onSubmit={form.handleSubmit(submit, showValidationHelp)}>
        <div className="form-grid">
          <Field label="Área responsable *" error={form.formState.errors.area_id?.message}><Select {...form.register('area_id')}><option value="">Seleccionar…</option>{areas.map((item) => <option key={item.id} value={item.id}>{repairMojibake(item.nombre)}</option>)}</Select></Field>
          <Field label="Tipo de trámite *" error={form.formState.errors.tipo_proceso_id?.message}><Select {...form.register('tipo_proceso_id')}><option value="">Seleccionar…</option>{processTypes.map((item) => <option key={item.id} value={item.id}>{repairMojibake(item.nombre)}</option>)}</Select></Field>
          <Field label="Nombre del trámite *" className="span-2" error={form.formState.errors.nombre_proceso?.message}><Input {...form.register('nombre_proceso')} /></Field>
          <Field label="Responsable principal *" error={form.formState.errors.responsable_principal?.message}><Input {...form.register('responsable_principal')} /></Field>
          <Field label="Responsable secundario"><Input {...form.register('responsable_secundario')} /></Field>
          <Field label="Fecha inicio *" error={form.formState.errors.fecha_inicio?.message}><Input type="date" {...form.register('fecha_inicio')} /></Field>
          <Field label="Fecha fin programada *" error={form.formState.errors.fecha_fin_programada?.message}><Input type="date" {...form.register('fecha_fin_programada')} /></Field>
          <Field label="Fecha fin real"><Input type="date" {...form.register('fecha_fin_real')} /></Field>
          <Field label="Próxima revisión"><Input type="date" {...form.register('fecha_proxima_revision')} /></Field>
          <Field label="Estado" error={form.formState.errors.estado_id?.message}><Select {...form.register('estado_id')}><option value="">Seleccionar…</option>{statuses.map((item) => <option key={item.id} value={item.id}>{repairMojibake(item.nombre)}</option>)}</Select></Field>
          <Field label="Prioridad" error={form.formState.errors.prioridad_id?.message}><Select {...form.register('prioridad_id')}><option value="">Seleccionar…</option>{priorities.map((item) => <option key={item.id} value={item.id}>{repairMojibake(item.nombre)}</option>)}</Select></Field>
          <Field label={`Avance · ${progress}%`} className="span-2" error={form.formState.errors.porcentaje_avance?.message}><Input type="range" min="0" max="100" {...form.register('porcentaje_avance', { valueAsNumber: true })} /></Field>
          <Field label="Nro. trámite eGob / eDoc"><Input placeholder="Ej. 970395" {...form.register('egob_numero')} /></Field>
          <Field label="URL eGob / eDoc"><Input placeholder="https://egobedoc.gadmriobamba.gob.ec:8081/issues/970395" {...form.register('egob_url')} /></Field>
          <Field label="Estado eGob"><Input placeholder="Ej. Nuevo, Reasignado, Archivado" {...form.register('egob_estado')} /></Field>
          <Field label="Actualmente con"><Input placeholder="Persona o unidad responsable en eGob" {...form.register('egob_responsable_actual')} /></Field>
          <Field label="Último movimiento eGob"><Input placeholder="Ej. 2026-06-08 16:04" {...form.register('egob_ultimo_movimiento')} /></Field>
          <Field label="Próxima acción" className="span-2"><Textarea {...form.register('proxima_accion')} /></Field>
          <Field label="Objetivo" className="span-2"><Textarea {...form.register('objetivo')} /></Field>
          <Field label="Observaciones" className="span-2"><Textarea {...form.register('observaciones')} /></Field>
          {!process && <Field label="Comentario interno (opcional)" className="span-2"><Textarea value={initialComment} onChange={(event) => setInitialComment(event.target.value)} placeholder="Deja un comentario inicial para este trámite…" /></Field>}
        </div>
        <div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={form.formState.isSubmitting}>{process ? 'Guardar cambios' : 'Crear trámite'}</Button></div>
      </form>
    </div>
  </div>
}
