import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppProvider } from './store/AppContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Processes } from './pages/Processes'
import { Kanban } from './pages/Kanban'
import { Alerts } from './pages/Alerts'
import { Catalogs } from './pages/Catalogs'
import { ImportExport } from './pages/ImportExport'
import { ProcessDetail } from './pages/ProcessDetail'
import { AuthGate } from './components/AuthGate'
import { useApp } from './store/AppContext'

function ManagementRoute({ children }: { children: ReactNode }) {
  const { canAccessManagement } = useApp()
  return canAccessManagement ? children : <Navigate to="/procesos" replace />
}

function HomeRoute() {
  const { canAccessManagement } = useApp()
  return canAccessManagement ? <Dashboard /> : <Navigate to="/procesos" replace />
}

function FallbackRoute() {
  const { canAccessManagement } = useApp()
  return <Navigate to={canAccessManagement ? '/' : '/procesos'} replace />
}

export default function App() {
  return <AuthGate><AppProvider><Layout><Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/procesos" element={<Processes />} />
    <Route path="/procesos/:id" element={<ProcessDetail />} />
    <Route path="/kanban" element={<ManagementRoute><Kanban /></ManagementRoute>} />
    <Route path="/alertas" element={<ManagementRoute><Alerts /></ManagementRoute>} />
    <Route path="/importar" element={<ManagementRoute><ImportExport /></ManagementRoute>} />
    <Route path="/catalogos" element={<ManagementRoute><Catalogs /></ManagementRoute>} />
    <Route path="*" element={<FallbackRoute />} />
  </Routes></Layout></AppProvider></AuthGate>
}
