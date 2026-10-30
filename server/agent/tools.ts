import { z } from 'zod'
import { marketOf, storesFor, type Market } from '../../shared/availability.ts'
import { CATALOG, PRODUCT_BY_ID } from '../../shared/catalog.ts'
import { matchProduct } from '../../shared/match.ts'
import { reviewsFor } from '../../shared/reviews.ts'
import { CATEGORIES, isReaction, type ContextPack, type DayLog, type Evidence, type Feeling, type Product, type ShelfItem, type Status, type TraceStep } from '../../shared/types.ts'
import { effectsOf, watch } from '../../shared/watch.ts'
import { compare } from '../compare.ts'
import { insights, qlooKey, searchEntity } from '../qloo.ts'

// The agent's tools. Each one reads momo's own data (the user's history sent
// with the turn, the sample catalog, sample reviews) or calls Qloo, and returns
// a small JSON answer for the model plus a trace step and evidence for the app.
//
// Cost rules: no tool runs on its own; each runs only inside a chat turn the
// user started. Qloo answers are cached in memory for 6 hours. No database.

export interface ToolContext {
  pack: ContextPack
  trace: TraceStep[]
  evidence: Evidence[]
  memo: Map<string, unknown>
}

interface Tool<S extends z.ZodType> {
  name: string
  description: string
  parameters: S
  run(args: z.infer<S>, ctx: ToolContext): Promise<{ result: unknown; label: string; status: Status; count?: number; top?: TraceStep['top']; evidence?: Evidence; extra?: Evidence }>
}

const tool = <S extends z.ZodType>(t: Tool<S>) => t

// --- helpers -----------------------------------------------------------------

const memoryOf = (ctx: ToolContext) => ctx.pack.agent ?? { shelf: [], days: [], reviews: [] }
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function useBy(i: ShelfItem): number | undefined {
  if (!i.openedAt || !i.paoMonths) return undefined
  const d = new Date(`${i.openedAt}T12:00:00`)
  d.setMonth(d.getMonth() + i.paoMonths)
  return Math.round((d.getTime() - Date.now()) / 86_400_000)
}

function statsOf(i: ShelfItem, days: Omit<DayLog, 'look'>[]) {
  const on = days.filter((d) => d.used?.includes(i.id))
  const counts = new Map<Feeling, number>()
  for (const d of on) for (const f of d.feelings ?? []) counts.set(f, (counts.get(f) ?? 0) + 1)
  return {
    days_used: on.length,
    good_days: on.filter((d) => (d.score ?? 2) >= 2 && !(d.feelings ?? []).some(isReaction)).length,
    often_felt: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f),
  }
}

const suits = (p: Product, skin?: string) => !skin || p.skinTypes === 'all' || p.skinTypes.includes(skin as never)

function findShelf(shelf: ShelfItem[], q?: string): ShelfItem[] {
  if (!q) return []
  const n = norm(q)
  return shelf.filter((i) => i.productId === q || norm(`${i.brand} ${i.name}`).includes(n) || n.includes(norm(i.name)))
}

/** A catalog product from an id or a name. */
function productFrom(q: string): Product | undefined {
  return PRODUCT_BY_ID.get(q) ?? matchProduct(q)?.product
}

// --- 1. The user's own history ------------------------------------------------

