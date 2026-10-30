// Where each brand can be bought, by market. SAMPLE data for the prototype:
// store lists are illustrative, not live stock. The agent says so.

export const MARKETS = ['Indonesia', 'Japan', 'Singapore'] as const
export type Market = (typeof MARKETS)[number]

const CITY_MARKET: Record<string, Market> = {
  jakarta: 'Indonesia',
  bandung: 'Indonesia',
  surabaya: 'Indonesia',
  bali: 'Indonesia',
  denpasar: 'Indonesia',
  yogyakarta: 'Indonesia',
  tokyo: 'Japan',
  osaka: 'Japan',
  kyoto: 'Japan',
  sapporo: 'Japan',
  fukuoka: 'Japan',
  singapore: 'Singapore',
}

/** The market for a city or a country name, if momo knows it. */
export function marketOf(place?: string): Market | undefined {
  if (!place) return undefined
  const k = place.trim().toLowerCase()
  return CITY_MARKET[k] ?? MARKETS.find((m) => m.toLowerCase() === k)
}

const BRAND_STORES: Record<string, Partial<Record<Market, string[]>>> = {
  CeraVe: { Indonesia: ['Guardian', 'Sociolla', 'Shopee'], Japan: ['Amazon Japan'], Singapore: ['Watsons', 'Guardian'] },
  'La Roche-Posay': { Indonesia: ['Sociolla', 'Guardian'], Japan: ['Matsumoto Kiyoshi', 'Loft'], Singapore: ['Watsons'] },
  'The Ordinary': { Indonesia: ['Sociolla', 'Shopee'], Japan: ['Amazon Japan'], Singapore: ['Sephora'] },
  "Paula's Choice": { Indonesia: ['Sephora', 'Sociolla'], Japan: ["Paula's Choice online"], Singapore: ['Sephora'] },
  'Supergoop!': { Indonesia: ['Sephora'], Singapore: ['Sephora'] },
  Laneige: { Indonesia: ['Sociolla', 'Shopee'], Japan: ['Loft', 'Plaza'], Singapore: ['Sephora'] },
  'Drunk Elephant': { Indonesia: ['Sephora'], Singapore: ['Sephora'] },
  Glossier: { Indonesia: ['Online, ships from abroad'], Japan: ['Online, ships from abroad'], Singapore: ['Online, ships from abroad'] },
  Tatcha: { Indonesia: ['Sephora'], Japan: ['Isetan'], Singapore: ['Sephora'] },
  "Kiehl's": { Indonesia: ["Kiehl's stores"], Japan: ["Kiehl's stores"], Singapore: ["Kiehl's stores"] },
  Clinique: { Indonesia: ['Department stores'], Japan: ['Department stores'], Singapore: ['Department stores'] },
  Shiseido: { Indonesia: ['Sociolla', 'Shopee'], Japan: ['Matsumoto Kiyoshi', 'Don Quijote', 'Loft'], Singapore: ['Watsons'] },
  'Bioré': { Indonesia: ['Guardian', 'Shopee'], Japan: ['Matsumoto Kiyoshi', 'Don Quijote', 'Any drugstore'], Singapore: ['Watsons', 'Guardian'] },
  'DR CI:LABO': { Japan: ['Matsumoto Kiyoshi', 'Loft'], Singapore: ['Watsons'] },
  'Fenty Skin': { Indonesia: ['Sephora'], Singapore: ['Sephora'] },
  'Rare Beauty': { Indonesia: ['Sephora'], Singapore: ['Sephora'] },
  Neutrogena: { Indonesia: ['Guardian', 'Watsons', 'Shopee'], Japan: ['Amazon Japan', 'Don Quijote'], Singapore: ['Watsons', 'Guardian'] },
  'Bondi Sands': { Indonesia: ['Sociolla', 'Shopee'], Japan: ['Amazon Japan'], Singapore: ['Watsons'] },
  'Sun Bum': { Indonesia: ['Shopee'], Japan: ['Amazon Japan'], Singapore: ['Watsons'] },
  Cetaphil: { Indonesia: ['Guardian', 'Watsons', 'Shopee'], Japan: ['Amazon Japan', 'Matsumoto Kiyoshi'], Singapore: ['Watsons', 'Guardian'] },
  Aveeno: { Indonesia: ['Guardian', 'Shopee'], Japan: ['Amazon Japan'], Singapore: ['Watsons', 'Guardian'] },
  'Clean & Clear': { Indonesia: ['Guardian', 'Indomaret', 'Shopee'], Japan: ['Amazon Japan'], Singapore: ['Watsons', 'Guardian'] },
}

export function storesFor(brand: string, market: Market): string[] {
  return BRAND_STORES[brand]?.[market] ?? []
}

// Store search pages, only where the address pattern is known. Other stores show as names only.
const STORE_SEARCH: Record<string, (q: string) => string> = {
  Shopee: (q) => `https://shopee.co.id/search?keyword=${encodeURIComponent(q)}`,
  'Amazon Japan': (q) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}`,
}

export function storeLink(store: string, product: string): string | undefined {
  return STORE_SEARCH[store]?.(product)
}
