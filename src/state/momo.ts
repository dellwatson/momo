import { useMemo } from 'react'
import { watch, type Alert } from '@shared/watch.ts'
import { matchProduct } from '@shared/match.ts'
import { isReaction, type ChatExtract, type DayLog, type Evidence, type ChatResult, type LookResult, type Mood, type ScanResult, type ShelfItem, type Signs, type When } from '@shared/types.ts'
import { api } from '@/lib/api'
import { CAMERA, SCAN, applyAnswer, nextQuestion, type Question } from '@/lib/checkin'
import { allPhotos, clearPhotos, getPhoto, putPhoto } from '@/lib/photos'
import { cleanSpoken, matchChips } from '@/lib/voice-match'
import { DEMO_VERSION, demoState } from '@/lib/demo'
import {
  MAX_FACTS,
  agentMemoryOf,
  POINTS,
  MAX_MESSAGES,
  buildContext,
  dayOf,
  historyOf,
  makeShelfItem,
  sameProduct,
  todayKey,
  uid,
  type Account,
  type Message,
  type MomoState,
  type MyReview,
} from '@/lib/memory'
import { createStore, useStore } from '@/lib/store'

const INITIAL: MomoState = {
  version: 1,
  profile: { facts: [] },
  shelf: [],
  days: {},
  messages: [],
  flags: {},
  dismissed: [],
  seenAlerts: [],
  mood: 'happy',
  busy: false,
}

export const momoStore = createStore<MomoState>('momo.memory.v1', INITIAL)

// Which full-screen sheet is open. Not saved: a reload starts on the home screen.
export type Sheet = 'talk' | 'skin' | 'scan'
export const uiStore = createStore<{ sheet?: Sheet; back?: Sheet; talkSince?: string }>(null, {})

export function openSheet(sheet: Sheet) {
  const cur = uiStore.get().sheet
  uiStore.set({
    sheet,
    back: cur && cur !== sheet ? cur : undefined,
    // The voice sheet reads out only what momo says after it opens.
    ...(sheet === 'talk' ? { talkSince: new Date().toISOString() } : {}),
  })
}

/** Closes the sheet, and returns to the one that opened it (for example the camera opened from a voice check-in). */
export function closeSheet() {
  const { back } = uiStore.get()
  uiStore.set({ sheet: back, back: undefined })
}

export const useSheet = () => useStore(uiStore, (u) => u.sheet)
// A reply that was in flight when the page closed will never arrive.
if (momoStore.get().busy) momoStore.set({ busy: false })

// Skin checks saved before 2026-10-29 have source 'live' | 'mock' in place of status.
{
  const days = momoStore.get().days
  const old = Object.values(days).filter((d) => d.look && !d.look.status)
  if (old.length) {
    const next = { ...days }
    for (const d of old) {
      const { source, ...look } = d.look as NonNullable<DayLog['look']> & { source?: string }
      next[d.date] = { ...d, look: { ...look, status: source === 'live' ? 'live' : 'sample' } }
    }
    momoStore.set({ days: next })
  }
}

const get = momoStore.get
const set = momoStore.set

// The prototype has no sign-in: it opens as the demo account. Memory from
// before the demo account is kept in momo.memory.backup, not thrown away.
const BACKUP_KEY = 'momo.memory.backup'

/** Replaces memory with the demo account. Photos stay in IndexedDB. */
export function loadDemo() {
  const cur = get()
  if (!cur.account && (cur.shelf.length || cur.messages.length)) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(cur))
    } catch {
      // Storage full or blocked: the demo still loads.
    }
  }
  set(demoState())
}

{
  const a = get().account
  if (!a || (a.demo && (a.demoVersion ?? 1) < DEMO_VERSION)) loadDemo()
}

export function alertsOf(s: MomoState): Alert[] {
  return watch({ shelf: s.shelf, profile: s.profile, days: Object.values(s.days), today: todayKey() }).filter(
    (a) => !s.dismissed.includes(a.id),
  )
}

function push(m: Omit<Message, 'id' | 'at'>) {
  set((s) => ({ messages: [...s.messages, { ...m, id: uid(), at: new Date().toISOString() }].slice(-MAX_MESSAGES) }))
}

const say = (text: string, extra: Partial<Message> = {}) => push({ role: 'momo', text, ...extra })

