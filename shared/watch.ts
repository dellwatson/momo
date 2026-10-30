import { PRODUCT_BY_ID } from './catalog.ts'
import { FEELING_LABELS, isReaction, type Active, type DayLog, type Feeling, type Profile, type ShelfItem, type When } from './types.ts'

// momo's silent watcher. It reads formulas, skin profile and diary, and reports
// problems in the words a user cares about: how the skin will feel and what to
// do. The ingredient detail goes in `why`, which the UI shows only on request.

export type AlertLevel = 'stop' | 'watch' | 'tip'

export interface Alert {
  /** Stable, so a dismissed alert stays dismissed. */
  id: string
  level: AlertLevel
  title: string
  body: string
  tip: string
  why: string
  items: string[]
}

const STRONG: Active[] = ['retinoid', 'aha', 'bha', 'benzoyl_peroxide']
const EXFOLIANT: Active[] = ['retinoid', 'aha', 'bha']

const has = (i: ShelfItem, ...a: Active[]) => a.some((x) => i.actives.includes(x))
const label = (i: ShelfItem) => (i.brand ? `${i.brand} ${i.name}` : i.name)

function whenOf(i: ShelfItem): When {
  return i.when ?? (i.productId ? PRODUCT_BY_ID.get(i.productId)?.time : undefined) ?? 'both'
}

function overlap(a: ShelfItem, b: ShelfItem): 'am' | 'pm' | undefined {
  const wa = whenOf(a)
  const wb = whenOf(b)
  // Two all-day products meet at night first, where the strong steps usually sit.
  if (wa === 'both') return wb === 'both' ? 'pm' : wb
  if (wb === 'both') return wa
  return wa === wb ? wa : undefined
}

const slotWord = (s: 'am' | 'pm') => (s === 'am' ? 'morning' : 'night')

interface PairRule {
  key: string
  a: Active[]
  b: Active[]
  level: AlertLevel
  title: string
  body: (x: string, y: string, slot: string) => string
  tip: (x: string, y: string) => string
  why: (x: string, y: string) => string
}

const PAIR_RULES: PairRule[] = [
  {
    key: 'retinoid+acid',
    a: ['retinoid'],
    b: ['aha', 'bha'],
    level: 'watch',
    title: 'These two together can make your skin sting and peel',
    body: (x, y, slot) => `You use ${x} and ${y} in the same ${slot}. Both renew the skin fast, and together they can leave it red, raw and flaky.`,
    tip: (x, y) => `Split them: ${x} on Monday, Wednesday and Friday nights, ${y} on the other nights.`,
    why: (x, y) => `${x} has a retinoid. ${y} has an exfoliating acid (AHA or BHA). Together they break down the skin barrier faster than it can repair.`,
  },
  {
    key: 'retinoid+bpo',
    a: ['retinoid'],
    b: ['benzoyl_peroxide'],
    level: 'watch',
    title: 'One of these can cancel out the other',
    body: (x, y, slot) => `${x} and ${y} in the same ${slot} can make each other work less, and both are drying.`,
    tip: (x, y) => `Use ${y} in the morning and keep ${x} for night.`,
    why: (x, y) => `Benzoyl peroxide in ${y} can break down the retinoid in ${x}. Both also dry the skin.`,
  },
  {
    key: 'vitc+acid',
    a: ['vitamin_c'],
    b: ['aha', 'bha'],
    level: 'tip',
    title: 'This pair can sting, and your glow product may work less',
    body: (x, y, slot) => `${x} and ${y} in the same ${slot} can tingle on sensitive spots and make the brightening weaker.`,
    tip: (x, y) => `Move ${x} to the morning and keep ${y} for night.`,
    why: (x, y) => `Vitamin C in ${x} works best at its own pH. The acid in ${y} changes it and adds irritation.`,
  },
  {
    key: 'vitc+bpo',
    a: ['vitamin_c'],
    b: ['benzoyl_peroxide'],
    level: 'tip',
    title: 'Your brightening product may stop working',
    body: (x, y, slot) => `${y} in the same ${slot} can wear out ${x} before it does its job.`,
    tip: () => 'Use them at different times of day, or on different days.',
    why: (x, y) => `Benzoyl peroxide in ${y} oxidizes the vitamin C in ${x}.`,
  },
]

