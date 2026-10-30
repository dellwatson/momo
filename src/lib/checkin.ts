import {
  AGE_LABELS,
  AGE_RANGES,
  FEELING_LABELS,
  FEELINGS,
  GOOD_FEELINGS,
  SKIN_TYPE_LABELS,
  SKIN_TYPES,
  isReaction,
  type Feeling,
  type Mood,
  type When,
} from '@shared/types.ts'
import { dayOf, makeShelfItem, sameProduct, shortName, todayKey, type MomoState } from './memory'

// momo's back-to-back questions. The next question is computed from memory,
// never from a fixed script, so momo picks up where the user left off and asks
// each thing once. Answers apply locally and cost no API call.

export type QuestionId =
  | 'name'
  | 'skin_type'
  | 'sensitivity'
  | 'city'
  | 'age'
  | 'add_product'
  | 'product_when'
  | 'day_feel'
  | 'skin_check'
  | 'day_signs'
  | 'day_used'
  | 'day_new'

export interface Chip {
  label: string
  value: string
  /** Extra words that pick this chip in a spoken answer (src/lib/voice-match.ts). */
  say?: string[]
}

export interface Question {
  id: QuestionId
  /** Unique per instance, for example "day_feel:2026-10-27". */
  key: string
  text: string
  chips: Chip[]
  multi?: boolean
  /** The text box answers this question directly. */
  freeText?: boolean
  placeholder?: string
  /** The shelf item the question is about. */
  itemId?: string
}

const SKIP: Chip = { label: 'Skip', value: '__skip' }
const NONE = '__none'
const DONE = '__done'
/** Chip values the app handles by opening the camera. */
export const CAMERA = '__camera'
export const SCAN = '__scan'

const EVENTS: Chip[] = [
  { label: 'Nothing new', value: NONE },
  { label: 'New product', value: 'new product' },
  { label: 'Lots of sun', value: 'lots of sun' },
  { label: 'Stress', value: 'stress' },
  { label: 'Bad sleep', value: 'bad sleep' },
  { label: 'Travel', value: 'travel' },
  { label: 'Period', value: 'period' },
]

function hello(name?: string): string {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Hi' : 'Good evening'
  return name ? `${part}, ${name}!` : `${part}!`
}

export function onboarded(s: MomoState): boolean {
  return !!s.flags.shelfDone
}

export function nextQuestion(s: MomoState): Question | null {
  const p = s.profile
  const name = p.name
  if (!name)
    return {
      id: 'name',
      key: 'name',
      text: "Hi, I'm momo! I keep track of your skin with you, day by day, and I watch your products so you don't have to. What should I call you?",
      chips: [],
      freeText: true,
      placeholder: 'Your name',
    }
  if (!p.skinType)
    return {
      id: 'skin_type',
      key: 'skin_type',
      text: `Nice to meet you, ${name}! By the afternoon, how does your face usually feel?`,
      chips: SKIN_TYPES.map((t) => ({ label: SKIN_TYPE_LABELS[t], value: t })),
    }
  if (!p.sensitivity)
    return {
      id: 'sensitivity',
      key: 'sensitivity',
      text: 'Do new products often sting or turn your skin red?',
      chips: [
        { label: 'Often', value: 'high' },
        { label: 'Sometimes', value: 'medium' },
        { label: 'Rarely', value: 'low' },
      ],
    }
  if (!p.city && !s.flags.city)
    return {
      id: 'city',
      key: 'city',
      text: 'Which city do you live in? Weather changes skin, and I can compare what people near you love.',
      chips: [SKIP],
      freeText: true,
      placeholder: 'City',
    }
  if (!p.ageRange && !s.flags.age)
    return {
      id: 'age',
      key: 'age',
      text: 'And your age group?',
      chips: [...AGE_RANGES.map((a) => ({ label: AGE_LABELS[a], value: a })), SKIP],
    }

  const noWhen = s.shelf.find((i) => !i.when)
  if (noWhen)
    return {
      id: 'product_when',
      key: `product_when:${noWhen.id}`,
      text: `When do you use ${shortName(noWhen)}?`,
      chips: [
        { label: 'Morning', value: 'am' },
        { label: 'Night', value: 'pm' },
        { label: 'Both', value: 'both' },
      ],
      itemId: noWhen.id,
    }
  if (!s.flags.shelfDone || s.flags.addingMore)
    return {
      id: 'add_product',
      key: `add_product:${s.shelf.length}`,
      text: s.flags.addingMore && s.flags.shelfDone
        ? "Show it to me, or say its name, and I'll check it against everything else you use."
        : s.shelf.length
        ? 'Any other product? Say its name or show it to me.'
        : 'Now show me what you use. Hold a product up to the camera, or just say its name.',
      chips: [{ label: 'Scan it', value: SCAN }, { label: s.shelf.length ? "That's all" : "I don't use any yet", value: DONE }],
      freeText: true,
      placeholder: 'Product name',
    }

  const date = todayKey()
  const d = dayOf(s, date)
  if (!d.score)
    return {
      id: 'day_feel',
      key: `day_feel:${date}`,
      text: `${hello(name)} How does your skin feel today?`,
      chips: [
        { label: 'Great', value: '3' },
        { label: 'Okay', value: '2' },
        { label: 'Not great', value: '1' },
      ],
    }
  if (!d.look && !s.flags[`look:${date}`])
    return {
      id: 'skin_check',
      key: `skin_check:${date}`,
      text: d.score === 1 ? 'Can I take a look? Face a window, and hold the phone at arm\'s length.' : 'Quick skin check? Face a window, and hold the phone at arm\'s length.',
      chips: [
        { label: 'Open camera', value: CAMERA },
        { label: 'Not today', value: SKIP.value },
      ],
    }
  if (!d.feelings)
    return {
      id: 'day_signs',
      key: `day_signs:${date}`,
      text: d.score === 3 ? 'Love that. What does it feel like?' : 'Do you notice anything on your skin?',
      chips: [{ label: 'Nothing special', value: NONE }, ...FEELINGS.map((f) => ({ label: FEELING_LABELS[f], value: f }))],
      multi: true,
    }
  if (s.shelf.length && !d.used)
    return {
      id: 'day_used',
      key: `day_used:${date}`,
      text: 'Which of these did you use today?',
      chips: [...s.shelf.map((i) => ({ label: shortName(i), value: i.id, say: [i.brand, i.category].filter(Boolean) })), { label: 'None today', value: NONE }],
      multi: true,
    }
  if (!d.events)
    return {
      id: 'day_new',
      key: `day_new:${date}`,
      text: 'Last one. Anything different lately?',
      chips: EVENTS,
      multi: true,
    }
  return null
}

