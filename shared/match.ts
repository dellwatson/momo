import { CATALOG } from './catalog.ts'
import type { Active, Category, Product } from './types.ts'

// Turns what a user types ("my cerave foam wash") into a known formula, or
// into a best guess from the name when momo does not know the product.

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9%+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const STOP = new Set(['the', 'and', 'with', 'for', 'my', 'new', 'skin', 'face', 'ml', 'oz'])

const BRAND_ALIASES: Record<string, string[]> = {
  'La Roche-Posay': ['la roche posay', 'lrp', 'la roche'],
  "Paula's Choice": ['paulas choice', 'paula choice', 'paulas'],
  'The Ordinary': ['the ordinary', 'ordinary'],
  'Drunk Elephant': ['drunk elephant'],
  "Kiehl's": ['kiehls', 'kiehl'],
  'Supergoop!': ['supergoop'],
  'Fenty Skin': ['fenty'],
  'Rare Beauty': ['rare beauty'],
}

function brandKeys(brand: string): string[] {
  return BRAND_ALIASES[brand] ?? [norm(brand)]
}

const CATEGORY_WORDS: [Category, RegExp][] = [
  ['sunscreen', /\b(spf|sunscreen|sun cream|sunblock|uv)\b/],
  ['cleanser', /\b(cleanser|wash|foam|foaming|cleansing|gel cleanser)\b/],
  ['toner', /\b(toner|essence|tonic|mist)\b/],
  ['eye', /\beye\b/],
  ['mask', /\b(mask|sleeping pack)\b/],
  ['serum', /\b(serum|ampoule|drops|booster)\b/],
  ['moisturizer', /\b(cream|moisturi[sz]er|lotion|balm|gel cream|emulsion)\b/],
  ['treatment', /\b(treatment|spot|exfoliant|peel|liquid)\b/],
]

const ACTIVE_WORDS: [Active, RegExp][] = [
  ['retinoid', /\b(retin(ol|al|oid)|tretinoin|adapalene|differin|retinyl)\b/],
  ['aha', /\b(aha|glycolic|lactic|mandelic|resurfacing)\b/],
  ['bha', /\b(bha|salicylic)\b/],
  ['benzoyl_peroxide', /\b(benzoyl|bpo)\b/],
  ['vitamin_c', /\b(vitamin c|vit c|ascorbic|c serum)\b/],
  ['niacinamide', /\bniacinamide\b/],
  ['azelaic_acid', /\bazelaic\b/],
  ['hyaluronic_acid', /\b(hyaluronic|ha serum)\b/],
  ['ceramides', /\bceramide/],
  ['peptides', /\bpeptide/],
  ['spf', /\b(spf|sunscreen|sun cream|sunblock)\b/],
]

export interface Match {
  product: Product
  score: number
}

export function matchProduct(text: string): Match | undefined {
  const t = ` ${norm(text)} `
  const tokens = new Set(t.trim().split(' '))
  let best: Match | undefined
  for (const p of CATALOG) {
    const brandHit = brandKeys(p.brand).some((k) => t.includes(` ${k} `))
    const nameTokens = norm([p.name, ...(p.aka ?? [])].join(' '))
      .split(' ')
      .filter((w) => w.length > 2 && !STOP.has(w))
    const overlap = nameTokens.filter((w) => tokens.has(w)).length
    const catHit = CATEGORY_WORDS.some(([c, re]) => c === p.category && re.test(t))
    const score = (brandHit ? 2 : 0) + overlap + (catHit ? 0.5 : 0)
    if (!best || score > best.score) best = { product: p, score }
  }
  // A brand plus one real word of the name, or three words of the name alone.
  return best && best.score >= 3 ? best : undefined
}

export function guessCategory(text: string): Category {
  const t = norm(text)
  return CATEGORY_WORDS.find(([, re]) => re.test(t))?.[0] ?? 'serum'
}

export function guessActives(text: string): Active[] {
  const t = norm(text)
  return ACTIVE_WORDS.filter(([, re]) => re.test(t)).map(([a]) => a)
}

export function guessBrand(text: string): string | undefined {
  const t = ` ${norm(text)} `
  for (const p of CATALOG) if (brandKeys(p.brand).some((k) => t.includes(` ${k} `))) return p.brand
  return undefined
}
