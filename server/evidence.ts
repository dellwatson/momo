import type { ContextPack, Evidence, ScanResult, Status } from '../shared/types.ts'
import type { ChatBasis } from './chat/contract.ts'

// Builds the evidence tags for each reply. The model only names which parts of
// the memory it used; the counts come from the memory itself. A kind the memory
// cannot support is dropped, so momo never shows a source it does not have.

/** describeDay() in src/lib/memory.ts writes "skin check (" into days that have one. */
const SKIN_CHECK = 'skin check ('

export function chatEvidence(basis: ChatBasis[], pack: ContextPack): Evidence[] {
  const out: Evidence[] = []
  for (const kind of new Set(basis)) {
    if (kind === 'diary') {
      const days = pack.recentDays.length
      const told = pack.profile.facts.length
      if (!days && !told) continue
      out.push({ kind, status: 'live', count: days || undefined, detail: days === 1 ? 'last day' : days ? `last ${days} days` : 'what you told me' })
    } else if (kind === 'product') {
      if (pack.watching.length) out.push({ kind, status: 'live', count: pack.watching.length, detail: 'formula check' })
      else if (pack.shelf.length) out.push({ kind, status: 'live', count: pack.shelf.length, detail: 'your shelf' })
    } else if (kind === 'skin_scan') {
      const checks = pack.recentDays.filter((d) => d.includes(SKIN_CHECK)).length
      if (checks) out.push({ kind, status: 'live', count: checks, detail: checks === 1 ? 'one check' : `${checks} checks` })
    }
  }
  return out
}

export function lookEvidence(status: Status, previousDate?: string): Evidence[] {
  const detail = status === 'live' ? (previousDate ? 'compared with last time' : 'first check') : 'on-device estimate'
  return [{ kind: 'skin_scan', status, detail }]
}

export function scanEvidence(basis: ScanResult['basis'], status: Status): Evidence[] {
  if (basis === 'none') return []
  return [{ kind: 'product', status, detail: basis === 'read' ? 'read from the label' : 'predicted from the front' }]
}