/** Asks the next check-in question, once. */
function askNext() {
  const q = nextQuestion(get())
  if (!q || get().askedKey === q.key) return
  say(q.text, { questionKey: q.key })
  set({ askedKey: q.key })
}

/** Watcher alerts come from momo's own formula check. */
const WATCHER: Evidence[] = [{ kind: 'product', status: 'live', detail: 'formula check' }]

/** Raises watcher alerts the user has not seen yet, at most two at a time. */
function announceAlerts() {
  const s = get()
  // Wait until momo knows when each product is used, so a clash is real before it is raised.
  const placed = (id: string) => !!s.shelf.find((i) => i.id === id)?.when
  const fresh = alertsOf(s).filter((a) => !s.seenAlerts.includes(a.id) && a.items.every(placed))
  if (!fresh.length) return
  for (const a of fresh.slice(0, 2)) say(a.title, { alertId: a.id, evidence: WATCHER })
  set((st) => ({ seenAlerts: [...st.seenAlerts, ...fresh.map((a) => a.id)], mood: 'concerned' }))
}

function settle() {
  announceAlerts()
  askNext()
}

/** Called when the chat or a voice check-in opens: greets a new day and shows anything pending. */
export function wake() {
  settle()
}

/** The newest momo message, for the voice sheet to say out loud. */
export const lastMomo = (s: MomoState) => [...s.messages].reverse().find((m) => m.role === 'momo')

export function currentQuestion(s: MomoState): Question | null {
  return nextQuestion(s)
}

export function answerChips(values: string[], said?: string) {
  const s = get()
  const q = nextQuestion(s)
  if (!q || !values.length) return
  const labels = values.map((v) => q.chips.find((c) => c.value === v)?.label ?? v)
  push({ role: 'user', text: said ?? labels.join(', ') })
  // These chips open the camera. The question stays open until a photo comes back.
  if (values[0] === CAMERA) return openSheet('skin')
  if (values[0] === SCAN) return openSheet('scan')
  const r = applyAnswer(s, q, values)
  set({ ...r.state, ...(r.mood ? { mood: r.mood } : {}) })
  if (r.ack) say(r.ack)
  settle()
}

/** Free text: answers a text question locally, or goes to the chat model. */
export async function sendText(raw: string) {
  const text = raw.trim().slice(0, 500)
  if (!text || get().busy) return
  const s = get()
  const q = nextQuestion(s)
  push({ role: 'user', text })

  if (q?.freeText && !text.endsWith('?')) {
    const r = applyAnswer(s, q, [], text)
    set({ ...r.state, ...(r.mood ? { mood: r.mood } : {}) })
    if (r.ack) say(r.ack)
    settle()
    return
  }

  set({ busy: true })
  try {
    const now = get()
    const res = await api.chat({ context: { ...buildContext(now, alertsOf(now)), agent: agentMemoryOf(now) }, history: historyOf(now).slice(0, -1), message: text })
    applyExtract(res.extract, q, text)
    say(res.reply, { meta: metaLine(res), evidence: res.evidence, trace: res.meta.trace })
    set({ mood: res.mood })
  } catch {
    say("I can't reach my brain right now. Is the agent server running? (npm run dev in /Users/Shared/momo)", { meta: 'error' })
    set({ mood: 'concerned' })
  } finally {
    set({ busy: false })
  }
  settle()
}

/** A spoken answer: matched to the check-in chips on the device first, then the chat model. */
export async function answerSpoken(transcript: string) {
  const text = transcript.trim()
  if (!text || get().busy) return
  const q = nextQuestion(get())
  const values = q?.chips.length ? matchChips(q, text) : null
  // A free-text question takes the words as they are, unless the user picked a chip ("skip", "that's all").
  if (q && values && (!q.freeText || values.every((v) => v.startsWith('__')))) return answerChips(values, text)
  if (q?.freeText && !text.endsWith('?')) return sendText(q.id === 'add_product' || q.id === 'name' || q.id === 'city' ? cleanSpoken(text) : text)
  return sendText(text)
}

function metaLine(r: ChatResult): string {
  const c = r.meta.chat
  return `${c.model ?? c.tool} ${c.status} · jev ${r.meta.sense.status} · ${c.ms} ms${c.note ? ` · ${c.note}` : ''}`
}