export interface AnswerResult {
  state: Partial<MomoState>
  ack?: string
  mood?: Mood
}

function withDay(s: MomoState, patch: Partial<ReturnType<typeof dayOf>>): Partial<MomoState> {
  const date = todayKey()
  return { days: { ...s.days, [date]: { ...dayOf(s, date), ...patch } } }
}

/** Applies a chip answer, or free text for a question that takes free text. */
export function applyAnswer(s: MomoState, q: Question, values: string[], text = ''): AnswerResult {
  const v = values[0]
  const skip = v === SKIP.value
  switch (q.id) {
    case 'name': {
      const name = text.trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 30)
      return { state: { profile: { ...s.profile, name } }, mood: 'excited' }
    }
    case 'skin_type':
      return { state: { profile: { ...s.profile, skinType: v as never } }, ack: 'Got it.' }
    case 'sensitivity':
      return {
        state: { profile: { ...s.profile, sensitivity: v as never } },
        ack: v === 'high' ? "Noted. I'll be extra careful with anything strong or scented." : 'Good to know.',
      }
    case 'city':
      return skip
        ? { state: { flags: { ...s.flags, city: true } } }
        : { state: { profile: { ...s.profile, city: text.trim().slice(0, 40) } }, ack: `${text.trim()}, nice.` }
    case 'age':
      return skip ? { state: { flags: { ...s.flags, age: true } } } : { state: { profile: { ...s.profile, ageRange: v as never } } }
    case 'add_product': {
      if (v === DONE) {
        const first = !s.flags.shelfDone
        return {
          state: { flags: { ...s.flags, shelfDone: true, addingMore: false } },
          ack: first
            ? s.shelf.length
              ? `Thanks! I'm now watching your ${s.shelf.length} product${s.shelf.length > 1 ? 's' : ''}. You never have to remember what is inside them. That's my job.`
              : 'No problem. Tell me whenever you start something new.'
            : 'All added.',
          mood: 'happy',
        }
      }
      const { item, known } = makeShelfItem(text)
      if (s.shelf.some((i) => sameProduct(i, item))) return { state: {}, ack: `${shortName(item)} is already on your shelf.` }
      return {
        state: { shelf: [...s.shelf, item] },
        ack: known ? `${item.brand} ${item.name}. I know this one.` : `I don't know "${item.name}" yet, so I'll guess what it does from its name.`,
        mood: known ? 'happy' : 'curious',
      }
    }
    case 'product_when':
      return { state: { shelf: s.shelf.map((i) => (i.id === q.itemId ? { ...i, when: v as When } : i)) } }
    case 'day_feel': {
      const score = Number(v) as 1 | 2 | 3
      return {
        state: withDay(s, { score }),
        ack: score === 1 ? "I'm sorry. Let's figure out why." : undefined,
        mood: score === 3 ? 'excited' : score === 1 ? 'concerned' : 'calm',
      }
    }
    case 'skin_check':
      return { state: { flags: { ...s.flags, [`look:${todayKey()}`]: true } } }
    case 'day_signs': {
      // What momo saw in the skin check counts too.
      const seen = dayOf(s).look?.feelings ?? []
      const feelings = [...new Set([...values.filter((x) => x !== NONE), ...seen])] as Feeling[]
      const bad = feelings.filter(isReaction)
      return {
        state: withDay(s, { feelings }),
        ack: bad.length ? `${FEELING_LABELS[bad[0]]}. I'll keep that in mind.` : feelings.some((f) => GOOD_FEELINGS.includes(f)) ? 'Your skin is happy!' : undefined,
        mood: bad.length ? 'concerned' : 'happy',
      }
    }
    case 'day_used':
      return { state: withDay(s, { used: values.filter((x) => x !== NONE) }) }
    case 'day_new': {
      const events = values.filter((x) => x !== NONE)
      const more = events.includes('new product')
      return {
        state: { ...withDay(s, { events: events.filter((e) => e !== 'new product') }), flags: { ...s.flags, addingMore: more } },
        ack: more ? 'Ooh, something new! What is it?' : "Thanks! Today's diary is saved. Talk to me any time.",
        mood: 'happy',
      }
    }
  }
}
