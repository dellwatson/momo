import { PRODUCT_BY_ID } from '@shared/catalog.ts'
import type { DayLog, Feeling, ShelfItem, When } from '@shared/types.ts'
import { todayKey, type Message, type MomoState, type MyReview } from '@/lib/memory'

// The demo account for the prototype: one signed-in user with two weeks of
// history, so every screen has something to show. All of it is sample data.
// Today is left open, so momo still asks today's check-in.

/** Raise this when the demo data changes: an older demo account is replaced on the next load. */
export const DEMO_VERSION = 2

const DAY = 86_400_000
const dateAgo = (n: number, now: Date) => todayKey(new Date(now.getTime() - n * DAY))

function shelfItem(productId: string, when: When, stock: Partial<ShelfItem>, now: Date, boughtDaysAgo: number): ShelfItem {
  const p = PRODUCT_BY_ID.get(productId)!
  return {
    id: `demo-${productId}`,
    productId,
    brand: p.brand,
    name: p.name,
    category: p.category,
    actives: p.actives,
    fragranceFree: p.fragranceFree,
    when,
    addedAt: new Date(now.getTime() - boughtDaysAgo * DAY).toISOString(),
    purchasedAt: dateAgo(boughtDaysAgo, now),
    ...stock,
  }
}

export function demoState(now = new Date()): MomoState {
  const shelf = [
    shelfItem('cerave-foaming-cleanser', 'both', { openedAt: dateAgo(58, now), paoMonths: 12, left: 0.35, store: 'Sociolla' }, now, 60),
    shelfItem('the-ordinary-niacinamide', 'am', { openedAt: dateAgo(40, now), paoMonths: 12, left: 0.55, store: 'Shopee' }, now, 45),
    shelfItem('paulas-choice-bha', 'pm', { openedAt: dateAgo(30, now), paoMonths: 12, left: 0.7, store: 'Sephora' }, now, 32),
    shelfItem('the-ordinary-retinol', 'pm', { openedAt: dateAgo(9, now), paoMonths: 6, left: 0.92, store: 'Shopee' }, now, 10),
    shelfItem('laneige-water-sleeping', 'pm', { openedAt: dateAgo(170, now), paoMonths: 6, left: 0.15, store: 'Sociolla' }, now, 175),
    shelfItem('supergoop-unseen', 'am', { openedAt: dateAgo(20, now), paoMonths: 12, left: 0.6, store: 'Sephora' }, now, 22),
  ]
  const id = (pid: string) => `demo-${pid}`
  const am = [id('cerave-foaming-cleanser'), id('the-ordinary-niacinamide'), id('supergoop-unseen')]

  // 14 days of check-ins. Sport days (badminton) and the BHA nights are where
  // the small reactions are, which is what momo learns from.
  const days: Record<string, DayLog> = {}
  const plan: { score: 1 | 2 | 3; feelings: Feeling[]; pm: string[]; events?: string[]; note?: string }[] = [
    { score: 3, feelings: ['soft', 'calm'], pm: ['cerave-foaming-cleanser', 'laneige-water-sleeping'] },
    { score: 2, feelings: ['oily'], pm: ['cerave-foaming-cleanser', 'paulas-choice-bha'], events: ['badminton'], note: 'Played badminton, very sweaty. Used the BHA after, it stung a little.' },
    { score: 3, feelings: ['soft'], pm: ['cerave-foaming-cleanser', 'laneige-water-sleeping'] },
    { score: 3, feelings: ['glowy'], pm: ['cerave-foaming-cleanser', 'paulas-choice-bha'] },
    { score: 2, feelings: ['oily', 'dull'], pm: ['cerave-foaming-cleanser', 'laneige-water-sleeping'], note: 'Long day in the office, air con all day.' },
    { score: 3, feelings: ['calm'], pm: ['cerave-foaming-cleanser', 'the-ordinary-retinol'], note: 'First night with the retinol. No sting.' },
    { score: 3, feelings: ['soft', 'hydrated'], pm: ['cerave-foaming-cleanser', 'laneige-water-sleeping'] },
    { score: 1, feelings: ['stinging', 'red'], pm: ['cerave-foaming-cleanser', 'paulas-choice-bha', 'the-ordinary-retinol'], events: ['badminton'], note: 'Tried BHA and retinol on the same night after badminton. Cheeks went red.' },
    { score: 2, feelings: ['tight'], pm: ['cerave-foaming-cleanser', 'laneige-water-sleeping'] },
    { score: 3, feelings: ['calm', 'soft'], pm: ['cerave-foaming-cleanser', 'laneige-water-sleeping'] },
    { score: 3, feelings: ['glowy'], pm: ['cerave-foaming-cleanser', 'the-ordinary-retinol'] },
    { score: 2, feelings: ['oily'], pm: ['cerave-foaming-cleanser', 'paulas-choice-bha'], events: ['badminton'] },
    { score: 3, feelings: ['soft'], pm: ['cerave-foaming-cleanser', 'laneige-water-sleeping'] },
    { score: 3, feelings: ['calm', 'hydrated'], pm: ['cerave-foaming-cleanser', 'the-ordinary-retinol'], note: 'Retinol night without the BHA. All good.' },
  ]
  plan.forEach((d, i) => {
    const date = dateAgo(plan.length - i, now)
    days[date] = {
      date,
      score: d.score,
      feelings: d.feelings,
      used: [...am, ...d.pm.map(id)],
      events: d.events ?? [],
      notes: d.note ? [d.note] : [],
    }
  })

  // Older, lighter check-ins back to the day Sari joined, with a few gaps
  // (day 15 is one, so the current streak is the last 14 days).
  const EARLY: Feeling[][] = [['soft'], ['calm'], ['oily'], ['hydrated'], ['glowy'], ['tight']]
  for (let n = 16; n <= 75; n++) {
    if (n % 7 === 3 || n % 11 === 0) continue
    const date = dateAgo(n, now)
    const f = EARLY[n % EARLY.length]
    days[date] = { date, score: f[0] === 'oily' || f[0] === 'tight' ? 2 : 3, feelings: f, events: [], notes: n % 5 === 0 ? ['Short note from the evening check-in.'] : [] }
  }

  const y = new Date(now.getTime() - DAY)
  const at = (h: number, m: number) => new Date(y.getFullYear(), y.getMonth(), y.getDate(), h, m).toISOString()
  const messages: Message[] = [
    { id: 'demo-m1', role: 'user', text: 'I am going to Tokyo in December. Which sunscreen should I bring?', at: at(20, 4) },
    {
      id: 'demo-m2',
      role: 'momo',
      text: 'Your Supergoop Unseen works well for you on humid days. Tokyo in December is cold and dry, so a lighter matte one may feel tight. Want me to look at what people with your skin type use there?',
      at: at(20, 4),
      evidence: [
        { kind: 'diary', status: 'sample', count: 14, detail: '14 days with Supergoop Unseen' },
        { kind: 'reviews', status: 'sample', count: 4, detail: 'combination skin reviews' },
      ],
    },
    { id: 'demo-m3', role: 'user', text: 'Yes please. Also my Laneige mask is almost empty.', at: at(20, 6) },
    {
      id: 'demo-m4',
      role: 'momo',
      text: 'Noted: Laneige Water Sleeping Mask is about 15% left, and it was opened almost six months ago, so it is close to its use-by time anyway. I will show you options in Explore.',
      at: at(20, 6),
      evidence: [{ kind: 'product', status: 'sample', detail: 'opened 170 days ago, use within 6 months' }],
    },
  ]

  const reviews: MyReview[] = [
    { id: 'demo-r1', productId: 'cerave-foaming-cleanser', brand: 'CeraVe', name: PRODUCT_BY_ID.get('cerave-foaming-cleanser')!.name, rating: 5, text: 'Clean after badminton without feeling stripped.', at: dateAgo(20, now), points: 20 },
    { id: 'demo-r2', productId: 'paulas-choice-bha', brand: "Paula's Choice", name: PRODUCT_BY_ID.get('paulas-choice-bha')!.name, rating: 4, text: 'Clears my nose. Stings on sport days, so I skip it then.', at: dateAgo(9, now), points: 20 },
    { id: 'demo-r3', productId: 'laneige-water-sleeping', brand: 'Laneige', name: PRODUCT_BY_ID.get('laneige-water-sleeping')!.name, rating: 4, text: 'Soft in the morning. A bit sticky on hot nights.', at: dateAgo(3, now), points: 20 },
  ]

  return {
    version: 1,
    account: {
      handle: 'sari',
      joined: dateAgo(75, now),
      points: 340,
      furs: ['sky', 'peach'],
      fur: 'sky',
      public: false,
      socials: { instagram: '' },
      trip: { city: 'Tokyo', when: 'December' },
      demo: true,
      demoVersion: DEMO_VERSION,
    },
    reviews,
    profile: {
      name: 'Sari',
      skinType: 'combination',
      sensitivity: 'medium',
      city: 'Jakarta',
      ageRange: '25_to_29',
      gender: 'female',
      facts: ['Plays badminton three evenings a week', 'Going to Tokyo in December', 'Likes light gel textures in humid weather', 'Fan of Muji and BLACKPINK'],
    },
    shelf,
    days,
    messages,
    flags: { shelfDone: true, city: true, age: true },
    dismissed: [],
    // Left empty, so momo raises the BHA and retinol note on the first visit.
    seenAlerts: [],
    mood: 'happy',
    busy: false,
  }
}
