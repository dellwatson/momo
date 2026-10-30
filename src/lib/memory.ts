import { PRODUCT_BY_ID } from '@shared/catalog.ts'
import { guessActives, guessBrand, guessCategory, matchProduct } from '@shared/match.ts'
import { effectsOf, type Alert } from '@shared/watch.ts'
import {
  FEELING_LABELS,
  isReaction,
  type AgentMemory,
  type ChatTurn,
  type ContextPack,
  type DayLog,
  type Evidence,
  type Feeling,
  type Mood,
  type Profile,
  type ShelfItem,
  type TraceStep,
} from '@shared/types.ts'

// The shape of everything momo remembers. It lives in the browser
// (localStorage) and is compiled into a ContextPack for each chat call.

export interface Message {
  id: string
  role: 'momo' | 'user'
  text: string
  at: string
  /** Set on a momo message that asked a check-in question. */
  questionKey?: string
  /** Set on a momo message that raised a watcher alert. */
  alertId?: string
  /** Which model wrote a server reply, for example "claude-opus-5-5 live · jev sample". */
  meta?: string
  /** What the message stands on, shown as chips under it. */
  evidence?: Evidence[]
  /** The tools the agent used for this reply. */
  trace?: TraceStep[]
}

/** A review the user wrote. It is anonymous to others; points never depend on what it says. */
export interface MyReview {
  id: string
  productId?: string
  brand: string
  name: string
  rating: 1 | 2 | 3 | 4 | 5
  text: string
  at: string
  points: number
}

/** The signed-in user. In the prototype this is the demo account. */
export interface Account {
  handle: string
  joined: string
  points: number
  /** Fur colors the user owns, and the one momo wears. */
  furs: string[]
  fur: string
  public: boolean
  socials: { instagram?: string; tiktok?: string }
  /** The next trip, so Explore can show what people love there. */
  trip?: { city: string; when?: string }
  demo: boolean
  demoVersion?: number
}

export interface MomoState {
  version: 1
  account?: Account
  reviews?: MyReview[]
  profile: Profile
  shelf: ShelfItem[]
  days: Record<string, DayLog>
  messages: Message[]
  /** Skipped or finished onboarding steps. */
  flags: Record<string, boolean>
  dismissed: string[]
  seenAlerts: string[]
  /** Key of the last question momo asked, so it is asked once. */
  askedKey?: string
  mood: Mood
  busy: boolean
}

export const MAX_MESSAGES = 300
export const MAX_FACTS = 30
export const HISTORY_TURNS = 12

/** Points for sharing. The same for any review or story, whatever it says. */
export const POINTS = { review: 20, story: 10 } as const

