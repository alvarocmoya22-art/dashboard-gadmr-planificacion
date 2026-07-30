import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BookOpen, ChartNoAxesCombined, ChevronLeft, FileUp, KanbanSquare, LayoutDashboard, LogOut, Menu, Search, Settings2, TableProperties, X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn, formatDate, repairMojibake, todayIso } from '../lib/utils'
import { supabase } from '../lib/supabase'

const nav = [
  { to: '/', label: 'Vista ejecutiva', icon: LayoutDashboard },
  { to: '/procesos', label: 'Vista operativa', icon: TableProperties },
  { to: '/kanban', label: 'Kanban', icon: KanbanSquare },
  { to: '/alertas', label: 'Alertas', icon: Bell },
  { to: '/importar', label: 'Importar / exportar', icon: FileUp },
  { to: '/catalogos', label: 'Catálogos', icon: BookOpen },
]

const titles: Record<string, [string, string]> = {
  '/': ['Vista ejecutiva del Director', 'Resumen gerencial del portafolio, movimientos eGob, comentarios internos y próximos puntos de seguimiento.'],
  '/procesos': ['Gestión de trámites', 'Consulta, filtra y actualiza la matriz de trámites institucionales.'],
  '/kanban': ['Flujo institucional', 'Los trámites organizados por su estado actual.'],
  '/alertas': ['Atención requerida', 'Prioridades, retrasos y vacíos de gestión para resolver hoy.'],
  '/importar': ['Datos y reportes', 'Importa matrices de seguimiento y genera entregables gerenciales.'],
  '/catalogos': ['Configuración institucional', 'Administra áreas, tipos, estados y prioridades.'],
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [seenNotifications, setSeenNotifications] = useState(() => Number(localStorage.getItem('status-notifications-seen') || 0))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { demoMode, userName, role, canAccessManagement, globalSearch, setGlobalSearch, logs, processes, statuses } = useApp()
  const visibleNav = canAccessManagement ? nav : nav.filter((item) => item.to === '/procesos')
  const [title, description] = titles[pathname] ?? ['Detalle del trámite', 'Trazabilidad completa del trámite institucional.']
  const showGlobalSearch = pathname === '/procesos'
  const signOut = async () => { await supabase?.auth.signOut() }

  const notifications = useMemo(() => {
    const statusItems = logs
      .filter((item) => item.campo === 'estado_id')
      .slice(0, 6)
      .map((item) => {
        const process = processes.find((processItem) => processItem.id === item.process_id)
        const oldStatus = repairMojibake(statuses.find((status) => status.id === String(item.valor_anterior ?? ''))?.nombre ?? 'Sin estado')
        const newStatus = repairMojibake(statuses.find((status) => status.id === String(item.valor_nuevo ?? ''))?.nombre ?? 'Sin estado')
        return {
          id: item.id,
          process,
          title: 'Cambio de estado',
          detail: `${oldStatus} → ${newStatus}`,
          created_at: item.created_at,
        }
      })

    const egobItems = logs
      .filter((item) => String(item.campo).startsWith('egob_'))
      .slice(0, 6)
      .map((item) => {
        const process = processes.find((processItem) => processItem.id === item.process_id)
        return {
          id: item.id,
          process,
          title: 'Movimiento eGob detectado',
          detail: `${repairMojibake(String(item.valor_anterior ?? 'Pendiente'))} → ${repairMojibake(String(item.valor_nuevo ?? 'Actualizado'))}`,
          created_at: item.created_at,
        }
      })

    const reviewItems = processes
      .filter((process) => repairMojibake(process.estado?.nombre ?? '') !== 'Finalizado' && Boolean(process.fecha_proxima_revision) && String(process.fecha_proxima_revision) <= todayIso())
      .slice(0, 6)
      .map((process) => ({
        id: `review-${process.id}`,
        process,
        title: 'Revisión interna pendiente',
        detail: `Próxima revisión: ${formatDate(process.fecha_proxima_revision)}`,
        created_at: process.fecha_proxima_revision || process.updated_at,
      }))

    return [...reviewItems, ...egobItems, ...statusItems].slice(0, 12)
  }, [logs, processes, statuses])

  const unreadNotifications = Math.max(0, notifications.length - seenNotifications)

  function toggleNotifications() {
    setNotificationsOpen((value) => !value)
    const nextSeen = notifications.length
    setSeenNotifications(nextSeen)
    localStorage.setItem('status-notifications-seen', String(nextSeen))
  }

  return <div className="app-shell">
    <aside className={cn('sidebar', collapsed && 'sidebar-collapsed', open && 'sidebar-open')}>
      <div className="brand">
        <div className="brand-mark"><img src="/gadmr-logo.png" alt="GADMR Riobamba" /></div>
        {!collapsed && <div className="brand-copy"><strong>GADMR Riobamba</strong><small>Planificación, Hábitat y Desarrollo Urbanístico</small></div>}
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
        {showGlobalSearch ? <div className="global-search"><Search size={18} /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar trámite, código o responsable…" /></div> : <div />}
        <div className="top-actions">
          <div className="notification-wrap">
            <button title="Notificaciones" className="notification-button" onClick={toggleNotifications}><Bell size={19} />{unreadNotifications > 0 && <i />}</button>
            {notificationsOpen && <div className="notification-panel">
              <header><strong>Notificaciones</strong><span>{notifications.length} novedades</span></header>
              {notifications.length ? notifications.map((item) => <button key={item.id} className="notification-row" onClick={() => { setNotificationsOpen(false); if (item.process) navigate(`/procesos/${item.process.id}`) }}>
                <span>{item.title} · {item.process?.codigo_proceso ?? 'Trámite'}</span>
                <strong>{repairMojibake(item.process?.nombre_proceso ?? 'Trámite actualizado')}</strong>
                <small>{repairMojibake(item.detail)}</small>
                <em>{new Date(item.created_at).toLocaleString('es-EC')}</em>
              </button>) : <p>No hay novedades registradas todavía.</p>}
            </div>}
          </div>
          <div className="user-chip"><div className="avatar">AG</div><div><strong>{userName}</strong><small>{role}</small></div></div>
          {!demoMode && <button title="Cerrar sesión" onClick={signOut} className="logout-button"><LogOut size={18} /><span>Salir</span></button>}
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
