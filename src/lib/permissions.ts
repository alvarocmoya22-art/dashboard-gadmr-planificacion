import type { Role } from '../types'

// Correos con permiso de CREAR y editar trámites desde la Vista operativa.
const PROCESS_WRITER_EMAILS = [
  'coordinacion.gerencia@epmrutasderiobamba.gob.ec',
]

// Operadores: pueden EDITAR (estado, avance, seguimiento), comentar y adjuntar,
// pero NO crear ni archivar trámites.
const PROCESS_OPERATOR_EMAILS = [
  'nietosj@gadmriobamba.gob.ec',
]

function normalizeEmail(email = '') {
  return email.trim().toLowerCase()
}

export function hasManagementAccess(role: Role, areaName = '') {
  return role === 'admin' || role === 'gerente' || areaName.trim().toLowerCase() === 'gerencia general'
}

export function canCreateProcesses(role: Role, email = '') {
  return role === 'admin' || PROCESS_WRITER_EMAILS.includes(normalizeEmail(email))
}

export function canExportReports(role: Role) {
  return hasManagementAccess(role)
}

export function canEditProcesses(role: Role, email = '') {
  const normalized = normalizeEmail(email)
  return role === 'admin' || role === 'gerente' || role === 'responsable'
    || PROCESS_WRITER_EMAILS.includes(normalized)
    || PROCESS_OPERATOR_EMAILS.includes(normalized)
}
