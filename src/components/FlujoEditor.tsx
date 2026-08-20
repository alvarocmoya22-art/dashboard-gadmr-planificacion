import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Input } from './ui'
import { repairMojibake } from '../lib/utils'
import type { FlujoStep } from '../types'

// Convierte texto "1. Paso uno 2. Paso dos" en pasos del checklist.
export function textToSteps(text?: string): FlujoStep[] {
  const clean = repairMojibake(text ?? '').trim()
  if (!clean) return []
  const parts = clean.split(/\s*\d+[.)]\s*/).map((part) => part.trim()).filter(Boolean)
  const steps = parts.length ? parts : [clean]
  return steps.map((texto) => ({ texto, hecho: false }))
}

// Resumen en texto de los pasos, para que se siga viendo en la tarjeta ejecutiva.
export function stepsToText(flujo: FlujoStep[]): string {
  return flujo.map((step, index) => `${index + 1}. ${step.texto}`).join('  ')
}

// Checklist de "Próxima acción": agregar / marcar / quitar pasos. El avance se calcula solo.
export function FlujoEditor({ flujo, onChange }: { flujo: FlujoStep[]; onChange: (next: FlujoStep[]) => void }) {
  const [newStep, setNewStep] = useState('')
  const hasFlujo = flujo.length > 0
  const done = flujo.filter((step) => step.hecho).length
  const pct = hasFlujo ? Math.round((done / flujo.length) * 100) : 0
  const toggle = (index: number) => onChange(flujo.map((step, i) => (i === index ? { ...step, hecho: !step.hecho } : step)))
  const removeStep = (index: number) => onChange(flujo.filter((_, i) => i !== index))
  const addStep = () => {
    const texto = newStep.trim()
    if (!texto) return
    onChange([...flujo, { texto, hecho: false }])
    setNewStep('')
  }

  return <div className="flujo-field">
    <div className="flujo-head"><span>Próxima acción</span>{hasFlujo && <strong>{pct}% · {done}/{flujo.length}</strong>}</div>
    <div className="flujo-list">
      {flujo.map((step, index) => <label key={index} className={`flujo-step ${step.hecho ? 'done' : ''}`}>
        <input type="checkbox" checked={step.hecho} onChange={() => toggle(index)} />
        <span>{repairMojibake(step.texto)}</span>
        <button type="button" className="flujo-del" title="Quitar paso" onClick={() => removeStep(index)}>×</button>
      </label>)}
    </div>
    <div className="flujo-add">
      <Input value={newStep} onChange={(event) => setNewStep(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addStep() } }} placeholder="Agregar paso…" />
      <button type="button" className="button button-secondary" onClick={addStep}><Plus size={15} /> Agregar</button>
    </div>
    {hasFlujo && <small className="flujo-hint">El avance se calcula automáticamente según los pasos marcados.</small>}
  </div>
}
