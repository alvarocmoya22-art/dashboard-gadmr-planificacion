import { useState } from 'react'
import { Building2, Check, CircleDot, Flag, Layers3, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button, Card, Input } from '../components/ui'
import { useApp } from '../store/AppContext'
import { repairMojibake } from '../lib/utils'
import type { CatalogItem } from '../types'

export function Catalogs() {
  const app = useApp()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<{ key: 'areas' | 'processTypes' | 'statuses' | 'priorities'; id: string; value: string } | null>(null)
  const catalogs: Array<{ key: 'areas' | 'processTypes' | 'statuses' | 'priorities'; title: string; icon: typeof Building2; items: CatalogItem[] }> = [
    { key: 'areas', title: 'Áreas responsables', icon: Building2, items: app.areas },
    { key: 'processTypes', title: 'Tipos de trámite', icon: Layers3, items: app.processTypes },
    { key: 'statuses', title: 'Estados', icon: CircleDot, items: app.statuses },
    { key: 'priorities', title: 'Prioridades', icon: Flag, items: app.priorities },
  ]
  return <div className="catalog-grid">{catalogs.map(({ key, title, icon: Icon, items }) => <Card className="catalog-card" key={key}><header><div><Icon size={20} /><h2>{title}</h2></div><span>{items.length}</span></header><div className="catalog-list">{items.map((item) => {
    const isEditing = editing?.key === key && editing.id === item.id
    return <div key={item.id}>{item.color && <i style={{ background: item.color }} />}{isEditing ? <Input className="catalog-edit-input" value={editing.value} autoFocus onChange={(event) => setEditing({ key, id: item.id, value: event.target.value })} /> : <span>{repairMojibake(item.nombre)}</span>}<small>Activo</small><div className="catalog-actions">{isEditing ? <><Button type="button" variant="ghost" title="Guardar" onClick={() => void app.updateCatalogItem(key, item.id, editing.value).then(() => setEditing(null))}><Check size={14} /></Button><Button type="button" variant="ghost" title="Cancelar" onClick={() => setEditing(null)}><X size={14} /></Button></> : <><Button type="button" variant="ghost" title="Editar" onClick={() => setEditing({ key, id: item.id, value: repairMojibake(item.nombre) })}><Pencil size={14} /></Button><Button type="button" variant="danger" title="Eliminar / archivar" onClick={() => { if (confirm(`¿Archivar "${repairMojibake(item.nombre)}"?`)) void app.deleteCatalogItem(key, item.id) }}><Trash2 size={14} /></Button></>}</div></div>
  })}</div><form onSubmit={(event) => { event.preventDefault(); const name = drafts[key]?.trim(); if (name) { void app.addCatalogItem(key, name).then(() => setDrafts((old) => ({ ...old, [key]: '' }))) } }}><Input value={drafts[key] ?? ''} onChange={(event) => setDrafts((old) => ({ ...old, [key]: event.target.value }))} placeholder="Nuevo elemento…" /><Button type="submit" title="Agregar"><Plus size={17} /></Button></form></Card>)}</div>
}
