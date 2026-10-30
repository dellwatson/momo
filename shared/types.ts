// Contract between the browser (src/) and the agent server (server/).
//
// The user talks about effects, brand, comfort and results. Ingredients stay in
// the background: momo reads them to watch for problems, then speaks in effects.

/** How fresh a piece of data is. 'sample' means made-up data, used when a key is missing or a call failed. */
export type Status = 'live' | 'cached' | 'sample'

// ---------------------------------------------------------------------------
// Evidence: where each thing momo says comes from
// ---------------------------------------------------------------------------

/**
 * The kinds of fact momo can stand on. Only diary and reviews can show that a
 * product works. Qloo shows taste and popularity, never results.
 */
export const EVIDENCE_KINDS = ['diary', 'reviews', 'product', 'doctor', 'skin_scan', 'qloo'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  diary: 'Your diary',
  reviews: 'momo reviews',
  product: 'Product facts',
  doctor: 'Doctor note',
  skin_scan: 'Camera check',
  qloo: 'Taste match',
}

/** One source behind one thing momo says. */
export interface Evidence {
  kind: EvidenceKind
  status: Status
  /** How many days, people or items stand behind it. */
  count?: number
  /** A short reason in plain words, for example "from your favorite artist". */
  detail?: string
  /** A 0..1 score when the source gives one, for example Qloo affinity. */
  score?: number
  /** Date of the data (YYYY-MM-DD), when it is not from today. */
  asOf?: string
}

export const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive'] as const
export type SkinType = (typeof SKIN_TYPES)[number]

export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Shiny all over',
  dry: 'Tight or flaky',
  combination: 'Shiny T-zone, dry cheeks',
  normal: 'Mostly comfortable',
  sensitive: 'Reacts easily',
}

export const CONCERNS = [
  'acne',
  'hyperpigmentation',
  'fine_lines',
  'redness',
  'dehydration',
  'dullness',
  'large_pores',
] as const
export type Concern = (typeof CONCERNS)[number]

export const CONCERN_LABELS: Record<Concern, string> = {
  acne: 'Breakouts',
  hyperpigmentation: 'Dark spots',
  fine_lines: 'Fine lines',
  redness: 'Redness',
  dehydration: 'Dehydration',
  dullness: 'Dullness',
  large_pores: 'Visible pores',
}

export const SENSITIVITY_LEVELS = ['low', 'medium', 'high'] as const
export type Sensitivity = (typeof SENSITIVITY_LEVELS)[number]

/** Qloo audience age buckets. */
export const AGE_RANGES = ['24_and_younger', '25_to_29', '30_to_34', '35_to_44', '45_to_54', '55_and_older'] as const
export type AgeRange = (typeof AGE_RANGES)[number]

export const AGE_LABELS: Record<AgeRange, string> = {
  '24_and_younger': 'Under 25',
  '25_to_29': '25-29',
  '30_to_34': '30-34',
  '35_to_44': '35-44',
  '45_to_54': '45-54',
  '55_and_older': '55+',
}

/** What the user feels on their skin. This is the vocabulary momo talks in. */
export const FEELINGS = [
  'glowy',
  'soft',
  'calm',
  'hydrated',
  'tight',
  'oily',
  'stinging',
  'red',
  'itchy',
  'breakout',
  'flaky',
  'dull',
] as const
export type Feeling = (typeof FEELINGS)[number]

export const FEELING_LABELS: Record<Feeling, string> = {
  glowy: 'Glowy',
  soft: 'Soft',
  calm: 'Calm',
  hydrated: 'Hydrated',
  tight: 'Tight',
  oily: 'Oily',
  stinging: 'Stinging',
  red: 'Red',
  itchy: 'Itchy',
  breakout: 'Breakout',
  flaky: 'Flaky',
  dull: 'Dull',
}

export const GOOD_FEELINGS: readonly Feeling[] = ['glowy', 'soft', 'calm', 'hydrated']
export const isReaction = (f: Feeling) => !GOOD_FEELINGS.includes(f)

export const CATEGORIES = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'sunscreen', 'eye', 'mask'] as const
export type Category = (typeof CATEGORIES)[number]

