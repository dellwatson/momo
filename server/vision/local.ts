import { SIGNS, type Signs } from '../../shared/types.ts'
import type { VisionProvider } from './contract.ts'

// No vision model: the skin check uses the browser's rough on-device estimate,
// and a product scan asks the user to say or type the name.

function describe(s: Signs): string {
  const top = SIGNS.filter((k) => s[k] >= 0.45).sort((a, b) => s[b] - s[a])[0]
  if (!top) return 'Your skin looks calm in this photo. I saved it, so next time I can tell you what changed.'
  const words = { redness: 'a little redness', dryness: 'some dry spots', shine: 'some shine', breakouts: 'a few spots', unevenness: 'some uneven tone' }
  return `I can see ${words[top]} today. I saved the photo so we can follow it.`
}

export const localVision: VisionProvider = {
  name: 'local',
  available: () => true,
  async look({ estimate, previous }) {
    const signs = estimate ?? { redness: 0, dryness: 0, shine: 0, breakouts: 0, unevenness: 0 }
    return { summary: describe(signs), signs, feelings: signs.redness >= 0.5 ? ['red'] : [], change: previous ? 'same' : 'first', shot: 'ok', mood: 'calm' }
  },
  async scan() {
    return { found: false, brand: '', name: '', category: 'moisturizer', actives: [], fragranceFree: null, basis: 'none', ingredients: [], effects: '' }
  },
}
