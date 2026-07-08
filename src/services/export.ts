import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Process } from '../types'
import { formatDate } from '../lib/utils'

const rows = (processes: Process[]) => processes.map((item) => ({
  Código: item.codigo_proceso, Área: item.area?.nombre, Tipo: item.tipo?.nombre, Trámite: item.nombre_proceso,
  'Responsable principal': item.responsable_principal, Inicio: item.fecha_inicio, 'Fin programado': item.fecha_fin_programada,
  'Fin real': item.fecha_fin_real, Estado: item.estado?.nombre, Prioridad: item.prioridad?.nombre,
  'Avance %': item.porcentaje_avance, Semáforo: item.semaforo, 'Días retraso': item.dias_retraso,
  'Dependencia externa': item.dependencia_externa, 'Próxima acción': item.proxima_accion,
  'Nro. eGob': item.egob_numero, 'URL eGob': item.egob_url, 'Estado eGob': item.egob_estado,
  'Actualmente con': item.egob_responsable_actual,
  'Último movimiento eGob': item.egob_ultimo_movimiento,
}))

export function exportProcessesToXlsx(processes: Process[], fileName = 'matriz-tramites-gadmr.xlsx') {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows(processes))
  sheet['!cols'] = [{ wch: 17 }, { wch: 38 }, { wch: 25 }, { wch: 60 }, { wch: 28 }, { wch: 13 }, { wch: 16 }, { wch: 13 }, { wch: 18 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(workbook, sheet, 'Trámites')
  XLSX.writeFile(workbook, fileName)
}

export function exportProcessesToPdf(processes: Process[]) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFillColor(16, 47, 59); doc.rect(0, 0, 297, 34, 'F')
  doc.setTextColor(255); doc.setFontSize(18); doc.text('Reporte gerencial de trámites', 14, 16)
  doc.setFontSize(9); doc.text(`Dirección General de Gestión de Planificación, Hábitat y Desarrollo Urbanístico · GADMR Riobamba · ${formatDate(new Date().toISOString().slice(0, 10))}`, 14, 25)
  doc.setTextColor(35); doc.setFontSize(10); doc.text(`Total: ${processes.length} · Avance promedio: ${Math.round(processes.reduce((sum, item) => sum + item.porcentaje_avance, 0) / Math.max(1, processes.length))}%`, 14, 43)
  autoTable(doc, { startY: 49, head: [['Código', 'Trámite', 'Área', 'Estado', 'Prioridad', 'Avance', 'Vencimiento']], body: processes.map((item) => [item.codigo_proceso, item.nombre_proceso, item.area?.nombre ?? '', item.estado?.nombre ?? '', item.prioridad?.nombre ?? '', `${item.porcentaje_avance}%`, formatDate(item.fecha_fin_programada)]), styles: { fontSize: 7 }, headStyles: { fillColor: [15, 118, 110] } })
  doc.save('reporte-gerencial-tramites.pdf')
}
