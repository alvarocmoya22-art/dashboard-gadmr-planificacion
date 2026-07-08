import type { Process } from '../types'

export const EGOB_BASE_URL = 'https://egobedoc.gadmriobamba.gob.ec:8081'

export function getEgobIssueNumber(process: Pick<Process, 'egob_numero' | 'documento_respaldo'>) {
  const explicit = process.egob_numero?.trim()
  if (explicit) return explicit
  return process.documento_respaldo?.match(/\b\d{5,}\b/)?.[0] ?? ''
}

export function getEgobIssueUrl(process: Pick<Process, 'egob_numero' | 'egob_url' | 'documento_respaldo'>) {
  if (process.egob_url?.trim()) return process.egob_url.trim()
  const issueNumber = getEgobIssueNumber(process)
  return issueNumber ? `${EGOB_BASE_URL}/issues/${issueNumber}` : ''
}
