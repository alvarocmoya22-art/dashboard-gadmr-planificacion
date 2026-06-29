import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bell, BookOpen, ChartNoAxesCombined, ChevronLeft, FileUp, KanbanSquare, LayoutDashboard, Menu, Moon, Search, Settings2, TableProperties, X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn } from '../lib/utils'

const nav = [
  { to: '/', label: 'Vista ejecutiva', icon: LayoutDashboard },
  { to: '/procesos', label: 'Vista operativa', icon: TableProperties },
  { to: '/kanban', label: 'Kanban', icon: KanbanSquare },
  { to: '/alertas', label: 'Alertas', icon: Bell },
  { to: '/importar', label: 'Importar / exportar', icon: FileUp },
  { to: '/catalogos', label: 'Catálogos', icon: BookOpen },
]

const titles: Record<string, [string, string]> = {
  '/': ['Centro gerencial', 'Una lectura clara de lo que avanza, lo que vence y lo que necesita decisión.'],
  '/procesos': ['Gestión de procesos', 'Consulta, filtra y actualiza el portafolio institucional.'],
  '/kanban': ['Flujo institucional', 'Los procesos organizados por su estado actual.'],
  '/alertas': ['Atención requerida', 'Prioridades, retrasos y vacíos de gestión para resolver hoy.'],
  '/importar': ['Datos y reportes', 'Importa la base inicial y genera entregables gerenciales.'],
  '/catalogos': ['Configuración institucional', 'Administra áreas, tipos, estados y prioridades.'],
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()
  const { demoMode, userName, role, canAccessManagement } = useApp()
  const visibleNav = canAccessManagement ? nav : nav.filter((item) => item.to === '/procesos')
  const [title, description] = titles[pathname] ?? ['Detalle del proceso', 'Trazabilidad completa del proceso institucional.']

  return <div className="app-shell">
    <aside className={cn('sidebar', collapsed && 'sidebar-collapsed', open && 'sidebar-open')}>
      <div className="brand">
        <div className="brand-mark"><img src="/rdr-icon.png" alt="EP Rutas de Riobamba" /></div>
        {!collapsed && <div><strong>Rutas de Riobamba</strong><small>Empresa Pública de Movilidad</small></div>}
        <button className="mobile-close" onClick={() => setOpen(false)}><X size={20} /></button>
      </div>
      <nav>
        <p className="nav-label">{collapsed ? '•••' : 'Navegación'}</p>
        {visibleNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => cn('nav-item', isActive && 'active')}>
          <Icon size={19} /><span>{label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-foot">
        {!collapsed && <div className="system-health"><span /><div><strong>Sistema operativo</strong><small>{demoMode ? 'Modo demostración' : 'Conectado a Supabase'}</small></div></div>}
        <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}><ChevronLeft size={18} /><span>Contraer</span></button>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setOpen(true)}><Menu size={22} /></button>
        <div className="global-search"><Search size={18} /><input placeholder="Buscar proceso, código o responsable…" /></div>
        <div className="top-actions">
          <button title="Modo oscuro"><Moon size={19} /></button>
          <button title="Notificaciones" className="notification-button"><Bell size={19} /><i /></button>
          <div className="user-chip"><div className="avatar">AG</div><div><strong>{userName}</strong><small>{role}</small></div></div>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div><p className="eyebrow"><ChartNoAxesCombined size={15} /> Gestión institucional</p><h1>{title}</h1><p>{description}</p></div>
          {demoMode && <div className="demo-pill"><Settings2 size={15} /> Demo local · configura Supabase para producción</div>}
        </div>
        {children}
      </main>
    </div>
  </div>
}