function pairAlerts(shelf: ShelfItem[]): Alert[] {
  const out: Alert[] = []
  for (const rule of PAIR_RULES)
    for (const x of shelf)
      for (const y of shelf) {
        if (x.id === y.id || !has(x, ...rule.a) || !has(y, ...rule.b)) continue
        const slot = overlap(x, y)
        if (!slot) continue
        const [nx, ny] = [label(x), label(y)]
        out.push({
          id: `pair:${rule.key}:${x.id}:${y.id}`,
          level: rule.level,
          title: rule.title,
          body: rule.body(nx, ny, slotWord(slot)),
          tip: rule.tip(nx, ny),
          why: rule.why(nx, ny),
          items: [x.id, y.id],
        })
      }
  return out
}

function overloadAlerts(shelf: ShelfItem[]): Alert[] {
  const out: Alert[] = []
  for (const slot of ['am', 'pm'] as const) {
    const strong = shelf.filter((i) => has(i, ...EXFOLIANT) && (whenOf(i) === slot || whenOf(i) === 'both'))
    if (strong.length < 3) continue
    out.push({
      id: `overload:${slot}:${strong.map((i) => i.id).sort().join(',')}`,
      level: 'stop',
      title: `Your ${slotWord(slot)} routine is a lot for your skin`,
      body: `${strong.length} of your ${slotWord(slot)} products all push the skin to renew. That is the most common way people end up red and sore.`,
      tip: 'Keep one of them each night, and give your skin two nights a week with only cleanser and moisturizer.',
      why: `${strong.map(label).join(', ')} each contain a retinoid or an exfoliating acid.`,
      items: strong.map((i) => i.id),
    })
  }
  return out
}

function skinAlerts(shelf: ShelfItem[], profile: Profile): Alert[] {
  const out: Alert[] = []
  const reactive = profile.sensitivity === 'high' || profile.skinType === 'sensitive'
  for (const i of shelf) {
    const p = i.productId ? PRODUCT_BY_ID.get(i.productId) : undefined
    const fragranceFree = i.fragranceFree ?? p?.fragranceFree
    if (reactive && fragranceFree === false)
      out.push({
        id: `fragrance:${i.id}`,
        level: 'watch',
        title: `${i.name} may sting or turn your skin red`,
        body: `You told me your skin reacts easily, and ${label(i)} is scented.`,
        tip: 'Test it on your jaw for three days first. If it stays calm, keep going.',
        why: `${label(i)} contains added fragrance, a common trigger for reactive skin.`,
        items: [i.id],
      })
    if (reactive && has(i, ...STRONG))
      out.push({
        id: `slow:${i.id}`,
        level: 'tip',
        title: `Go slow with ${i.name}`,
        body: `${label(i)} is strong. Reactive skin likes it better in small steps.`,
        tip: 'Start with two nights a week, and add one more night each week if your skin stays calm.',
        why: `${label(i)} contains ${i.actives.filter((a) => STRONG.includes(a)).join(', ').replace(/_/g, ' ')}.`,
        items: [i.id],
      })
    if (p && profile.skinType && p.skinTypes !== 'all' && !p.skinTypes.includes(profile.skinType) && ['moisturizer', 'cleanser'].includes(p.category)) {
      const heavy = profile.skinType === 'oily' || profile.skinType === 'combination'
      out.push({
        id: `fit:${i.id}:${profile.skinType}`,
        level: 'tip',
        title: heavy ? `${i.name} may feel heavy on you` : `${i.name} may leave your skin tight`,
        body: heavy
          ? `${label(i)} is made for drier skin. On your skin it can feel greasy and clog pores.`
          : `${label(i)} is made for oilier skin. It can take more moisture than your skin wants to give.`,
        tip: heavy ? 'Use a thin layer, or keep it for dry winter days.' : 'Follow it with a richer moisturizer, or use it only at night.',
        why: `${label(i)} is designed for ${p.skinTypes.join(', ')} skin. You told me yours is ${profile.skinType}.`,
        items: [i.id],
      })
    }
  }
  const sunSensitive = shelf.filter((i) => has(i, 'retinoid', 'aha'))
  if (sunSensitive.length && !shelf.some((i) => has(i, 'spf') || i.category === 'sunscreen'))
    out.push({
      id: `sun:${sunSensitive.map((i) => i.id).sort().join(',')}`,
      level: 'watch',
      title: 'Your skin burns faster with what you use',
      body: `${sunSensitive.map(label).join(' and ')} make fresh skin come to the surface, and fresh skin burns easily. I don't see a sunscreen on your shelf.`,
      tip: 'Add a daily sunscreen. I can compare a few that people like you love.',
      why: 'Retinoids and AHAs thin the outer layer of skin for a while, which raises UV sensitivity.',
      items: sunSensitive.map((i) => i.id),
    })
  return out
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** Links what the user felt to what they used. */
function diaryAlerts(shelf: ShelfItem[], days: DayLog[], today: string): Alert[] {
  const out: Alert[] = []
  const logged = days.filter((d) => d.used && d.feelings)
  for (const i of shelf) {
    const on = logged.filter((d) => d.used!.includes(i.id))
    const off = logged.filter((d) => !d.used!.includes(i.id))
    const rate = (ds: DayLog[]) => (ds.length ? ds.filter((d) => d.feelings!.some(isReaction)).length / ds.length : 0)
    if (on.length >= 3 && rate(on) >= 0.6 && rate(on) >= rate(off) + 0.3) {
      const counts = new Map<Feeling, number>()
      for (const d of on) for (const f of d.feelings!) if (isReaction(f)) counts.set(f, (counts.get(f) ?? 0) + 1)
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => FEELING_LABELS[f].toLowerCase())
      const bad = on.filter((d) => d.feelings!.some(isReaction)).length
      out.push({
        id: `diary:${i.id}`,
        level: 'stop',
        title: `${i.name} might be behind your ${top.join(' and ')} skin`,
        body: `On ${bad} of the ${on.length} days you used it, you told me your skin felt ${top.join(' or ')}. On other days it was calmer.`,
        tip: 'Pause it for three days. If your skin calms down, we found it.',
        why: i.actives.length
          ? `${label(i)} contains ${i.actives.join(', ').replace(/_/g, ' ')}.`
          : `I don't know the formula of ${label(i)}, so this is from your diary only.`,
        items: [i.id],
      })
    }
    const todayLog = days.find((d) => d.date === today)
    // Only a change against a baseline: the diary must have days from before the product arrived.
    const added = i.addedAt.slice(0, 10)
    const isNew = daysBetween(added, today) <= 3 && days.some((d) => d.date < added)
    if (isNew && todayLog?.feelings?.some(isReaction) && (todayLog.used?.includes(i.id) ?? true))
      out.push({
        id: `new:${i.id}:${today}`,
        level: 'watch',
        title: `This started after you added ${i.name}`,
        body: `You added ${label(i)} in the last few days, and today your skin does not feel right.`,
        tip: 'Skip it tonight and tell me tomorrow how your skin feels.',
        why: i.actives.length ? `${label(i)} contains ${i.actives.join(', ').replace(/_/g, ' ')}.` : 'New products are the most common cause of a sudden change.',
        items: [i.id],
      })
  }
  return out
}