export const ACTIVES = [
  'retinoid',
  'aha',
  'bha',
  'benzoyl_peroxide',
  'vitamin_c',
  'niacinamide',
  'azelaic_acid',
  'hyaluronic_acid',
  'ceramides',
  'peptides',
  'spf',
] as const
export type Active = (typeof ACTIVES)[number]

/** A formula momo knows. Users never browse these; momo matches what they own against them. */
export interface Product {
  id: string
  brand: string
  name: string
  category: Category
  price: number
  size: string
  skinTypes: SkinType[] | 'all'
  concerns: Concern[]
  actives: Active[]
  keyIngredients: string[]
  fragranceFree: boolean
  vegan: boolean
  time: 'am' | 'pm' | 'both'
  swatch: [string, string]
  description: string
  /** Names people use for it, for example "Baby Facial". Used to match what they say. */
  aka?: string[]
}

export type When = 'am' | 'pm' | 'both'

/** One product the user owns. */
export interface ShelfItem {
  id: string
  /** Set when momo matched the product to a known formula. */
  productId?: string
  brand: string
  name: string
  category: Category
  actives: Active[]
  fragranceFree?: boolean
  when?: When
  addedAt: string
  /** Stock details, all optional: YYYY-MM-DD dates, and how much is left (0..1). */
  purchasedAt?: string
  openedAt?: string
  /** Use within this many months after opening (the open-jar mark on the pack). */
  paoMonths?: number
  left?: number
  store?: string
}

export interface Profile {
  name?: string
  skinType?: SkinType
  sensitivity?: Sensitivity
  city?: string
  ageRange?: AgeRange
  gender?: 'female' | 'male'
  /** Short facts momo compiled from chats, for example "Gets red after hot showers". */
  facts: string[]
}