/** Writes what the model heard into memory. */
function applyExtract(x: ChatExtract, q: Question | null, message: string) {
  set((s) => {
    const date = todayKey()
    const day = dayOf(s, date)
    let shelf = s.shelf
    const mentioned: ShelfItem[] = []
    for (const name of x.products.slice(0, 3)) {
      const { item } = makeShelfItem(name)
      const existing = shelf.find((i) => sameProduct(i, item))
      if (existing) mentioned.push(existing)
      else {
        shelf = [...shelf, item]
        mentioned.push(item)
      }
    }
    const feelings = x.feelings.length ? [...new Set([...(day.feelings ?? []), ...x.feelings])] : day.feelings
    const score = day.score ?? (x.feelings.length ? (x.feelings.some(isReaction) ? 1 : 3) : undefined)
    const used = q?.id === 'day_used' && mentioned.length ? mentioned.map((i) => i.id) : day.used
    const events = x.events.length ? [...new Set([...(day.events ?? []), ...x.events])] : day.events
    // Messages that carried skin news are kept as diary notes, in the user's own words.
    const noteworthy = x.feelings.length || x.events.length || x.products.length
    const notes = noteworthy ? [...day.notes, message.slice(0, 200)].slice(-5) : day.notes
    const facts = [...new Set([...s.profile.facts, ...x.facts.map((f) => f.slice(0, 80))])].slice(-MAX_FACTS)
    return {
      // A message with skin or product news is a story, and earns the same points whatever it says.
      ...(noteworthy && s.account ? { account: { ...s.account, points: s.account.points + POINTS.story } } : {}),
      shelf,
      profile: { ...s.profile, facts },
      days: { ...s.days, [date]: { ...day, feelings, score, used, events, notes } },
    }
  })
}

// --- Camera: skin checks and product scans ----------------------------------

/** The most recent skin check before today, with its photo. */
async function previousLook(): Promise<{ photo: string; date: string; signs: Signs } | undefined> {
  const today = todayKey()
  const day = Object.values(get().days)
    .filter((d) => d.look && d.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!day?.look) return undefined
  const p = await getPhoto(day.look.photoId).catch(() => undefined)
  return p ? { photo: p.dataUrl, date: day.date, signs: day.look.signs } : undefined
}

export interface SkinCheck {
  result: LookResult
  photo: string
  previous?: { photo: string; date: string; signs: Signs }
}

/** One skin check: one vision call. The photo is saved on this device, and momo says what it saw. */
export async function checkSkin(photo: string, estimate?: Signs): Promise<SkinCheck> {
  const previous = await previousLook()
  const now = get()
  const result = await api.look({ photo, previous: previous && { photo: previous.photo, date: previous.date }, estimate, context: buildContext(now, alertsOf(now)) })
  if (result.shot !== 'ok') {
    set({ mood: 'curious' })
    return { result, photo, previous }
  }
  const date = todayKey()
  const saved = await putPhoto({ id: uid(), date, at: new Date().toISOString(), kind: 'skin', dataUrl: photo })
  set((s) => {
    const day = dayOf(s, date)
    return {
      mood: result.mood,
      days: {
        ...s.days,
        [date]: { ...day, look: { photoId: saved.id, signs: result.signs, feelings: result.feelings, summary: result.summary, change: result.change, status: result.meta.status } },
      },
    }
  })
  say(result.summary, { meta: lookMeta(result), evidence: result.evidence })
  settle()
  return { result, photo, previous }
}

function lookMeta(r: LookResult | ScanResult): string {
  const m = r.meta
  return `${m.model ?? m.tool} ${m.status} · ${m.ms} ms${m.note ? ` · ${m.note}` : ''}`
}

export function scanProduct(photos: string[]): Promise<ScanResult> {
  const now = get()
  return api.scan({ photos, context: buildContext(now, alertsOf(now)) })
}

/** Turns a scan into a shelf item: a known formula when momo has it, otherwise what the scan read or predicted. */
export function itemFromScan(r: ScanResult): ShelfItem {
  const m = matchProduct(`${r.brand} ${r.name}`)
  const addedAt = new Date().toISOString()
  if (m) {
    const p = m.product
    return { id: uid(), productId: p.id, brand: p.brand, name: p.name, category: p.category, actives: p.actives, fragranceFree: p.fragranceFree, addedAt }
  }
  return { id: uid(), brand: r.brand, name: r.name || 'Unknown product', category: r.category, actives: r.actives, fragranceFree: r.fragranceFree ?? undefined, addedAt }
}

