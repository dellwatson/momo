import { matchProduct } from '../../shared/match.ts'
import { FEELING_LABELS, GOOD_FEELINGS, isReaction, type Feeling, type Mood } from '../../shared/types.ts'
import type { ChatBasis, ChatDraft, ChatInput, ChatProvider } from './contract.ts'

// Chat provider: no model. Keyword rules that keep the app usable without a
// key, and the fallback when a live provider fails.

const FEELING_WORDS: [Feeling, RegExp][] = [
  ['glowy', /\b(glow|glowy|radiant|bright)\b/],
  ['soft', /\b(soft|smooth)\b/],
  ['calm', /\b(calm|fine|good|great|happy)\b/],
  ['hydrated', /\b(hydrated|plump|moist|dewy)\b/],
  ['tight', /\b(tight|tightness)\b/],
  ['oily', /\b(oily|greasy|shiny)\b/],
  ['stinging', /\b(sting|stings|stinging|burn|burns|burning|tingl\w*)\b/],
  ['red', /\b(red|redness|flushed|blotchy)\b/],
  ['itchy', /\b(itch|itchy|itching)\b/],
  ['breakout', /\b(breakout|broke out|pimple|pimples|zit|zits|acne|spots)\b/],
  ['flaky', /\b(flaky|peeling|peel|dry patches|flaking)\b/],
  ['dull', /\b(dull|tired|grey|gray)\b/],
]

const EVENT_WORDS: [string, RegExp][] = [
  ['lots of sun', /\b(sun|beach|sunburn)\b/],
  ['stress', /\b(stress|stressed|exam|deadline)\b/],
  ['bad sleep', /\b(no sleep|bad sleep|tired|slept badly|insomnia)\b/],
  ['travel', /\b(travel|flight|trip|plane)\b/],
  ['period', /\b(period|pms|cycle)\b/],
]

const OWNS = /\b(i (use|used|have|bought|got|started|tried|own|switched)|my|new)\b/

export function extractLocal(message: string): Pick<ChatDraft, 'products' | 'feelings' | 'facts' | 'events'> {
  const t = message.toLowerCase()
  const m = OWNS.test(t) ? matchProduct(message) : undefined
  const fact = message.match(/\bi (always|usually|never|often|get|am allergic|hate|love|can't|cannot)\b[^.!?]*/i)?.[0]
  return {
    products: m ? [`${m.product.brand} ${m.product.name}`] : [],
    feelings: FEELING_WORDS.filter(([, re]) => re.test(t)).map(([f]) => f),
    facts: fact ? [fact.slice(0, 80)] : [],
    events: EVENT_WORDS.filter(([, re]) => re.test(t)).map(([e]) => e),
  }
}

function replyLocal({ message, pack }: ChatInput): ChatDraft {
  const x = extractLocal(message)
  const t = message.toLowerCase()
  const name = pack.profile.name ? `, ${pack.profile.name}` : ''
  const bad = x.feelings.filter(isReaction)
  let reply: string
  let mood: Mood = 'calm'
  let basis: ChatBasis[] = []
  if (/\b(why|clash|together|safe|mix|combine|okay to use|ok to use|conflict)\b/.test(t)) {
    reply = pack.watching.length
      ? `Here is what I'm keeping an eye on: ${pack.watching[0]}`
      : "From what I know, your products get along fine. I'll tell you if anything changes."
    mood = pack.watching.length ? 'concerned' : 'happy'
    basis = ['product']
  } else if (x.products.length) {
    reply = `Noted! ${x.products[0]} is on your shelf now, and I'll check it against everything else you use.`
    mood = 'excited'
    basis = ['product']
  } else if (bad.length) {
    reply = `Sorry your skin feels ${bad.map((f) => FEELING_LABELS[f].toLowerCase()).join(' and ')}${name}. I've put it in today's diary. If it keeps up, I'll look for a pattern in what you used.`
    mood = 'concerned'
    basis = ['diary']
  } else if (x.feelings.some((f) => GOOD_FEELINGS.includes(f))) {
    reply = `Love that${name}! I'll remember what you used today, so we know what works.`
    mood = 'happy'
    basis = ['diary']
  } else {
    reply = "I'm running without a chat model right now, so I keep it simple. Tell me how your skin feels, or name a product you use, and I'll remember it."
    mood = 'curious'
  }
  return { reply, mood, ...x, basis }
}

export const local: ChatProvider = {
  name: 'local',
  available: () => true,
  reply: async (input) => replyLocal(input),
}
