import { renderContext } from '../chat/contract.ts'
import { lookEvidence, scanEvidence } from '../evidence.ts'
import type { ContextPack, LookResult, Meta, ScanResult, Signs } from '../../shared/types.ts'
import { claudeVision } from './claude.ts'
import type { Image, VisionProvider } from './contract.ts'
import { localVision } from './local.ts'

// Picks the vision provider, like server/chat/index.ts. VISION_PROVIDER names
// one; if it is not set, the first provider that has a key wins.

const PROVIDERS: VisionProvider[] = [claudeVision, localVision]

export function visionProvider(): VisionProvider {
  const named = PROVIDERS.find((p) => p.name === process.env.VISION_PROVIDER)
  if (named?.available()) return named
  return PROVIDERS.find((p) => p.available()) ?? localVision
}

async function run<T extends { model?: string }>(
  call: (p: VisionProvider) => Promise<T>,
  localNote: string,
): Promise<T & { meta: Meta }> {
  const p = visionProvider()
  const t0 = performance.now()
  const ms = () => Math.round(performance.now() - t0)
  if (p !== localVision) {
    try {
      const out = await call(p)
      return { ...out, meta: { tool: p.name, status: 'live', ms: ms(), model: out.model ?? p.model } }
    } catch (err) {
      console.warn(`[vision] ${p.name} failed, using local:`, (err as Error).message)
      const out = await call(localVision)
      return { ...out, meta: { tool: 'local', status: 'sample', ms: ms(), note: `${p.name} failed` } }
    }
  }
  return { ...(await call(localVision)), meta: { tool: 'local', status: 'sample', ms: ms(), note: localNote } }
}

export async function look(photo: Image, previous: { photo: Image; date: string } | undefined, pack: ContextPack, estimate?: Signs): Promise<LookResult> {
  const context = renderContext(pack)
  const r = await run((p) => p.look({ photo, previous, context, estimate }), 'on-device estimate, no vision key')
  return { ...r, evidence: lookEvidence(r.meta.status, previous?.date) }
}

export async function scan(photos: Image[], pack: ContextPack): Promise<ScanResult> {
  const context = renderContext(pack)
  const r = await run((p) => p.scan({ photos, context, pack }), 'no vision key')
  return { ...r, evidence: scanEvidence(r.basis, r.meta.status) }
}