/** What the watcher would say if this product joined the shelf. Nothing is saved. */
export function trialAlerts(item: ShelfItem): Alert[] {
  const s = get()
  const trial = { ...item, when: item.when ?? 'both' }
  return watch({ shelf: [...s.shelf, trial], profile: s.profile, days: [], today: '' }).filter((a) => a.items.includes(item.id))
}

export function onShelf(item: ShelfItem): ShelfItem | undefined {
  return get().shelf.find((i) => sameProduct(i, item))
}

export function addScanned(item: ShelfItem) {
  if (onShelf(item)) return
  set((s) => ({ shelf: [...s.shelf, item] }))
  say(`${item.brand ? `${item.brand} ` : ''}${item.name} is on your shelf now. I'll keep an eye on it.`)
  settle()
}

export { allPhotos }

// --- Shelf and diary actions -------------------------------------------------

export function addProduct(text: string): { item: ShelfItem; known: boolean } | undefined {
  const r = makeShelfItem(text)
  if (get().shelf.some((i) => sameProduct(i, r.item))) return undefined
  set((s) => ({ shelf: [...s.shelf, r.item] }))
  announceAlerts()
  return r
}

export function removeProduct(id: string) {
  set((s) => ({ shelf: s.shelf.filter((i) => i.id !== id) }))
}

export function setWhen(id: string, when: When) {
  set((s) => ({ shelf: s.shelf.map((i) => (i.id === id ? { ...i, when } : i)) }))
  announceAlerts()
}

export function dismissAlert(id: string) {
  set((s) => ({ dismissed: [...s.dismissed, id] }))
}

export function forgetFact(fact: string) {
  set((s) => ({ profile: { ...s.profile, facts: s.profile.facts.filter((f) => f !== fact) } }))
}

// --- Account: reviews, points, shop -----------------------------------------

/** Saves an anonymous review and adds its points. Points never depend on the stars or the words. */
export function addReview(r: Omit<MyReview, 'id' | 'at' | 'points'>) {
  set((s) => ({
    reviews: [{ ...r, id: uid(), at: todayKey(), points: POINTS.review }, ...(s.reviews ?? [])],
    account: s.account && { ...s.account, points: s.account.points + POINTS.review },
  }))
}

function updateAccount(fn: (a: Account) => Partial<Account>) {
  set((s) => (s.account ? { account: { ...s.account, ...fn(s.account) } } : {}))
}

/** Buys a fur color. Returns false when the points are not enough. */
export function buyFur(id: string, price: number): boolean {
  const a = get().account
  if (!a || a.points < price) return false
  if (!a.furs.includes(id)) updateAccount((x) => ({ points: x.points - price, furs: [...x.furs, id], fur: id }))
  return true
}

export const wearFur = (id: string) => updateAccount((a) => (a.furs.includes(id) ? { fur: id } : {}))
export const setPublic = (on: boolean) => updateAccount(() => ({ public: on }))
export const setSocial = (key: keyof Account['socials'], value: string) => updateAccount((a) => ({ socials: { ...a.socials, [key]: value.trim().slice(0, 40) } }))

export function setMood(mood: Mood) {
  set({ mood })
}

export function resetMemory() {
  set({ ...INITIAL })
  void clearPhotos()
}

export function exportMemory(): string {
  const { busy: _busy, ...data } = get()
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)
}

// --- Hooks -------------------------------------------------------------------

export const useMomo = <T,>(selector: (s: MomoState) => T) => useStore(momoStore, selector)

export function useAlerts(): Alert[] {
  const shelf = useMomo((s) => s.shelf)
  const profile = useMomo((s) => s.profile)
  const days = useMomo((s) => s.days)
  const dismissed = useMomo((s) => s.dismissed)
  return useMemo(
    () => watch({ shelf, profile, days: Object.values(days), today: todayKey() }).filter((a) => !dismissed.includes(a.id)),
    [shelf, profile, days, dismissed],
  )
}

export function useQuestion(): Question | null {
  const s = useMomo((st) => st)
  return useMemo(() => nextQuestion(s), [s])
}