const myHistory = tool({
  name: 'my_history',
  description:
    "Reads the user's own records: profile, every shelf product with stock, open date and how their skin felt on the days they used it, their own reviews, and diary days. Optionally narrow to one product or a topic word (for example 'sport', 'sweat', 'travel', 'sting'). Call it before suggesting or judging any product.",
  parameters: z.object({
    product: z.string().nullable().describe('A product name or id to focus on, or null'),
    topic: z.string().nullable().describe('A word to find in diary notes and events, or null'),
  }),
  async run({ product, topic }, ctx) {
    const m = memoryOf(ctx)
    const pr = ctx.pack.profile
    const focus = findShelf(m.shelf, product ?? undefined)
    const t = topic ? norm(topic) : undefined
    const matching = m.days.filter((d) => {
      if (focus.length && !focus.some((i) => d.used?.includes(i.id))) return false
      if (t && ![...d.notes, ...(d.events ?? [])].some((x) => norm(x).includes(t))) return false
      return !!(focus.length || t)
    })
    const name = (id: string) => m.shelf.find((i) => i.id === id)?.name ?? id
    const result = {
      profile: { skin_type: pr.skinType, reacts: pr.sensitivity, city: pr.city, age: pr.ageRange, trip: m.trip, told_momo: pr.facts },
      shelf: m.shelf.map((i) => ({
        product: `${i.brand} ${i.name}`,
        category: i.category,
        when: i.when,
        does: effectsOf(i),
        left_percent: i.left === undefined ? undefined : Math.round(i.left * 100),
        use_within_days: useBy(i),
        ...statsOf(i, m.days),
        my_rating: m.reviews.find((r) => (r.productId ? r.productId === i.productId : r.name === i.name))?.rating,
      })),
      my_reviews: m.reviews.map((r) => ({ product: `${r.brand} ${r.name}`, stars: r.rating, text: r.text })),
      matching_days: matching.slice(-10).map((d) => ({ date: d.date, score: d.score, felt: d.feelings, used: d.used?.map(name), events: d.events, notes: d.notes })),
      days_logged: m.days.filter((d) => d.score).length,
    }
    const label = product ? `your history with ${product}` : topic ? `your days with "${topic}"` : 'your shelf and diary'
    return {
      result,
      label,
      status: 'live',
      count: m.days.length,
      evidence: { kind: 'diary', status: 'live', count: m.days.length, detail: matching.length ? `${matching.length} matching days` : `${m.days.length} days, ${m.shelf.length} products` },
    }
  },
})

// --- 2. What can be bought, and where ----------------------------------------

const findProducts = tool({
  name: 'find_products',
  description:
    "Searches momo's catalog and where each product is sold in a market (a city or country, for example the user's city or trip). Returns price, whether it is made for the user's skin type, the stores, what people with the same skin type said, and momo's watcher notes for this shelf. Use it even when the user names a product, to check it can be bought where they will be.",
  parameters: z.object({
    category: z.enum(CATEGORIES).nullable().describe('Product type, or null'),
    query: z.string().nullable().describe('Brand, product name or a word like "matte", or null'),
    place: z.string().nullable().describe('City or country where the user will buy it, or null for their home city'),
  }),
  async run({ category, query, place }, ctx) {
    const m = memoryOf(ctx)
    const skin = ctx.pack.profile.skinType
    const where = place ?? ctx.pack.profile.city
    const market: Market | undefined = marketOf(where ?? undefined)
    const q = query ? norm(query) : undefined
    const owned = new Set(m.shelf.map((i) => i.productId))
    const notesFor = (p: Product) => {
      if (owned.has(p.id)) return []
      const trial: ShelfItem = { id: '__trial', productId: p.id, brand: p.brand, name: p.name, category: p.category, actives: p.actives, fragranceFree: p.fragranceFree, when: p.time, addedAt: '' }
      return watch({ shelf: [...m.shelf, trial], profile: ctx.pack.profile, days: [], today: ctx.pack.today })
        .filter((a) => a.items.includes(trial.id) && a.level !== 'tip')
        .map((a) => ({ note: a.title, plan: a.tip }))
    }
    const peers = (p: Product) => {
      const all = reviewsFor(p.id)
      const same = all.filter((r) => r.skinType === skin)
      const top = (same.length ? same : all)[0]
      const avg = same.length ? Math.round((same.reduce((t, r) => t + r.rating, 0) / same.length) * 10) / 10 : null
      return { same_skin_stars: avg, same_skin_reviews: same.length, all_reviews: all.length, a_quote: top ? `${top.rating} stars, ${top.skinType} skin, ${top.city}: ${top.text}` : null }
    }
    let reviewCount = 0
    // A named product is found by name in any category; other words narrow the list.
    const named = query ? matchProduct(query)?.product : undefined
    const words = q?.split(/\s+/).filter((w) => w.length > 2) ?? []
    const text = (p: Product) => norm(`${p.brand} ${p.name} ${p.description} ${p.keyIngredients.join(' ')}`)
    const rows = CATALOG.filter((p) => p.id === named?.id || ((!category || p.category === category) && (!words.length || words.every((w) => text(p).includes(w)))))
      .map((p) => {
        const stores = market ? storesFor(p.brand, market) : []
        return {
          id: p.id,
          product: `${p.brand} ${p.name}`,
          category: p.category,
          price_usd: p.price,
          made_for_your_skin: suits(p, skin),
          made_for: p.skinTypes === 'all' ? 'all skin' : p.skinTypes.join(', '),
          fragrance_free: p.fragranceFree,
          what_it_is: p.description,
          on_your_shelf: owned.has(p.id),
          sold_in: market ? (stores.length ? stores : 'not sold there') : 'unknown market',
          stars: peers(p).same_skin_stars ?? 0,
          p,
        }
      })
      // Sold there, then made for the skin, then what the same skin type said. Catalog order must not decide the cut.
      .sort((a, b) => Number(Array.isArray(b.sold_in)) - Number(Array.isArray(a.sold_in)) || Number(b.made_for_your_skin) - Number(a.made_for_your_skin) || b.stars - a.stars)
      .slice(0, 8)
      // Reviews and watcher notes ride along, so one step answers most product questions.
      .map(({ p, stars: _, ...row }) => {
        const r = peers(p)
        reviewCount += r.all_reviews
        return { ...row, reviews: r, watcher_notes: notesFor(p) }
      })
    const label = `${category ? `${category}s` : query ? `"${query}"` : 'products'}${market ? ` in ${market}` : ''}`
    return {
      result: { market: market ?? `unknown (${where ?? 'no place'})`, note: 'Store lists and reviews are sample data in this prototype. Watcher notes are warnings with a plan.', products: rows },
      label,
      status: 'sample',
      count: rows.length,
      evidence: { kind: 'product', status: 'sample', count: rows.length, detail: market ? `catalog, stores in ${market}` : 'catalog' },
      extra: reviewCount ? ({ kind: 'reviews', status: 'sample', count: reviewCount, detail: skin ? `${skin} skin first` : undefined } as Evidence) : undefined,
    }
  },
})

