import Anthropic from '@anthropic-ai/sdk'

// One Anthropic client for every Claude provider (chat and vision).
// One retry at most: the SDK backs off on 429/5xx, and the user is waiting.

let client: Anthropic | undefined

export const anthropicKey = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
export const anthropic = () => (client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 }))
