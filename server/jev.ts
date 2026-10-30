// Client for TypeSafe's Jev model (POST /v1/systemone).
// Docs: https://docs.typesafe.ai/introduction/quickstart
//
// Jev returns numbers, not prose. One call carries many questions; each is
// evaluated in isolation against the same `state`.

const JEV_URL = process.env.JEV_API_URL ?? 'https://api.typesafe.ai/v1/systemone'
const JEV_MODEL = process.env.JEV_MODEL ?? 'jev-1.13.0'
const TIMEOUT_MS = 20_000

export function jevKey(): string | undefined {
  return process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY || undefined
}

export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'noul'; instructions: string }

export type JevAnswer =
  | { type: 'choice'; choice: string; confidence: number; probabilities?: Record<string, number> }
  | {
      type: 'score'
      score: number | string
      confidence: number
      legend?: unknown
      probabilities?: Record<string, number> | number[]
    }
  | { type: 'noul'; noul: number }

export interface JevResult {
  model: string
  answers: Record<string, JevAnswer>
}

export async function askJev(state: string, questions: Record<string, JevQuestion>): Promise<JevResult> {
  const key = jevKey()
  if (!key) throw new Error('No Jev key. Set TYPESAFE_API_KEY in .env.')

  const res = await fetch(JEV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Jev ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as Partial<JevResult>
  if (!json.answers) throw new Error('Jev response has no answers')
  return { model: json.model ?? JEV_MODEL, answers: json.answers }
}

/** Reads a score answer as one of `levels`, whatever shape the score comes back in. */
export function scoreLevel<T extends string>(answer: JevAnswer | undefined, levels: readonly T[]): T | undefined {
  if (!answer || answer.type !== 'score') return undefined
  const { score, probabilities } = answer
  if (typeof score === 'string' && levels.includes(score as T)) return score as T
  if (probabilities && !Array.isArray(probabilities)) {
    const best = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (best && levels.includes(best as T)) return best as T
  }
  if (typeof score === 'number') {
    // A number is either an index into the levels or a 0..1 position along them.
    const i = Number.isInteger(score) && score < levels.length ? score : Math.round(score * (levels.length - 1))
    return levels[Math.max(0, Math.min(levels.length - 1, i))]
  }
  return undefined
}

export function noul(answer: JevAnswer | undefined): number | undefined {
  return answer?.type === 'noul' ? answer.noul : undefined
}
