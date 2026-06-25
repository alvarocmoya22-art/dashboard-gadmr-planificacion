import { Navigate, Route, Routes } from 'react-router-dom'
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

export default function App() {
  return <AuthGate><AppProvider><Layout><Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/procesos" element={<Processes />} />
    <Route path="/procesos/:id" element={<ProcessDetail />} />
    <Route path="/kanban" element={<Kanban />} />
    <Route path="/alertas" element={<Alerts />} />
    <Route path="/importar" element={<ImportExport />} />
    <Route path="/catalogos" element={<Catalogs />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Layout></AppProvider></AuthGate>
}
