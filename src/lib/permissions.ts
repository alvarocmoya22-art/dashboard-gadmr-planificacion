import type { Role } from '../types'

export function hasManagementAccess(role: Role, areaName = '') {
  return role === 'admin' || role === 'gerente' || areaName.trim().toLowerCase() === 'gerencia general'
}

export function canCreateProcesses(role: Role) {
  return role === 'admin'
}

export function canExportReports(role: Role) {
  return hasManagementAccess(role)
}

export function canEditProcesses(role: Role) {
  return role === 'admin' || role === 'gerente' || role === 'responsable'
}
