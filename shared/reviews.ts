import type { AgeRange, Feeling, SkinType } from './types.ts'

// Sample peer reviews for the prototype. They are written for the demo and are
// NOT real user reviews: every screen that shows them says "sample".
// A real review is anonymous: skin type, age group and city, never a name.

export interface PeerReview {
  id: string
  productId: string
  skinType: SkinType
  ageRange: AgeRange
  city: string
  rating: 1 | 2 | 3 | 4 | 5
  /** How long they used it before the review. */
  weeks: number
  text: string
  feelings: Feeling[]
  at: string
}

type Row = [string, SkinType, AgeRange, string, PeerReview['rating'], number, string, Feeling[], string]

const ROWS: Row[] = [
  // Sunscreens
  ['supergoop-unseen', 'combination', '25_to_29', 'Jakarta', 5, 8, 'Sits like a primer, no white cast. My T-zone stays matte until lunch even in the humidity.', ['soft'], '2026-10-21'],
  ['supergoop-unseen', 'oily', '25_to_29', 'Bandung', 4, 6, 'Light and invisible. A bit slippy on my nose by the afternoon, so I blot once.', ['oily'], '2026-10-12'],
  ['supergoop-unseen', 'sensitive', '30_to_34', 'Singapore', 3, 4, 'No sting, but the silicone feel pilled under my moisturizer twice.', ['calm'], '2026-09-30'],
  ['supergoop-unseen', 'dry', '30_to_34', 'Tokyo', 3, 5, 'Too mattifying for winter here. Fine over a rich cream.', ['tight'], '2026-10-02'],
  ['lrp-anthelios', 'combination', '25_to_29', 'Tokyo', 5, 12, 'Survived a full day walking in Shibuya. Watery and it does not run into my eyes when I sweat.', ['calm'], '2026-10-18'],
  ['lrp-anthelios', 'oily', '24_and_younger', 'Jakarta', 4, 6, 'Fluid texture is great for humidity. Reapplying over makeup is hard though.', ['soft'], '2026-10-08'],
  ['lrp-anthelios', 'sensitive', '35_to_44', 'Osaka', 5, 20, 'The only sunscreen that never makes my cheeks red.', ['calm'], '2026-09-14'],
  ['lrp-anthelios', 'combination', '30_to_34', 'Surabaya', 4, 8, 'Good after badminton, no sting even with sweat. A little shine by evening.', ['calm', 'oily'], '2026-10-25'],
  ['cerave-am-lotion', 'dry', '30_to_34', 'Seoul', 4, 10, 'Moisturizer and SPF in one. Slight white tint that goes after a few minutes.', ['hydrated'], '2026-10-05'],
  ['cerave-am-lotion', 'oily', '25_to_29', 'Jakarta', 2, 3, 'Too heavy for me in this weather. I got shiny within an hour.', ['oily'], '2026-10-16'],
  ['cerave-am-lotion', 'combination', '25_to_29', 'Manila', 3, 5, 'Fine on cheeks, greasy on the T-zone. I use it on cloudy days only.', ['hydrated', 'oily'], '2026-09-27'],
  ['fenty-hydra-vizor', 'combination', '25_to_29', 'Bangkok', 4, 6, 'Pink tint cancels the white cast. Nice glow, a bit too dewy for the T-zone.', ['glowy'], '2026-10-11'],
  ['fenty-hydra-vizor', 'dry', '24_and_younger', 'Tokyo', 5, 9, 'Hydrating and pretty. My skin feels plump all day.', ['glowy', 'hydrated'], '2026-10-20'],
  ['fenty-hydra-vizor', 'sensitive', '30_to_34', 'Jakarta', 2, 2, 'Fragrance made my cheeks itchy. Stopped after a week.', ['itchy'], '2026-09-22'],
  ['shiseido-anessa-milk', 'combination', '25_to_29', 'Tokyo', 5, 10, 'Did not move at all during a summer festival. Shake it well, then it is light.', ['calm'], '2026-10-07'],
  ['shiseido-anessa-milk', 'oily', '24_and_younger', 'Jakarta', 4, 6, 'Stays on through sweat and commuting. Needs a proper cleanser at night.', ['oily'], '2026-10-19'],
  ['shiseido-anessa-milk', 'dry', '35_to_44', 'Osaka', 3, 4, 'Too drying for my cheeks in winter.', ['tight'], '2026-09-26'],
  ['biore-aqua-rich', 'combination', '25_to_29', 'Tokyo', 5, 20, 'Cheap, watery and no white cast. I keep one in every bag.', ['soft', 'hydrated'], '2026-10-22'],
  ['biore-aqua-rich', 'sensitive', '30_to_34', 'Singapore', 2, 2, 'Alcohol smell and a slight sting around my nose.', ['stinging'], '2026-10-01'],
  ['biore-aqua-rich', 'oily', '25_to_29', 'Bandung', 4, 8, 'Light enough for humidity, a bit dewy by lunch.', ['oily'], '2026-10-14'],
  ['dr-ci-labo-uv', 'combination', '30_to_34', 'Tokyo', 5, 8, 'Matte T-zone all day and my pores look smaller. Great under makeup.', ['soft'], '2026-10-24'],
  ['dr-ci-labo-uv', 'oily', '25_to_29', 'Jakarta', 4, 5, 'Very matte, almost too much on my cheeks in air con.', ['tight'], '2026-10-12'],
  ['neutrogena-ultra-sheer', 'combination', '25_to_29', 'Jakarta', 4, 10, 'Cheap and easy to find. Dry finish on my T-zone, a light scent I stopped noticing.', ['soft'], '2026-10-20'],
  ['neutrogena-ultra-sheer', 'oily', '24_and_younger', 'Singapore', 4, 6, 'Good under a cap at football practice. Reapply after an hour of sweat.', ['oily'], '2026-10-09'],
  ['neutrogena-ultra-sheer', 'sensitive', '30_to_34', 'Tokyo', 2, 2, 'The scent made my eyes water when I sweated.', ['stinging'], '2026-09-28'],
  ['bondi-sands-face', 'combination', '25_to_29', 'Tokyo', 5, 8, 'Matte, no scent, and it stayed on during a long run along the river.', ['soft', 'calm'], '2026-10-23'],
  ['bondi-sands-face', 'oily', '25_to_29', 'Bandung', 4, 6, 'Really matte. A bit drying on my cheeks in air con.', ['tight'], '2026-10-11'],
  ['sun-bum-face', 'combination', '25_to_29', 'Bali', 4, 6, 'Smells like a beach holiday. Clear and it does not move when I surf.', ['soft'], '2026-10-15'],
  ['sun-bum-face', 'sensitive', '30_to_34', 'Singapore', 2, 3, 'The banana scent was too much for my skin, slight redness.', ['red'], '2026-09-30'],
  ['cetaphil-sheer-mineral', 'sensitive', '25_to_29', 'Tokyo', 5, 12, 'No sting at all, even on my red cheeks. A slight white cast that fades.', ['calm'], '2026-10-17'],
  ['cetaphil-sheer-mineral', 'combination', '30_to_34', 'Jakarta', 3, 5, 'Gentle, but a bit heavy for my T-zone in this heat.', ['calm', 'oily'], '2026-10-06'],
  ['aveeno-protect-hydrate', 'dry', '30_to_34', 'Osaka', 5, 10, 'My cheeks stay comfortable all day in dry winter air.', ['hydrated'], '2026-10-19'],
  ['aveeno-protect-hydrate', 'combination', '25_to_29', 'Jakarta', 3, 4, 'Nice on cheeks, shiny on my nose by noon.', ['hydrated', 'oily'], '2026-10-13'],
  // Serums and treatments
  ['the-ordinary-niacinamide', 'combination', '25_to_29', 'Jakarta', 4, 10, 'Pores on my nose look smaller and oil is calmer. Pills if I use too much.', ['soft'], '2026-10-19'],
  ['the-ordinary-niacinamide', 'oily', '24_and_younger', 'Surabaya', 5, 14, 'Less oil by midday. Cheap and it just works for me.', ['calm'], '2026-10-01'],
  ['the-ordinary-niacinamide', 'sensitive', '30_to_34', 'Tokyo', 2, 3, 'Flushing and a warm feeling at 10%. Fine when I mix it with moisturizer.', ['red'], '2026-09-18'],
  ['paulas-choice-bha', 'combination', '25_to_29', 'Bandung', 5, 16, 'Every other night it keeps my nose clear. Daily was too much.', ['soft'], '2026-10-14'],
  ['paulas-choice-bha', 'oily', '25_to_29', 'Jakarta', 4, 8, 'Fewer clogged pores. Stings a little right after the gym, so I skip it on sport days.', ['stinging', 'soft'], '2026-10-23'],
  ['paulas-choice-bha', 'dry', '35_to_44', 'Seoul', 3, 6, 'Works, but I need a richer cream after or I get flaky.', ['flaky'], '2026-09-29'],
  ['the-ordinary-retinol', 'combination', '30_to_34', 'Jakarta', 4, 12, 'Twice a week with no BHA on the same night. Smoother texture after two months.', ['soft'], '2026-10-09'],
  ['the-ordinary-retinol', 'sensitive', '25_to_29', 'Singapore', 2, 3, 'Dry patches around my mouth by week two. Too strong for me right now.', ['flaky', 'tight'], '2026-09-25'],
  ['lrp-effaclar-duo', 'oily', '24_and_younger', 'Manila', 4, 6, 'Spots calm down faster. Can be drying on the chin.', ['tight'], '2026-10-06'],
  // Cleansers and moisturizers
  ['cerave-foaming-cleanser', 'combination', '25_to_29', 'Jakarta', 5, 24, 'Clean but not squeaky. Good after a sweaty day.', ['soft'], '2026-10-22'],
  ['cerave-foaming-cleanser', 'oily', '30_to_34', 'Bangkok', 4, 10, 'Takes off sunscreen in one go. Slightly tight in air con.', ['tight'], '2026-10-03'],
  ['cerave-hydrating-cleanser', 'dry', '30_to_34', 'Tokyo', 5, 16, 'Gentle, my skin feels comfortable after. Does not remove waterproof sunscreen.', ['hydrated'], '2026-10-13'],
  ['laneige-water-sleeping', 'combination', '25_to_29', 'Jakarta', 4, 8, 'Wake up soft. A bit sticky on the pillow in hot nights.', ['soft', 'hydrated'], '2026-10-17'],
  ['laneige-water-sleeping', 'sensitive', '35_to_44', 'Osaka', 2, 2, 'The scent was too strong for me and my cheeks went pink.', ['red'], '2026-09-20'],
  ['laneige-water-sleeping', 'dry', '25_to_29', 'Seoul', 5, 12, 'Best before a flight. Skin feels hydrated after 7 hours on a plane.', ['hydrated', 'glowy'], '2026-10-24'],
  ['lrp-cicaplast', 'sensitive', '30_to_34', 'Jakarta', 5, 10, 'My rescue cream after too much exfoliating. Calm by the morning.', ['calm'], '2026-10-10'],
  ['lrp-cicaplast', 'combination', '25_to_29', 'Tokyo', 4, 4, 'Thick, so I use it only on dry cheeks in the cold.', ['calm', 'hydrated'], '2026-10-26'],
  ['clinique-ddml', 'oily', '25_to_29', 'Singapore', 3, 6, 'Light, but I still get shiny. Fine for the office.', ['oily'], '2026-10-04'],
  ['tatcha-water-cream', 'combination', '30_to_34', 'Tokyo', 5, 10, 'Gel cream that melts in. My T-zone stays balanced.', ['soft', 'glowy'], '2026-10-15'],
  ['clean-clear-oil-free', 'oily', '24_and_younger', 'Jakarta', 4, 8, 'Light and cheap. Fewer spots on my chin after a month.', ['soft'], '2026-10-18'],
  ['clean-clear-oil-free', 'combination', '25_to_29', 'Manila', 3, 4, 'Fine for the T-zone, a little dry on my cheeks.', ['tight'], '2026-10-02'],
  ['neutrogena-hydro-boost', 'combination', '25_to_29', 'Singapore', 5, 12, 'Feels like water. Hydrated but never greasy in the humidity.', ['hydrated', 'soft'], '2026-10-21'],
  ['neutrogena-hydro-boost', 'dry', '30_to_34', 'Seoul', 3, 6, 'Not enough on its own for my dry cheeks in winter.', ['tight'], '2026-10-04'],
  ['kiehls-ultra-cream', 'oily', '25_to_29', 'Jakarta', 2, 2, 'Too rich for the humidity, I got small bumps on my forehead.', ['breakout'], '2026-09-23'],
]

export const PEER_REVIEWS: PeerReview[] = ROWS.map(([productId, skinType, ageRange, city, rating, weeks, text, feelings, at], i) => ({
  id: `sample-${i + 1}`,
  productId,
  skinType,
  ageRange,
  city,
  rating,
  weeks,
  text,
  feelings,
  at,
}))

export function reviewsFor(productId: string): PeerReview[] {
  return PEER_REVIEWS.filter((r) => r.productId === productId)
}

/** Average stars and count, for everyone or only one skin type. */
export function ratingOf(productId: string, skinType?: SkinType): { avg: number; n: number } {
  const rs = reviewsFor(productId).filter((r) => !skinType || r.skinType === skinType)
  return { avg: rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0, n: rs.length }
}