// --- 3. What people with the same skin said ----------------------------------

const peerReviews = tool({
  name: 'peer_reviews',
  description:
    'Reads anonymous reviews of products from other momo users, grouped by skin type, with short quotes and how their skin felt. Use it for the products you are considering, to see what people with the same skin type said.',
  parameters: z.object({
    product_ids: z.array(z.string()).describe('Catalog ids from find_products, at most 4'),
  }),
  async run({ product_ids }, ctx) {
    const skin = ctx.pack.profile.skinType
    let n = 0
    const out = product_ids.slice(0, 4).map((id) => {
      const p = productFrom(id)
      if (!p) return { id, error: 'not in the catalog' }
      const all = reviewsFor(p.id)
      const same = all.filter((r) => r.skinType === skin)
      n += all.length
      const avg = (rs: typeof all) => (rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : null)
      const quotes = (same.length ? same : all).slice(0, 3).map((r) => ({ stars: r.rating, skin: r.skinType, city: r.city, weeks: r.weeks, said: r.text }))
      return { id: p.id, product: `${p.brand} ${p.name}`, same_skin: { stars: avg(same), reviews: same.length }, everyone: { stars: avg(all), reviews: all.length }, quotes }
    })
    return {
      result: { note: 'Sample reviews in this prototype.', your_skin_type: skin, products: out },
      label: `${n} reviews from people like you`,
      status: 'sample',
      count: n,
      evidence: { kind: 'reviews', status: 'sample', count: n, detail: skin ? `${skin} skin first` : undefined },
    }
  },
})

// --- 4. Taste: what people with the user's interests love (Qloo) --------------

const TTL_MS = 6 * 60 * 60 * 1000
const SKINCARE = 'urn:tag:genre:brand:health_and_beauty:skincare'
const interestIds = new Map<string, string | null>()
const tasteCache = new Map<string, { at: number; brands: { name: string; affinity: number }[] }>()

async function interestId(name: string): Promise<string | null> {
  const k = norm(name)
  if (!interestIds.has(k)) interestIds.set(k, (await searchEntity(name))?.entity_id ?? null)
  return interestIds.get(k)!
}

