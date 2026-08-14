import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppProvider } from './store/AppContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Processes } from './pages/Processes'
import { Operativa } from './pages/Operativa'
import { Kanban } from './pages/Kanban'
import { Alerts } from './pages/Alerts'
import { Catalogs } from './pages/Catalogs'
import { ImportExport } from './pages/ImportExport'
import { ProcessDetail } from './pages/ProcessDetail'
import { AuthGate } from './components/AuthGate'
import { useApp } from './store/AppContext'

// Rutas gerenciales (Vista ejecutiva del Director): solo gerencia/admin.
function ManagementRoute({ children }: { children: ReactNode }) {
  const { canAccessManagement } = useApp()
  return canAccessManagement ? children : <Navigate to="/operativa" replace />
}

// Vista operativa: el operador (no gerencial). El admin también puede entrar; el Director va a la suya.
function OperativeRoute({ children }: { children: ReactNode }) {
  const { canAccessManagement, role } = useApp()
  return !canAccessManagement || role === 'admin' ? children : <Navigate to="/" replace />
}

function HomeRoute() {
  const { canAccessManagement } = useApp()
  return canAccessManagement ? <Dashboard /> : <Navigate to="/operativa" replace />
}

function FallbackRoute() {
  const { canAccessManagement } = useApp()
  return <Navigate to={canAccessManagement ? '/' : '/operativa'} replace />
}

export default function App() {
  return <AuthGate><AppProvider><Layout><Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/operativa" element={<OperativeRoute><Operativa /></OperativeRoute>} />
    <Route path="/procesos" element={<ManagementRoute><Processes /></ManagementRoute>} />
    <Route path="/procesos/:id" element={<ProcessDetail />} />
    <Route path="/kanban" element={<ManagementRoute><Kanban /></ManagementRoute>} />
    <Route path="/alertas" element={<ManagementRoute><Alerts /></ManagementRoute>} />
    <Route path="/importar" element={<ManagementRoute><ImportExport /></ManagementRoute>} />
    <Route path="/catalogos" element={<ManagementRoute><Catalogs /></ManagementRoute>} />
    <Route path="*" element={<FallbackRoute />} />
  </Routes></Layout></AppProvider></AuthGate>
}
