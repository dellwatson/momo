import { AGE_LABELS, type CompareRequest, type CompareResult } from '../shared/types.ts'
import { hasTag, insights, qlooKey, searchEntity, type QlooEntity } from './qloo.ts'

// Qloo ranks brands for an audience like the user: same age group and gender.
// Skin type is not a Qloo signal; momo adds skin fit and the user's own diary
// on the page.

const MAX_BRANDS = 12

/** Brand name -> Qloo entity id, or null when Qloo has no match. Lives for the life of the process. */
const brandIds = new Map<string, string | null>()

/** Only beauty brands count. Search alone matched "The Ordinary" to a music label. */
const BEAUTY = 'urn:tag:genre:brand:health_and_beauty'
const isBeauty = (e: QlooEntity) => hasTag(e, BEAUTY)

async function resolveBrands(brands: string[]): Promise<Map<string, string>> {
  const missing = brands.filter((b) => !brandIds.has(b))
  let failure: unknown
  await Promise.all(
    missing.map(async (b) => {
      // A failed call is not cached, so the next compare asks again.
      const e = await searchEntity(b, 'urn:entity:brand', isBeauty).catch((err) => {
        failure = err
        return null
      })
      if (e !== null) brandIds.set(b, e?.entity_id ?? null)
    }),
  )
  const out = new Map<string, string>()
  for (const b of brands) {
    const id = brandIds.get(b)
    if (id) out.set(b, id)
  }
  // No match because Qloo failed is not the same as Qloo not knowing the brand.
  if (!out.size && failure) throw failure
  return out
}

export function audienceLabel(a: CompareRequest['audience']): string {
  const who = [a.gender === 'female' ? 'women' : a.gender === 'male' ? 'men' : 'people', a.ageRange && `aged ${AGE_LABELS[a.ageRange]}`]
    .filter(Boolean)
    .join(' ')
  return a.city ? `${who} in ${a.city}` : who
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 2 ** 32
}

function mock(req: CompareRequest, note?: string): CompareResult {
  const seed = `${req.audience.city ?? ''}|${req.audience.ageRange ?? ''}|${req.audience.gender ?? ''}`
  return {
    brands: req.brands.map((b) => ({ brand: b, affinity: 0.3 + 0.65 * hash(`${seed}|${b}`) })),
    audienceLabel: audienceLabel(req.audience),
    evidence: [{ kind: 'qloo', status: 'sample', count: req.brands.length, detail: `sample scores for ${audienceLabel(req.audience)}` }],
    meta: { tool: 'qloo.compare', status: 'sample', ms: 0, note: note ?? 'no key; sample scores' },
  }
}

function unscored(req: CompareRequest, why: string, note?: string): CompareResult {
  return {
    brands: req.brands.map((b) => ({ brand: b, affinity: null })),
    audienceLabel: audienceLabel(req.audience),
    evidence: [{ kind: 'qloo', status: 'live', count: 0, detail: why }],
    meta: { tool: 'qloo.compare', status: 'live', ms: 0, note },
  }
}

export async function compare(req: CompareRequest): Promise<CompareResult> {
  const brands = [...new Set(req.brands)].slice(0, MAX_BRANDS)
  // Qloo scores named brands by age and gender only. Tested 2026-10-29 on the
  // hackathon server: with signal.location.query it returns no brands for any
  // city (New York, Jakarta), and filter.location.query does not change the
  // scores. So the city is not sent: a call that always comes back empty would
  // double the calls for nothing. The city still works for discovery (top
  // brands in a city, without filter.results.entities).
  const r = { brands, audience: { ...req.audience, city: undefined } }
  if (!qlooKey()) return mock(r)
  // With no age or gender Qloo scores every brand 0, so the call is skipped.
  if (!r.audience.ageRange && !r.audience.gender) return unscored(r, 'needs your age group')
  const t0 = performance.now()
  try {
    const ids = await resolveBrands(brands)
    // With a key, a gap is shown as a gap. Sample scores are only for running without a key.
    if (!ids.size) return unscored(r, 'Qloo does not know these brands')
    const entities = await insights({
      filterType: 'urn:entity:brand',
      resultEntities: [...ids.values()],
      age: r.audience.ageRange,
      gender: r.audience.gender,
      take: ids.size,
    })
    const byId = new Map(entities.map((e) => [e.entity_id, e.query?.affinity ?? 0]))
    const scored = brands.map((b) => {
      const id = ids.get(b)
      return { brand: b, affinity: (id && byId.get(id)) || null }
    })
    const audience = audienceLabel(r.audience)
    // Count only brands Qloo gave a score, so an empty answer does not look like evidence.
    const count = scored.filter((s) => !!s.affinity).length
    return {
      brands: scored,
      audienceLabel: audience,
      // Taste and popularity among people like the user. Never proof that a product works.
      evidence: [{ kind: 'qloo', status: 'live', count, detail: count ? `taste of ${audience}` : `no taste data for ${audience}` }],
      meta: { tool: 'qloo.compare', status: 'live', ms: Math.round(performance.now() - t0) },
    }
  } catch (err) {
    const msg = (err as Error).message.slice(0, 120)
    console.warn(`[qloo.compare] ${msg}`)
    return unscored(r, 'Qloo did not answer', msg)
  }
}
