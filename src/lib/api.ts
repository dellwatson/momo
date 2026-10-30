import type { ChatRequest, ChatResult, CompareRequest, CompareResult, ExploreRequest, ExploreResult, ProductInfo, HealthResult, LookRequest, LookResult, ScanRequest, ScanResult } from '@shared/types.ts'

// All calls go to the agent server (momo/server/index.ts) through the Vite proxy.

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${await res.text()}`)
  return res.json()
}

export const api = {
  health: async (): Promise<HealthResult> => (await fetch('/api/health')).json(),
  chat: (req: ChatRequest) => post<ChatResult>('/chat', req),
  compare: (req: CompareRequest) => post<CompareResult>('/compare', req),
  explore: (req: ExploreRequest) => post<ExploreResult>('/explore', req),
  product: async (id: string): Promise<ProductInfo> => {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error(`product failed (${res.status})`)
    return res.json()
  },
  look: (req: LookRequest) => post<LookResult>('/look', req),
  scan: (req: ScanRequest) => post<ScanResult>('/scan', req),
}
