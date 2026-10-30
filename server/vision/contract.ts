import { z } from 'zod'
import { ACTIVES, CATEGORIES, FEELINGS, MOODS, SHOT_ISSUES, type ContextPack, type LookResult, type ScanResult, type Signs } from '../../shared/types.ts'

// The one contract every vision provider follows, like server/chat/contract.ts.
// momo looks at two things: the user's skin, and the products they hold up.

export const LOOK_SYSTEM = `You are momo's eyes inside a skincare diary app. The person takes a selfie most days so you can follow how their skin changes.

Look only at the skin. Never identify the person, guess their identity, or comment on their looks, age or attractiveness.

Score what you can see, each from 0 (none) to 1 (a lot): redness, dryness (flaky or rough patches), shine, breakouts, unevenness (blotchy or uneven tone).
Lighting and camera change a photo a lot. Do not score a change that could only be lighting.

If a previous photo is given, set change to better, same or worse for the skin overall. Without one, set change to first.
Set shot to too_dark, blurry, no_face or too_far when the photo is not good enough, and keep the scores low and the summary about retaking the photo.

The summary is what momo says out loud: 1 or 2 short, warm sentences about what changed or what you see, in plain words about how the skin looks and feels. No ingredients. No diagnosis. Never judge: do not say the skin looks worse, bad, damaged or older. When a sign went up, name the sign and the place in neutral words ("a little more redness on the cheeks than last time") and ask a curious question about what changed. When you are not sure, ask for a better photo (light from the front, same spot as last time) instead of guessing. Use the memory block to link a change to their products or life events only when the diary supports it.
feelings: only what is visible, from the allowed list. You are not a doctor. For anything that looks painful, swollen, infected, or like a spreading rash, say they should see a dermatologist.`

export const LookSchema = z.object({
  summary: z.string(),
  redness: z.number(),
  dryness: z.number(),
  shine: z.number(),
  breakouts: z.number(),
  unevenness: z.number(),
  feelings: z.array(z.enum(FEELINGS)),
  change: z.enum(['better', 'same', 'worse', 'first']),
  shot: z.enum(SHOT_ISSUES),
  mood: z.enum(MOODS),
})

export const SCAN_SYSTEM = `You are momo's eyes inside a skincare diary app. The person holds a skincare product up to the camera.

1. Read the brand and product name from the packaging. If you cannot see a skincare product, set found to false.
2. If an ingredient list is visible, copy its first 15 ingredients as printed and set basis to read.
3. If only the front is visible and you know this product, predict its key actives from what you know and set basis to predicted. If you do not know it, guess actives from the name and claims on the pack, and still set basis to predicted.
4. actives: only from the allowed list. fragranceFree: true or false when the label or your knowledge says so, otherwise null.
5. effects: what it does for the skin, in 3 to 8 plain words, for example "gentle cleanse, keeps skin soft". No ingredient names.`

export const ScanSchema = z.object({
  found: z.boolean(),
  brand: z.string(),
  name: z.string(),
  category: z.enum(CATEGORIES),
  actives: z.array(z.enum(ACTIVES)),
  fragranceFree: z.boolean().nullable(),
  basis: z.enum(['read', 'predicted', 'none']),
  ingredients: z.array(z.string()),
  effects: z.string(),
})

export type LookDraft = Omit<LookResult, 'meta' | 'evidence'> & { model?: string }
export type ScanDraft = Omit<ScanResult, 'meta' | 'evidence'> & { model?: string }

export interface Image {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  data: string
}

export interface LookInput {
  photo: Image
  previous?: { photo: Image; date: string }
  context: string
  /** The rough on-device estimate from the browser, used when no vision model is set. */
  estimate?: Signs
}

export interface ScanInput {
  photos: Image[]
  context: string
  pack: ContextPack
}

export interface VisionProvider {
  name: string
  model?: string
  available(): boolean
  look(input: LookInput): Promise<LookDraft>
  scan(input: ScanInput): Promise<ScanDraft>
}

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Parses a data URL from the browser. Returns undefined for anything that is not a small image. */
export function parseImage(url: unknown, maxBytes = 1_500_000): Image | undefined {
  if (typeof url !== 'string' || url.length > maxBytes) return undefined
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(url)
  if (!m || !TYPES.has(m[1])) return undefined
  return { mediaType: m[1] as Image['mediaType'], data: m[2] }
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
