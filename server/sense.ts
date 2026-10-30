import { FEELING_LABELS, FEELINGS, type Feeling, type Meta } from '../shared/types.ts'
import { askJev, jevKey, noul, type JevQuestion } from './jev.ts'

// Jev as the checker: one call reads the user's message and scores every
// feeling on its own. Its answer replaces the chat model's guess, so the diary
// gets the same labels whichever chat model is in use.

const THRESHOLD = 0.6

export async function sense(message: string): Promise<{ feelings?: Feeling[]; meta: Meta }> {
  const t0 = performance.now()
  const ms = () => Math.round(performance.now() - t0)
  if (!jevKey()) return { meta: { tool: 'jev.sense', status: 'sample', ms: 0, note: 'no key; chat extraction used' } }

  const questions: Record<string, JevQuestion> = Object.fromEntries(
    FEELINGS.map((f) => [
      f,
      { type: 'noul', instructions: `Does the person say their skin feels ${FEELING_LABELS[f].toLowerCase()} right now (or a close synonym)?` },
    ]),
  )
  try {
    const r = await askJev(`Message from a skincare diary user: "${message}"`, questions)
    const feelings = FEELINGS.filter((f) => (noul(r.answers[f]) ?? 0) >= THRESHOLD)
    return { feelings, meta: { tool: 'jev.sense', status: 'live', ms: ms(), model: r.model } }
  } catch (err) {
    return { meta: { tool: 'jev.sense', status: 'sample', ms: ms(), note: (err as Error).message.slice(0, 120) } }
  }
}
