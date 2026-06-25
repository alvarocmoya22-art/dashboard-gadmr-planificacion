import { useState } from 'react'
import { Building2, CircleDot, Flag, Layers3, Plus } from 'lucide-react'
import { Button, Card, Input } from '../components/ui'
import { useApp } from '../store/AppContext'
import type { CatalogItem } from '../types'

export function Catalogs() {
  const app = useApp()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const catalogs: Array<{ key: 'areas' | 'processTypes' | 'statuses' | 'priorities'; title: string; icon: typeof Building2; items: CatalogItem[] }> = [
    { key: 'areas', title: 'Áreas responsables', icon: Building2, items: app.areas },
    { key: 'processTypes', title: 'Tipos de proceso', icon: Layers3, items: app.processTypes },
    { key: 'statuses', title: 'Estados', icon: CircleDot, items: app.statuses },
    { key: 'priorities', title: 'Prioridades', icon: Flag, items: app.priorities },
  ]
  return <div className="catalog-grid">{catalogs.map(({ key, title, icon: Icon, items }) => <Card className="catalog-card" key={key}><header><div><Icon size={20} /><h2>{title}</h2></div><span>{items.length}</span></header><div className="catalog-list">{items.map((item) => <div key={item.id}>{item.color && <i style={{ background: item.color }} />}<span>{item.nombre}</span><small>Activo</small></div>)}</div><form onSubmit={(event) => { event.preventDefault(); const name = drafts[key]?.trim(); if (name) { app.addCatalogItem(key, name); setDrafts((old) => ({ ...old, [key]: '' })) } }}><Input value={drafts[key] ?? ''} onChange={(event) => setDrafts((old) => ({ ...old, [key]: event.target.value }))} placeholder="Nuevo elemento…" /><Button type="submit" title="Agregar"><Plus size={17} /></Button></form></Card>)}</div>
}
