// Client for the Qloo Taste AI API.
// Docs: https://docs.qloo.com/reference/insights-api-deep-dive
//
// The default is the hackathon server, which matches momo's current key. For a
// production key, set QLOO_API_URL=https://api.qloo.com.

const QLOO_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com'
const TIMEOUT_MS = 15_000

export function qlooKey(): string | undefined {
  return process.env.QLOO_API_KEY || undefined
}

export interface QlooEntity {
  entity_id: string
  name: string
  types?: string[]
  subtype?: string
  tags?: { tag_id: string; name?: string }[]
  query?: { affinity?: number }
}

async function qlooGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const key = qlooKey()
  if (!key) throw new Error('No Qloo key. Set QLOO_API_KEY in .env.')

  const url = new URL(path, QLOO_URL)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))

  const res = await fetch(url, {
    headers: { 'X-Api-Key': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Qloo ${path} ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

/**
 * Finds the best-matching entity for free text, such as "Rihanna" or "Spirited Away".
 * Search can return the wrong thing ("The Ordinary" gives a music label), so
 * `accept` checks each of the top results and the first one it accepts wins.
 */
export async function searchEntity(query: string, types?: string, accept?: (e: QlooEntity) => boolean): Promise<QlooEntity | undefined> {
  const json = await qlooGet<{ results?: QlooEntity[] }>('/search', { query, types, take: accept ? 5 : 1 })
  const results = json.results ?? []
  return accept ? results.find(accept) : results[0]
}

export const hasTag = (e: QlooEntity, prefix: string) => !!e.tags?.some((t) => t.tag_id.startsWith(prefix))

export interface InsightsParams {
  filterType: string
  interestEntities?: string[]
  /** A place name, for example "Jakarta". Qloo replies 400 to a name it does not know. */
  location?: string
  age?: string
  gender?: string
  /** Restrict results to these entity IDs, so affinity is scored for our brands only. */
  resultEntities?: string[]
  /** Only entities with this tag, for example the skincare brand tag. */
  tags?: string
  take?: number
}

export async function insights(p: InsightsParams): Promise<QlooEntity[]> {
  const json = await qlooGet<{ results?: { entities?: QlooEntity[] } }>('/v2/insights', {
    'filter.type': p.filterType,
    'filter.results.entities': p.resultEntities?.join(','),
    'filter.tags': p.tags,
    'signal.interests.entities': p.interestEntities?.join(','),
    'signal.location.query': p.location,
    'signal.demographics.age': p.age,
    'signal.demographics.gender': p.gender,
    take: p.take ?? 50,
  })
  return json.results?.entities ?? []
}
