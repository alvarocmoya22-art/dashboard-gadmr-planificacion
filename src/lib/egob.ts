import type { Process } from '../types'

export const EGOB_BASE_URL = 'https://egobedoc.gadmriobamba.gob.ec:8081'

export function getEgobIssueNumber(process: Pick<Process, 'egob_numero' | 'documento_respaldo'>) {
  const explicit = process.egob_numero?.trim()
  if (explicit) return explicit
  const matches = [...(process.documento_respaldo ?? '').matchAll(/\b\d{5,}\b/g)].map((match) => match[0])
  return matches.at(-1) ?? ''
}

export function getEgobIssueUrl(process: Pick<Process, 'egob_numero' | 'egob_url' | 'documento_respaldo'>) {
  if (process.egob_url?.trim()) return process.egob_url.trim()
  const issueNumber = getEgobIssueNumber(process)
  return issueNumber ? `${EGOB_BASE_URL}/issues/${issueNumber}` : ''
}
