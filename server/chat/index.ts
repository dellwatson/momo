import type { ChatTurn, ContextPack, Meta } from '../../shared/types.ts'
import { claude } from './claude.ts'
import { renderContext, type ChatDraft, type ChatProvider } from './contract.ts'
import { local } from './local.ts'
import { openaiChat } from './openai.ts'

// Picks the chat provider. CHAT_PROVIDER names one; if it is not set, the first
// provider that has a key wins. To add a provider, implement ChatProvider in
// this folder and list it here.

const PROVIDERS: ChatProvider[] = [openaiChat, claude, local]

export function chatProvider(): ChatProvider {
  const wanted = process.env.CHAT_PROVIDER
  const named = PROVIDERS.find((p) => p.name === wanted)
  if (named?.available()) return named
  return PROVIDERS.find((p) => p.available()) ?? local
}

export async function chat(pack: ContextPack, history: ChatTurn[], message: string): Promise<{ draft: ChatDraft; meta: Meta }> {
  const p = chatProvider()
  const input = { context: renderContext(pack), history, message, pack }
  const t0 = performance.now()
  const ms = () => Math.round(performance.now() - t0)
  if (p === local) return { draft: await local.reply(input), meta: { tool: 'local', status: 'sample', ms: ms() } }
  try {
    const draft = await p.reply(input)
    const tools = draft.trace?.length ? ` · ${draft.trace.length} tool call${draft.trace.length > 1 ? 's' : ''}` : ''
    return { draft, meta: { tool: p.name, status: 'live', ms: ms(), model: draft.model ?? p.model, note: tools ? tools.slice(3) : undefined } }
  } catch (err) {
    console.warn(`[chat] ${p.name} failed, using local reply:`, (err as Error).message)
    return { draft: await local.reply(input), meta: { tool: 'local', status: 'sample', ms: ms(), note: `${p.name} failed` } }
  }
}