const qlooTaste = tool({
  name: 'qloo_taste',
  description:
    "Asks Qloo which skincare brands are loved by people who share the user's tastes (brands, artists, shows, places they like) and their age group, optionally in a city. Pass interests from what the user told momo. Never pass personal names, health facts or anything private. Taste is popularity, not proof a product works: use it last, to choose between products that already suit the skin.",
  parameters: z.object({
    interests: z.array(z.string()).describe('Up to 3 public names the user likes, for example a brand, band or show'),
    city: z.string().nullable().describe('A city to look at, or null'),
    brands: z.array(z.string()).describe('Brands you are considering, to score for this audience. Can be empty.'),
  }),
  async run({ interests, city, brands }, ctx) {
    const pr = ctx.pack.profile
    const picked = interests.slice(0, 3)
    if (!qlooKey()) return { result: { error: 'Qloo is not connected (no key).' }, label: 'Qloo taste', status: 'sample' }
    const found = await Promise.all(picked.map((i) => interestId(i).catch(() => null)))
    const ids = found.filter((x): x is string => !!x)
    // Taste and place are two calls: with a city in the same call, Qloo ranks mostly by place and
    // two very different tastes get nearly the same list. Both are cached, so a repeat costs nothing.
    const ranked = async (interestIds: string[], place?: string) => {
      const key = `${[...interestIds].sort().join(',')}|${pr.ageRange}|${pr.gender}|${place ?? ''}`
      const hit = tasteCache.get(key)
      if (hit && Date.now() - hit.at <= TTL_MS) return { ...hit, live: false }
      const entities = await insights({ filterType: 'urn:entity:brand', tags: SKINCARE, interestEntities: interestIds, age: pr.ageRange, gender: pr.gender, location: place, take: 10 })
      const fresh = { at: Date.now(), brands: entities.map((e) => ({ name: e.name, affinity: Math.round((e.query?.affinity ?? 0) * 100) / 100 })) }
      tasteCache.set(key, fresh)
      return { ...fresh, live: true }
    }
    const [top, here] = await Promise.all([ranked(ids, ids.length ? undefined : (city ?? undefined)), ids.length && city ? ranked([], city) : undefined])
    const status: Status = top.live || here?.live ? 'live' : 'cached'
    // Brands under consideration that are not in the top list get a plain audience score.
    const missing = brands.filter((b) => !top.brands.some((t) => norm(t.name) === norm(b))).slice(0, 6)
    const scored = missing.length ? await compare({ brands: missing, audience: { ageRange: pr.ageRange, gender: pr.gender } }) : undefined
    const inCatalog = new Set(CATALOG.map((p) => norm(p.brand)))
    const result = {
      signals: { interests_found: picked.filter((_, i) => found[i]), interests_not_found: picked.filter((_, i) => !found[i]), age: pr.ageRange, gender: pr.gender, city },
      loved_brands: top.brands.map((b) => ({ ...b, in_momo_catalog: inCatalog.has(norm(b.name)) })),
      loved_in_city: here && { city, brands: here.brands.slice(0, 5).map((b) => ({ ...b, in_momo_catalog: inCatalog.has(norm(b.name)) })) },
      your_brands_for_this_age_group: scored?.brands,
      note: 'Affinity is how much this audience likes a brand compared with everyone. It is taste, not results. loved_brands is their taste; loved_in_city is the whole age group in that city.',
    }
    return {
      result,
      label: `Qloo taste${picked.length ? ` of ${picked.join(' + ')} fans` : ''}${city ? ` in ${city}` : ''}`,
      status,
      count: top.brands.length,
      top: top.brands.slice(0, 6).map((b) => ({ name: b.name, pct: Math.round(b.affinity * 100), inCatalog: inCatalog.has(norm(b.name)) })),
      evidence: { kind: 'qloo', status, count: top.brands.length, detail: picked.length ? `fans of ${picked.join(', ')}` : `people aged like you` },
    }
  },
})

// --- 5. momo's watcher, for one product on this shelf -------------------------