const ORDER: Record<AlertLevel, number> = { stop: 0, watch: 1, tip: 2 }

export function watch(input: { shelf: ShelfItem[]; profile: Profile; days: DayLog[]; today: string }): Alert[] {
  const all = [
    ...overloadAlerts(input.shelf),
    ...pairAlerts(input.shelf),
    ...skinAlerts(input.shelf, input.profile),
    ...diaryAlerts(input.shelf, input.days, input.today),
  ]
  return all.sort((a, b) => ORDER[a.level] - ORDER[b.level])
}

const ACTIVE_EFFECTS: Partial<Record<Active, string>> = {
  retinoid: 'smooths lines and texture',
  aha: 'exfoliates for a smoother glow',
  bha: 'clears pores',
  benzoyl_peroxide: 'fights breakouts',
  vitamin_c: 'brightens',
  niacinamide: 'calms oil and redness',
  azelaic_acid: 'evens tone and calms redness',
  hyaluronic_acid: 'hydrates',
  ceramides: 'repairs the skin barrier',
  peptides: 'firms',
  spf: 'protects from sun',
}

/** What a product does, in the words a user uses. */
export function effectsOf(i: Pick<ShelfItem, 'actives' | 'category'>): string {
  const fx = i.actives.map((a) => ACTIVE_EFFECTS[a]).filter(Boolean)
  if (fx.length) return [...new Set(fx)].slice(0, 2).join(', ')
  return { cleanser: 'cleans', toner: 'preps and refreshes', serum: 'treats', treatment: 'treats', moisturizer: 'moisturizes', sunscreen: 'protects from sun', eye: 'cares for the eye area', mask: 'boosts' }[i.category]
}