/** One day in the diary. */
export interface DayLog {
  date: string
  /** 1 not great, 2 okay, 3 great. */
  score?: 1 | 2 | 3
  feelings?: Feeling[]
  /** Shelf item ids used that day. */
  used?: string[]
  /** Life context: sun, stress, travel, and so on. */
  events?: string[]
  notes: string[]
  /** Today's skin check. The photo itself is in IndexedDB (src/lib/photos.ts). */
  look?: { photoId: string; signs: Signs; feelings: Feeling[]; summary: string; change: LookResult['change']; status: Status }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/**
 * Everything the model may know about the user, compiled in the browser from
 * memory. Every chat provider receives exactly this, so a provider swap keeps
 * the same context.
 */
export interface ContextPack {
  today: string
  profile: Profile
  shelf: { name: string; brand: string; category: Category; when?: When; effects: string }[]
  recentDays: string[]
  watching: string[]
  /** The user's own records for the agent's tools. Sent with chat turns only; the server keeps none of it. */
  agent?: AgentMemory
}

export interface AgentMemory {
  shelf: ShelfItem[]
  /** Recent days, newest last, without photos. */
  days: Omit<DayLog, 'look'>[]
  reviews: { productId?: string; brand: string; name: string; rating: number; text: string; at: string }[]
  trip?: { city: string; when?: string }
}

/** One tool call the agent made for a reply, shown to the user as "momo checked". */
export interface TraceStep {
  tool: string
  /** Short, plain words, for example "sunscreens in Japan". */
  label: string
  status: Status
  ms: number
  /** How many things it found. */
  count?: number
  /** qloo_taste only: Qloo's own ranking, so the proof is on screen. inCatalog: momo can recommend it. */
  top?: { name: string; pct: number; inCatalog: boolean }[]
}

export interface ChatTurn {
  role: 'user' | 'momo'
  text: string
}

export interface ChatRequest {
  context: ContextPack
  history: ChatTurn[]
  message: string
}

export const MOODS = ['happy', 'curious', 'concerned', 'excited', 'calm'] as const
export type Mood = (typeof MOODS)[number]

export interface ChatExtract {
  /** Product names the user said they own or started using. */
  products: string[]
  feelings: Feeling[]
  /** New lasting facts about the user, each under 80 characters. */
  facts: string[]
  /** Life context for today: sun, stress, travel, period, bad sleep. */
  events: string[]
}

export interface Meta {
  tool: string
  status: Status
  ms: number
  model?: string
  note?: string
}

export interface ChatResult {
  reply: string
  mood: Mood
  extract: ChatExtract
  /** What the reply stands on. Empty for small talk. */
  evidence: Evidence[]
  meta: { chat: Meta; sense: Meta; trace?: TraceStep[] }
}

// ---------------------------------------------------------------------------
// Compare (Qloo)
// ---------------------------------------------------------------------------

export interface CompareRequest {
  brands: string[]
  audience: { city?: string; ageRange?: AgeRange; gender?: 'female' | 'male' }
}

export interface CompareResult {
  /** Affinity 0..1 for each requested brand among people like the user. null: Qloo has no score (unknown brand, or no age or gender to score for). */
  brands: { brand: string; affinity: number | null }[]
  audienceLabel: string
  evidence: Evidence[]
  meta: Meta
}

// ---------------------------------------------------------------------------
// Explore (Qloo discovery)
// ---------------------------------------------------------------------------

export interface ExploreRequest {
  audience: { ageRange?: AgeRange; gender?: 'female' | 'male' }
  /** Cities to look at, for example home and the next trip. At most 2. */
  places: string[]
}

export interface TasteList {
  key: string
  /** For example "Loved by women aged 25-29" or "Loved in Tokyo". */
  label: string
  brands: { name: string; affinity: number }[]
  status: Status
  note?: string
}

export interface ExploreResult {
  lists: TasteList[]
  evidence: Evidence[]
  meta: Meta
}

/** One product's community data, from GET /api/products/:id. */
export interface ProductInfo {
  id: string
  /** Anonymous reviews. user is masked by the server, for example "sun*********ly". */
  reviews: { id: string; user: string; fur: string; skinType: SkinType; ageRange: AgeRange; city: string; rating: number; weeks: number; text: string; feelings: Feeling[]; at: string }[]
  /** How many momo users have it on their shelf. */
  owners: number
  status: Status
}

export interface HealthResult {
  chat: { provider: string; status: Status; model?: string }
  vision: { provider: string; status: Status; model?: string }
  jev: Status
  qloo: Status
}

// ---------------------------------------------------------------------------
// Vision: skin checks and product scans
// ---------------------------------------------------------------------------

/** What momo can see on the skin. Each value is 0 (none) to 1 (a lot). */
export const SIGNS = ['redness', 'dryness', 'shine', 'breakouts', 'unevenness'] as const
export type Sign = (typeof SIGNS)[number]
export type Signs = Record<Sign, number>

export const SIGN_LABELS: Record<Sign, string> = {
  redness: 'Redness',
  dryness: 'Dry patches',
  shine: 'Shine',
  breakouts: 'Breakouts',
  unevenness: 'Uneven tone',
}

export const SHOT_ISSUES = ['ok', 'too_dark', 'blurry', 'no_face', 'too_far'] as const
export type ShotIssue = (typeof SHOT_ISSUES)[number]

export interface LookRequest {
  /** JPEG data URL of today's photo, at most 768 px on the long side. */
  photo: string
  /** The last skin check, so momo can say what changed. */
  previous?: { photo: string; date: string }
  /** A rough on-device estimate (src/lib/skin-estimate.ts). Used when no vision model is set. */
  estimate?: Signs
  context: ContextPack
}

export interface LookResult {
  /** One or two kind sentences, in effects language. */
  summary: string
  signs: Signs
  /** Visible feelings, from the FEELINGS list. */
  feelings: Feeling[]
  change: 'better' | 'same' | 'worse' | 'first'
  shot: ShotIssue
  mood: Mood
  evidence: Evidence[]
  meta: Meta
}

export interface ScanRequest {
  /** One or two JPEG data URLs: the front, and the back label if the user took it. */
  photos: string[]
  context: ContextPack
}

export interface ScanResult {
  found: boolean
  brand: string
  name: string
  category: Category
  actives: Active[]
  /** null when momo cannot tell. */
  fragranceFree: boolean | null
  /** 'read' when the ingredient list was visible, 'predicted' when momo knows the product from its front. */
  basis: 'read' | 'predicted' | 'none'
  /** The first ingredients as printed, when the label was visible. */
  ingredients: string[]
  /** What it does, in effects language. */
  effects: string
  evidence: Evidence[]
  meta: Meta
}
