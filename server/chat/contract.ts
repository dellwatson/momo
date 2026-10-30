import { z } from 'zod'
import { AGE_LABELS, FEELINGS, MOODS, SKIN_TYPE_LABELS, type ChatTurn, type ContextPack, type Evidence, type EvidenceKind, type TraceStep } from '../../shared/types.ts'

// The one contract every chat provider follows: the same system prompt, the
// same memory block and the same output shape. Swapping the model changes the
// voice a little, never what momo knows or what the app receives back.

export const SYSTEM = `You are momo, a small, warm mascot inside a skincare diary app. You talk with one person, most days, and you remember them.

What the person cares about: how their skin feels, how products feel to use, the brands they like, and the results they see. They do not want to hear about ingredients. Talk in those terms. Mention an ingredient only if they ask why.

Your job:
- Keep the conversation on their skin, their routine and how they feel. If they drift to another topic, answer in one line and bring it back gently.
- Use the memory block. Refer to their products by name and to what they told you on earlier days. Never ask for something the memory already has.
- The "watching" list comes from momo's checker, which reads every formula. Mention an item only when it is relevant. Do not invent new product conflicts.
- Your replies are usually spoken out loud. Reply in 1 to 3 short, friendly sentences, then at most one question. No lists, no markdown, no emoji. The app asks its own check-in questions, so do not repeat them.
- Skin checks in the diary come from momo's camera. Use them to talk about visible changes, never as a diagnosis.
- You are not a doctor. For pain, swelling, a spreading rash, eye problems, or anything that lasts more than a week, suggest a dermatologist.

Also fill the extraction fields from the person's latest message only:
- products: names of skincare products they say they own, use, or started. Not products they only ask about.
- feelings: how their skin feels right now, from the allowed list.
- facts: new lasting facts about them that are not already in memory, for example "Gets red after hot showers". Each under 80 characters.
- events: life context for today, for example "lots of sun", "stress", "travel", "period", "bad sleep".
Use empty lists when nothing applies.

basis: which parts of the memory block your reply stands on. diary: their recent days or things they told you. product: their shelf or momo's checker. skin_scan: skin checks in the diary. Use an empty list for small talk. The app shows these to the person as the source of what you said, so list only what you really used.
Say that a product works, or caused a change, only when the diary shows it. How popular a brand is never shows that it works.`

/** The evidence kinds a chat reply can stand on: the parts of the memory block the model sees. */
export const CHAT_BASIS = ['diary', 'product', 'skin_scan'] as const satisfies readonly EvidenceKind[]
export type ChatBasis = (typeof CHAT_BASIS)[number]

export const ReplySchema = z.object({
  reply: z.string(),
  mood: z.enum(MOODS),
  products: z.array(z.string()),
  feelings: z.array(z.enum(FEELINGS)),
  facts: z.array(z.string()),
  events: z.array(z.string()),
  basis: z.array(z.enum(CHAT_BASIS)),
})

/** evidence and trace: what the agent's tools found, when the provider has tools. */
export type ChatDraft = z.infer<typeof ReplySchema> & { model?: string; evidence?: Evidence[]; trace?: TraceStep[] }

export interface ChatInput {
  context: string
  history: ChatTurn[]
  message: string
  pack: ContextPack
}

export interface ChatProvider {
  name: string
  model?: string
  available(): boolean
  reply(input: ChatInput): Promise<ChatDraft>
}

const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (none yet)')

/** Renders the memory block. It goes in the last user turn, so the system prompt stays cacheable. */
export function renderContext(p: ContextPack): string {
  const pr = p.profile
  const person = [
    pr.name && `name ${pr.name}`,
    pr.skinType && `skin: ${SKIN_TYPE_LABELS[pr.skinType].toLowerCase()} (${pr.skinType})`,
    pr.sensitivity && `reacts to new products: ${pr.sensitivity}`,
    pr.city && `lives in ${pr.city}`,
    pr.ageRange && `age ${AGE_LABELS[pr.ageRange]}`,
  ]
    .filter(Boolean)
    .join('; ')
  return `<memory>
Today: ${p.today}
Person: ${person || 'unknown'}
Things they told you:
${list(pr.facts)}
Their shelf:
${list(p.shelf.map((s) => `${s.brand ? `${s.brand} ` : ''}${s.name} (${s.category}${s.when ? `, ${s.when}` : ''}): ${s.effects}`))}
Recent diary:
${list(p.recentDays)}
momo's checker is watching:
${list(p.watching)}
</memory>`
}
