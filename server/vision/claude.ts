import type Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import { anthropic, anthropicKey } from '../anthropic.ts'
import { LOOK_SYSTEM, LookSchema, SCAN_SYSTEM, ScanSchema, clamp01, type Image, type VisionProvider } from './contract.ts'

// Vision provider: Claude. Uses the same key as the chat provider.

const MODEL = process.env.VISION_MODEL || process.env.CHAT_MODEL || 'claude-opus-5-5'

const image = (i: Image): Anthropic.Beta.BetaImageBlockParam => ({
  type: 'image',
  source: { type: 'base64', media_type: i.mediaType, data: i.data },
})

const text = (t: string): Anthropic.Beta.BetaTextBlockParam => ({ type: 'text', text: t })

async function ask<S extends z.ZodType>(system: string, schema: S, content: Anthropic.Beta.BetaContentBlockParam[]): Promise<{ out: z.infer<S>; model: string }> {
  const res = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
    messages: [{ role: 'user', content }],
  })
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this photo')
  if (!res.parsed_output) throw new Error(`Claude returned no structured answer (stop: ${res.stop_reason})`)
  return { out: res.parsed_output as z.infer<S>, model: res.model }
}

export const claudeVision: VisionProvider = {
  name: 'claude',
  model: MODEL,
  available: anthropicKey,
  async look({ photo, previous, context }) {
    const content: Anthropic.Beta.BetaContentBlockParam[] = []
    if (previous) content.push(text(`Previous skin check, ${previous.date}:`), image(previous.photo))
    content.push(text('Today:'), image(photo), text(context))
    const { out, model } = await ask(LOOK_SYSTEM, LookSchema, content)
    const { redness, dryness, shine, breakouts, unevenness, ...rest } = out
    return {
      ...rest,
      change: previous ? rest.change : 'first',
      signs: { redness: clamp01(redness), dryness: clamp01(dryness), shine: clamp01(shine), breakouts: clamp01(breakouts), unevenness: clamp01(unevenness) },
      model,
    }
  },
  async scan({ photos, context }) {
    const content = [...photos.map(image), text(context)]
    const { out, model } = await ask(SCAN_SYSTEM, ScanSchema, content)
    return { ...out, ingredients: out.ingredients.slice(0, 15), model }
  },
}
