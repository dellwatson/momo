import type { Question } from './checkin'

// Turns a spoken answer into check-in chip values, on the device, so a voice
// check-in costs no API call. Longer phrases are matched first, so "not great"
// wins over "great" and "not bad" wins over "bad".

const SAY: Record<string, string[]> = {
  '3': ['great', 'good', 'amazing', 'awesome', 'perfect', 'really nice', 'happy'],
  '2': ['okay', 'ok', 'fine', 'alright', 'all right', 'so so', 'normal', 'not bad', 'average'],
  '1': ['not great', 'not good', 'bad', 'terrible', 'awful', 'irritated', 'worse', 'not so good'],
  high: ['often', 'a lot', 'always', 'very sensitive', 'yes'],
  medium: ['sometimes', 'occasionally', 'a little', 'kind of'],
  low: ['rarely', 'never', 'not really', 'no'],
  am: ['morning', 'am', 'day'],
  pm: ['night', 'evening', 'pm', 'bedtime', 'before bed'],
  both: ['both', 'twice', 'morning and night', 'day and night', 'every time'],
  __skip: ['skip', 'pass', 'rather not', 'not today', 'later', 'no thanks'],
  __done: ['thats all', 'that is all', 'thats it', 'done', 'no more', 'nothing else', 'i dont use any', 'none'],
  __none: ['nothing', 'none', 'nothing special', 'nothing new', 'no', 'nope'],
  __camera: ['yes', 'sure', 'ok', 'okay', 'go', 'open camera', 'lets do it', 'take a look'],
  __scan: ['scan', 'camera', 'show you', 'take a picture'],
  glowy: ['glowy', 'glowing', 'radiant'],
  soft: ['soft', 'smooth'],
  calm: ['calm', 'comfortable'],
  hydrated: ['hydrated', 'plump', 'moist', 'dewy'],
  tight: ['tight'],
  oily: ['oily', 'greasy', 'shiny'],
  stinging: ['stinging', 'sting', 'stings', 'burning', 'burns'],
  red: ['red', 'redness', 'flushed'],
  itchy: ['itchy', 'itch', 'itching'],
  breakout: ['breakout', 'breakouts', 'pimple', 'pimples', 'spots', 'acne', 'zit', 'zits'],
  flaky: ['flaky', 'flaking', 'peeling', 'dry patches'],
  dull: ['dull', 'tired'],
  'new product': ['new product', 'started something', 'something new', 'new'],
  'lots of sun': ['sun', 'sunny', 'beach', 'sunburn'],
  stress: ['stress', 'stressed', 'busy', 'anxious'],
  'bad sleep': ['bad sleep', 'no sleep', 'didnt sleep', 'poor sleep', 'up late'],
  travel: ['travel', 'trip', 'flight', 'flew', 'traveling', 'travelling'],
  period: ['period', 'cycle'],
}

export const normalize = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `

/** Chip values heard in the transcript, or null when nothing matched. */
export function matchChips(q: Question, transcript: string): string[] | null {
  let text = normalize(transcript)
  const phrases: { value: string; phrase: string }[] = []
  for (const c of q.chips) {
    const words = [...(SAY[c.value] ?? []), ...(c.say ?? []), c.label]
    for (const w of words) {
      const phrase = normalize(w).trim()
      if (phrase) phrases.push({ value: c.value, phrase })
    }
  }
  phrases.sort((a, b) => b.phrase.length - a.phrase.length)
  const hits: { value: string; at: number }[] = []
  for (const { value, phrase } of phrases) {
    const at = text.indexOf(` ${phrase} `)
    if (at < 0) continue
    // Consume the phrase, so "not great" is not also read as "great".
    text = text.slice(0, at) + ' '.repeat(phrase.length + 1) + text.slice(at + phrase.length + 1)
    if (!hits.some((h) => h.value === value)) hits.push({ value, at })
  }
  if (!hits.length) return null
  hits.sort((a, b) => a.at - b.at)
  const values = hits.map((h) => h.value)
  // "Nothing" only counts when it is the whole answer.
  const real = values.filter((v) => v !== '__none')
  if (!q.multi) return [values[0]]
  return real.length ? real : values
}

const LEAD = /^(well |um |uh |so |hmm |)(my name is|my names|im called|i am called|call me|i am|im|its|it is|i live in|i live|im in|i use|im using|i am using|i have|i got|i just got|i started|the)\s+/

/** Removes spoken lead-ins like "my name is" from a free-text answer. */
export function cleanSpoken(transcript: string): string {
  let t = normalize(transcript).trim()
  for (let i = 0; i < 3; i++) t = t.replace(LEAD, '')
  return t.replace(/\b\w/g, (c) => c.toUpperCase())
}
