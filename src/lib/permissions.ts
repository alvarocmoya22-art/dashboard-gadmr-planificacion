import type { Role } from '../types'

const PROCESS_CREATOR_EMAILS = [
  'coordinacion.gerencia@epmrutasderiobamba.gob.ec',
]

function normalizeEmail(email = '') {
  return email.trim().toLowerCase()
}

export function hasManagementAccess(role: Role, areaName = '') {
  return role === 'admin' || role === 'gerente' || areaName.trim().toLowerCase() === 'gerencia general'
}

export function canCreateProcesses(role: Role, email = '') {
  return role === 'admin' || PROCESS_CREATOR_EMAILS.includes(normalizeEmail(email))
}

export function canExportReports(role: Role) {
  return hasManagementAccess(role)
}

export function canEditProcesses(role: Role) {
  return role === 'admin' || role === 'gerente' || role === 'responsable'
}
