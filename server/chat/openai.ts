import type { ResponseInputItem } from 'openai/resources/responses/responses'
import { zodResponsesFunction, zodTextFormat } from 'openai/helpers/zod'
import type { ReasoningEffort } from 'openai/resources/shared'
import type { Evidence } from '../../shared/types.ts'
import { AGENT_RULES } from '../agent/prompt.ts'
import { runTool, TOOLS, type ToolContext } from '../agent/tools.ts'
import { openai, openaiKey } from '../openai.ts'
import { ReplySchema, SYSTEM, type ChatProvider } from './contract.ts'

// Chat provider: OpenAI, as an agent. Set CHAT_PROVIDER=openai, OPENAI_API_KEY and OPENAI_MODEL.
// OPENAI_MODEL has no default: the model must be named, so a typo does not
// silently pick a different one.
//
// One turn is a short loop: the model may call momo's tools (server/agent/tools.ts)
// for up to MAX_TOOL_STEPS steps, then must answer. Every step is one OpenAI
// call, so the ceiling bounds both the cost and the wait.

const model = () => process.env.OPENAI_MODEL || undefined
/** Replies are spoken, so a short think is the default. */
const effort = () => (process.env.OPENAI_EFFORT || 'low') as ReasoningEffort

const MAX_TOOL_STEPS = 3
const MAX_CALLS_PER_STEP = 4
const MAX_CALLS = 6

const tools = TOOLS.map((t) => zodResponsesFunction({ name: t.name, description: t.description, parameters: t.parameters }))
const instructions = `${SYSTEM}\n${AGENT_RULES}`

export const openaiChat: ChatProvider = {
  name: 'openai',
  get model() {
    return model()
  },
  available: () => openaiKey() && !!model(),
  async reply({ context, history, message, pack }) {
    const input: ResponseInputItem[] = []
    for (const t of history) {
      if (!input.length && t.role === 'momo') continue // the first turn must be the user's
      input.push({ role: t.role === 'momo' ? 'assistant' : 'user', content: t.text })
    }
    input.push({ role: 'user', content: `${context}\n\n${message}` })

    const ctx: ToolContext = { pack, trace: [], evidence: [], memo: new Map() }
    let calls = 0
    for (let step = 0; ; step++) {
      const last = step >= MAX_TOOL_STEPS || calls >= MAX_CALLS
      const res = await openai().responses.parse({
        model: model()!,
        // The system prompt and the tool list stay first and unchanged, so OpenAI's prompt cache can reuse them.
        instructions,
        input,
        tools,
        tool_choice: last ? 'none' : 'auto',
        parallel_tool_calls: true,
        reasoning: { effort: effort() },
        text: { format: zodTextFormat(ReplySchema, 'momo_reply') },
        store: false,
        // Without storage, reasoning must travel with the turn so the next step can continue it.
        include: ['reasoning.encrypted_content'],
      })
      const wanted = res.output.filter((o) => o.type === 'function_call')
      if (!wanted.length || last) {
        if (!res.output_parsed) throw new Error(`OpenAI returned no structured reply (status: ${res.status})`)
        return { ...res.output_parsed, model: res.model, evidence: merge(ctx.evidence), trace: ctx.trace }
      }

      const run = wanted.slice(0, Math.min(MAX_CALLS_PER_STEP, MAX_CALLS - calls))
      calls += run.length
      // Send back what the model produced (reasoning and calls), without the SDK's parsed extras.
      for (const o of res.output) {
        if (o.type === 'reasoning') input.push({ type: 'reasoning', id: o.id, summary: o.summary, encrypted_content: o.encrypted_content })
        else if (o.type === 'function_call') input.push({ type: 'function_call', call_id: o.call_id, name: o.name, arguments: o.arguments })
      }
      const outputs = await Promise.all(run.map((c) => runTool(c.name, c.arguments, ctx)))
      for (const c of wanted) {
        const i = run.indexOf(c)
        input.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(i >= 0 ? outputs[i] : { error: 'skipped: tool call limit for this turn' }) })
      }
    }
  },
}

/** One chip per source: counts add up, the weakest status wins. */
function merge(ev: Evidence[]): Evidence[] {
  const out = new Map<string, Evidence>()
  for (const e of ev) {
    const k = `${e.kind}|${e.detail ?? ''}`
    const prev = out.get(k)
    out.set(k, prev ? { ...prev, count: (prev.count ?? 0) + (e.count ?? 0) || undefined } : e)
  }
  return [...out.values()]
}

