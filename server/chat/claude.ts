import type Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { anthropic, anthropicKey } from '../anthropic.ts'
import { ReplySchema, SYSTEM, type ChatProvider } from './contract.ts'

// Chat provider: Claude. Set CHAT_PROVIDER=claude and ANTHROPIC_API_KEY.

const MODEL = process.env.CHAT_MODEL || 'claude-opus-5-5'

export const claude: ChatProvider = {
  name: 'claude',
  model: MODEL,
  available: anthropicKey,
  async reply({ context, history, message }) {
    const messages: Anthropic.Beta.BetaMessageParam[] = []
    for (const t of history) {
      if (!messages.length && t.role === 'momo') continue // the first turn must be the user's
      messages.push({ role: t.role === 'momo' ? 'assistant' : 'user', content: t.text })
    }
    messages.push({ role: 'user', content: `${context}\n\n${message}` })

    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // On a safety decline the API re-runs the request on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low', format: betaZodOutputFormat(ReplySchema) },
      messages,
    })
    if (res.stop_reason === 'refusal') throw new Error('Claude declined this message')
    if (!res.parsed_output) throw new Error(`Claude returned no structured reply (stop: ${res.stop_reason})`)
    return { ...res.parsed_output, model: res.model }
  },
}
