import { CATALOG } from '../shared/catalog.ts'
import type { ExploreRequest, ExploreResult, TasteList } from '../shared/types.ts'
import { audienceLabel } from './compare.ts'
import { insights, qlooKey } from './qloo.ts'

// Qloo discovery: the skincare brands an audience loves, and the brands loved
// in a city. Compare scores the user's own brands; this finds new ones.
// Tested 2026-10-30 on the hackathon server: filter.tags with the skincare tag
// gives skincare brands only, and signal.location.query changes the list
// (Jakarta and Tokyo give different brands).

const SKINCARE = 'urn:tag:genre:brand:health_and_beauty:skincare'
const TAKE = 8
const MAX_PLACES = 2

// Taste moves slowly, so one answer serves every visit for 6 hours. This is an
// in-process cache, not a timer: nothing runs when nobody opens Explore.
const TTL_MS = 6 * 60 * 60 * 1000
const MAX_CACHE = 200
const cache = new Map<string, { at: number; list: TasteList }>()

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 2 ** 32
}

const BRANDS = [...new Set(CATALOG.map((p) => p.brand))]

function sample(key: string, label: string): TasteList {
  const brands = BRANDS.map((name) => ({ name, affinity: 0.4 + 0.58 * hash(`${key}|${name}`) }))
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, TAKE)
  return { key, label, brands, status: 'sample', note: 'no Qloo key; sample scores' }
}

async function list(key: string, label: string, p: { age?: string; gender?: string; location?: string }): Promise<TasteList> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.list, status: 'cached' }
  try {
    const entities = await insights({ filterType: 'urn:entity:brand', tags: SKINCARE, take: TAKE, ...p })
    const out: TasteList = { key, label, brands: entities.map((e) => ({ name: e.name, affinity: e.query?.affinity ?? 0 })), status: 'live' }
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!)
    cache.set(key, { at: Date.now(), list: out })
    return out
  } catch (err) {
    // A failed call is shown as a gap and is not cached, so the next visit asks again.
    const msg = (err as Error).message.slice(0, 120)
    console.warn(`[qloo.explore] ${msg}`)
    return { key, label, brands: [], status: 'live', note: `Qloo did not answer: ${msg}` }
  }
}

export async function explore(req: ExploreRequest): Promise<ExploreResult> {
  const t0 = performance.now()
  const a = req.audience
  const places = [...new Set(req.places.map((p) => p.trim()).filter(Boolean))].slice(0, MAX_PLACES)
  const who = audienceLabel(a)
  const wanted = [
    // With no age or gender Qloo scores nothing, so the audience list needs one of them.
    ...(a.ageRange || a.gender ? [{ key: `aud:${a.ageRange ?? ''}:${a.gender ?? ''}`, label: `Loved by ${who}`, p: { age: a.ageRange, gender: a.gender } }] : []),
    // City lists keep the audience, so "in Tokyo" still means people like the user.
    ...places.map((city) => ({ key: `city:${city.toLowerCase()}:${a.ageRange ?? ''}:${a.gender ?? ''}`, label: `Loved in ${city}`, p: { age: a.ageRange, gender: a.gender, location: city } })),
  ]
  const lists = qlooKey() ? await Promise.all(wanted.map((w) => list(w.key, w.label, w.p))) : wanted.map((w) => sample(w.key, w.label))
  const status = lists.some((l) => l.status === 'live') ? 'live' : lists[0]?.status ?? 'sample'
  return {
    lists,
    // Taste and popularity. Never proof that a product works for a skin.
    evidence: [{ kind: 'qloo', status, count: lists.reduce((n, l) => n + l.brands.length, 0), detail: `taste of ${who}${places.length ? ` and ${places.join(', ')}` : ''}` }],
    meta: { tool: 'qloo.explore', status, ms: Math.round(performance.now() - t0) },
  }
}