/** The longest run of days in a row with a check-in. */
export function bestStreak(days: Record<string, DayLog>): number {
  const dates = Object.values(days)
    .filter((d) => d.score)
    .map((d) => d.date)
    .sort()
  let best = 0
  let run = 0
  let prev: Date | undefined
  for (const date of dates) {
    const d = new Date(`${date}T12:00:00`)
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Days in a row with a check-in, up to today (or yesterday, while today is still open). */
export function streakOf(days: Record<string, DayLog>, today = new Date()): number {
  const d = new Date(today)
  if (!days[todayKey(d)]?.score) d.setDate(d.getDate() - 1)
  let n = 0
  while (days[todayKey(d)]?.score) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function dayOf(s: MomoState, date = todayKey()): DayLog {
  return s.days[date] ?? { date, notes: [] }
}

export const uid = () => crypto.randomUUID()

export function shortName(i: Pick<ShelfItem, 'name'>): string {
  return i.name.length > 30 ? `${i.name.slice(0, 28).trimEnd()}…` : i.name
}

/** Builds a shelf item from what the user typed. Known formulas are matched; others are guessed from the name. */
export function makeShelfItem(text: string): { item: ShelfItem; known: boolean } {
  const m = matchProduct(text)
  const addedAt = new Date().toISOString()
  if (m) {
    const p = m.product
    return {
      known: true,
      item: { id: uid(), productId: p.id, brand: p.brand, name: p.name, category: p.category, actives: p.actives, fragranceFree: p.fragranceFree, addedAt },
    }
  }
  const brand = guessBrand(text) ?? ''
  const name = text.trim().replace(/\s+/g, ' ').slice(0, 60)
  return {
    known: false,
    item: { id: uid(), brand, name: brand ? name.replace(new RegExp(brand, 'i'), '').trim() || name : name, category: guessCategory(text), actives: guessActives(text), addedAt },
  }
}

export function sameProduct(a: ShelfItem, b: ShelfItem): boolean {
  return a.productId ? a.productId === b.productId : a.name.toLowerCase() === b.name.toLowerCase()
}

export interface ItemStats {
  daysUsed: number
  goodDays: number
  top: Feeling[]
}

/** How a product has felt, from the diary. */
export function itemStats(item: ShelfItem, days: DayLog[]): ItemStats {
  const on = days.filter((d) => d.used?.includes(item.id))
  const counts = new Map<Feeling, number>()
  for (const d of on) for (const f of d.feelings ?? []) counts.set(f, (counts.get(f) ?? 0) + 1)
  return {
    daysUsed: on.length,
    goodDays: on.filter((d) => (d.score ?? 2) >= 2 && !(d.feelings ?? []).some(isReaction)).length,
    top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f),
  }
}

function describeDay(d: DayLog, shelf: ShelfItem[]): string {
  const score = d.score ? ['', 'not great', 'okay', 'great'][d.score] : 'no score'
  const feel = d.feelings?.length ? d.feelings.map((f) => FEELING_LABELS[f].toLowerCase()).join(', ') : 'nothing noted'
  const used = d.used?.map((id) => shelf.find((i) => i.id === id)?.name).filter(Boolean).join(', ')
  const ev = d.events?.length ? `; life: ${d.events.join(', ')}` : ''
  const notes = d.notes.length ? `; notes: ${d.notes.slice(-2).join(' / ')}` : ''
  const look = d.look ? `; skin check (${d.look.change}): ${d.look.summary}` : ''
  return `${d.date}: ${score}; felt ${feel}${used ? `; used ${used}` : ''}${ev}${look}${notes}`
}

/** The one context every chat provider receives. */
export function buildContext(s: MomoState, alerts: Alert[]): ContextPack {
  const days = Object.values(s.days).sort((a, b) => a.date.localeCompare(b.date))
  return {
    today: todayKey(),
    profile: s.profile,
    shelf: s.shelf.map((i) => {
      const st = itemStats(i, days)
      const felt = st.daysUsed ? `; used ${st.daysUsed} days, good on ${st.goodDays}${st.top.length ? `, often ${st.top.join('/')}` : ''}` : ''
      const known = i.productId && PRODUCT_BY_ID.has(i.productId) ? '' : '; formula unknown'
      return { name: i.name, brand: i.brand, category: i.category, when: i.when, effects: `${effectsOf(i)}${felt}${known}` }
    }),
    recentDays: days.slice(-7).map((d) => describeDay(d, s.shelf)),
    watching: alerts.slice(0, 6).map((a) => `${a.title}. ${a.tip}`),
  }
}

/** Days of history the agent's tools can read. */
const AGENT_DAYS = 45

/** The user's own records for the agent's tools: sent with chat turns only, kept by the server for that turn only. */
export function agentMemoryOf(s: MomoState): AgentMemory {
  const days = Object.values(s.days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-AGENT_DAYS)
    .map(({ look: _look, ...d }) => d)
  return {
    shelf: s.shelf,
    days,
    reviews: (s.reviews ?? []).map(({ productId, brand, name, rating, text, at }) => ({ productId, brand, name, rating, text, at })),
    trip: s.account?.trip,
  }
}

export function historyOf(s: MomoState): ChatTurn[] {
  return s.messages.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, text: m.text }))
}
