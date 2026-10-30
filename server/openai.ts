import OpenAI from 'openai'

// One OpenAI client for every OpenAI provider.
// One retry at most: the SDK backs off on 429/5xx, and the user is waiting.

let client: OpenAI | undefined

export const openaiKey = () => !!process.env.OPENAI_API_KEY
export const openai = () => (client ??= new OpenAI({ timeout: 30_000, maxRetries: 1 }))
