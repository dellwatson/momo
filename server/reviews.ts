import { CATALOG, PRODUCT_BY_ID } from '../shared/catalog.ts'
import { reviewsFor } from '../shared/reviews.ts'
import type { ProductInfo } from '../shared/types.ts'

// Reviews for one product, as the app shows them. The username is masked here,
// on the server, so the full name never reaches the browser: "sunscreen.daily"
// becomes "sun*********ly". The handles below are SAMPLE accounts for the demo.

const HANDLES = [
  'sunscreen.daily', 'oilyinbandung', 'tokyodewy', 'calmcheeks', 'mochi.skin', 'nightowl.glow', 'rinadewi', 'kenji_t', 'ayu.skincare', 'maya.lim',
  'dewdrop22', 'badminton.girl', 'jkt.glow', 'osaka.niko', 'seoulsoft', 'bangkokbloom', 'manila.mae', 'sg.serene', 'putri.pores', 'hana.uv',
  'dita.daily', 'lukas.k', 'tara.matte', 'nadia.n', 'yuki.mist', 'citra.c', 'joy.jakarta', 'mei.ling', 'arif.skin', 'sora.sun',
  'bunga.b', 'kai.kyoto', 'linda.lotion', 'fajar.f', 'emi.e', 'gita.glow', 'rio.r', 'wulan.w', 'aiko.a', 'sinta.s', 'hiro.h', 'nina.nightcream',
]
const FURS = ['sky', 'peach', 'mint', 'lilac', 'honey', 'night']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Keeps the first 3 and last 2 characters: enough to tell reviewers apart, not to find them. */
export function maskName(handle: string): string {
  if (handle.length <= 5) return `${handle[0]}****`
  return `${handle.slice(0, 3)}${'*'.repeat(Math.max(4, handle.length - 5))}${handle.slice(-2)}`
}

export function productInfo(id: string): ProductInfo | undefined {
  const p = PRODUCT_BY_ID.get(id)
  if (!p) return undefined
  const reviews = reviewsFor(id).map((r) => {
    const n = Number(r.id.replace('sample-', ''))
    const handle = HANDLES[(n * 7) % HANDLES.length]
    return { ...r, user: maskName(handle), fur: FURS[hash(handle) % FURS.length] }
  })
  // Sample owner count: steady per product, larger for products with more reviews.
  const owners = 80 + (hash(id) % 900) + reviews.length * 140
  return { id, reviews, owners, status: 'sample' }
}

export const productIds = () => CATALOG.map((p) => p.id)
