import { useState } from 'react'
import { Download, FileDown, FileSpreadsheet, FileText, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Card, Button, Badge } from '../components/ui'
import { useApp } from '../store/AppContext'
import { parseProcessWorkbook } from '../services/import'
import { exportProcessesToPdf, exportProcessesToXlsx } from '../services/export'
import type { ProcessFormData } from '../types'

export function ImportExport() {
  const app = useApp()
  const [preview, setPreview] = useState<ProcessFormData[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  async function pick(file?: File) {
    if (!file) return
    try {
      const result = await parseProcessWorkbook(file, app)
      setPreview(result.rows); setErrors(result.errors); setFileName(file.name)
      toast.success(`${result.rows.length} filas válidas encontradas`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo leer el archivo') }
  }
  return <div className="data-page">
    <Card className="import-card"><div className="import-copy"><p className="eyebrow">Carga inicial o actualización</p><h2>Importar libro de procesos</h2><p>Lee las hojas <strong>Parametrizacion</strong> y <strong>Base_Procesos</strong>, normaliza fechas, estados y porcentajes antes de guardar.</p><label className="drop-zone"><UploadCloud size={34} /><strong>Selecciona o arrastra un archivo Excel</strong><span>.xlsx o .xls · validación previa incluida</span><input type="file" accept=".xlsx,.xls" onChange={(event) => void pick(event.target.files?.[0])} /></label></div>
      <div className="import-status"><h3>Reglas aplicadas</h3>{['Fechas seriales de Excel a ISO', '0.9 se interpreta como 90%', 'Estados con mayúsculas normalizadas', 'Duplicados advertidos por nombre y fecha', 'Catálogos mapeados automáticamente'].map((item) => <p key={item}><span>✓</span>{item}</p>)}</div>
    </Card>
    {(preview.length > 0 || errors.length > 0) && <Card className="preview-card"><header><div><p className="eyebrow">Previsualización</p><h2>{fileName}</h2></div><div><Badge color="#16a34a">{preview.length} válidas</Badge><Badge color="#dc2626">{errors.length} errores</Badge></div></header>{errors.length > 0 && <div className="error-list">{errors.map((error) => <p key={error}>{error}</p>)}</div>}<div className="preview-table"><table><thead><tr><th>Proceso</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Avance</th></tr></thead><tbody>{preview.slice(0, 8).map((row, index) => <tr key={index}><td>{row.nombre_proceso}</td><td>{row.responsable_principal}</td><td>{row.fecha_inicio}</td><td>{row.fecha_fin_programada}</td><td>{row.porcentaje_avance}%</td></tr>)}</tbody></table></div><footer><Button variant="ghost" onClick={() => { setPreview([]); setErrors([]) }}>Descartar</Button><Button disabled={!preview.length} onClick={async () => { const count = await app.importProcesses(preview); setPreview([]); toast.success(`${count} procesos importados`) }}>Importar {preview.length} procesos</Button></footer></Card>}
    <div className="export-grid"><Card><FileSpreadsheet /><h3>Base completa</h3><p>Todos los procesos y campos en formato Excel.</p><Button variant="secondary" onClick={() => exportProcessesToXlsx(app.processes)}><Download size={16} /> Exportar Excel</Button></Card><Card><FileText /><h3>Reporte gerencial</h3><p>Resumen ejecutivo en PDF listo para reunión.</p><Button variant="secondary" onClick={() => exportProcessesToPdf(app.processes)}><FileDown size={16} /> Generar PDF</Button></Card><Card><FileSpreadsheet /><h3>Procesos vencidos</h3><p>Detalle filtrado de registros fuera de plazo.</p><Button variant="secondary" onClick={() => exportProcessesToXlsx(app.processes.filter((item) => item.semaforo === 'Rojo'), 'procesos-vencidos.xlsx')}><Download size={16} /> Exportar</Button></Card></div>
  </div>
}