const checkShelf = tool({
  name: 'check_shelf',
  description:
    "Runs momo's formula watcher as if the product joined the user's shelf. Returns notes with a plan (for example split nights, skip on sport days). A note is a warning with a plan, never a ban.",
  parameters: z.object({
    product_id: z.string().describe('Catalog id or product name'),
  }),
  async run({ product_id }, ctx) {
    const m = memoryOf(ctx)
    const p = productFrom(product_id)
    if (!p) return { result: { error: 'momo does not know this formula, so it cannot check it.' }, label: 'formula check', status: 'live' }
    const trial: ShelfItem = { id: '__trial', productId: p.id, brand: p.brand, name: p.name, category: p.category, actives: p.actives, fragranceFree: p.fragranceFree, when: p.time, addedAt: '' }
    const owned = m.shelf.find((i) => i.productId === p.id)
    const shelf = owned ? m.shelf : [...m.shelf, trial]
    const id = owned?.id ?? trial.id
    const notes = watch({ shelf, profile: ctx.pack.profile, days: m.days as DayLog[], today: ctx.pack.today }).filter((a) => a.items.includes(id))
    const skin = ctx.pack.profile.skinType
    return {
      result: {
        product: `${p.brand} ${p.name}`,
        made_for_your_skin: suits(p, skin),
        notes: notes.map((a) => ({ level: a.level === 'stop' ? 'pause and watch' : a.level, note: a.title, plan: a.tip })),
        rule: 'These are warnings with a plan. Say "not for you now" only if it goes against their skin type and their recent reactions.',
      },
      label: `formula check: ${p.name}`,
      status: 'live',
      count: notes.length,
      evidence: { kind: 'product', status: 'live', count: notes.length, detail: 'formula check' },
    }
  },
})

// --- 6. A product link the user shared -----------------------------------------

const readLink = tool({
  name: 'read_link',
  description: 'Reads a product link the user shared. Works for YouTube links (title and channel). Instagram posts cannot be read: ask for the caption or a screenshot.',
  parameters: z.object({ url: z.string() }),
  async run({ url }) {
    let u: URL
    try {
      u = new URL(url)
    } catch {
      return { result: { error: 'Not a link.' }, label: 'a link', status: 'live' }
    }
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'instagram.com') return { result: { error: 'Instagram posts cannot be read. Ask the user to paste the caption or share a screenshot.' }, label: 'an Instagram link', status: 'live' }
    if (host !== 'youtube.com' && host !== 'youtu.be') return { result: { error: 'momo reads YouTube links only, for now.' }, label: `a link on ${host}`, status: 'live' }
    // Only YouTube's own oEmbed endpoint is called, never the shared address itself.
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.toString())}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { result: { error: `YouTube did not answer (${res.status}).` }, label: 'a YouTube link', status: 'live' }
    const j = (await res.json()) as { title?: string; author_name?: string }
    const p = j.title ? matchProduct(j.title)?.product : undefined
    return {
      result: { title: j.title, channel: j.author_name, product_in_catalog: p ? { id: p.id, product: `${p.brand} ${p.name}` } : null },
      label: 'the YouTube link',
      status: 'live',
      count: 1,
      evidence: { kind: 'product', status: 'live', detail: 'shared YouTube link' },
    }
  },
})

export const TOOLS = [myHistory, findProducts, peerReviews, qlooTaste, checkShelf, readLink] as Tool<z.ZodType>[]

/** Runs one tool call. A failure goes back to the model as an error, so it can answer without that tool. */
export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<unknown> {
  const t = TOOLS.find((x) => x.name === name)
  const t0 = performance.now()
  if (!t) return { error: `unknown tool ${name}` }
  // The same call twice in one turn gets the first answer, with no second trace line.
  const key = `${name}|${rawArgs}`
  if (ctx.memo.has(key)) return ctx.memo.get(key)
  const answer = await runOnce(t, name, rawArgs, ctx, t0)
  ctx.memo.set(key, answer)
  return answer
}

async function runOnce(t: Tool<z.ZodType>, name: string, rawArgs: string, ctx: ToolContext, t0: number): Promise<unknown> {
  try {
    const args = t.parameters.parse(JSON.parse(rawArgs))
    const r = await t.run(args, ctx)
    ctx.trace.push({ tool: name, label: r.label, status: r.status, ms: Math.round(performance.now() - t0), count: r.count, top: r.top })
    if (r.evidence) ctx.evidence.push(r.evidence)
    if (r.extra) ctx.evidence.push(r.extra)
    return r.result
  } catch (err) {
    const msg = (err as Error).message.slice(0, 160)
    console.warn(`[agent.${name}] ${msg}`)
    ctx.trace.push({ tool: name, label: `${name} failed`, status: 'live', ms: Math.round(performance.now() - t0) })
    return { error: msg }
  }
}
