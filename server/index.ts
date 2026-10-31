import './env.ts'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { ChatRequest, ChatResult, CompareRequest, ExploreRequest, HealthResult, LookRequest, ScanRequest } from '../shared/types.ts'
import { chat, chatProvider } from './chat/index.ts'
import { compare } from './compare.ts'
import { chatEvidence } from './evidence.ts'
import { explore } from './explore.ts'
import { productInfo } from './reviews.ts'
import { jevKey } from './jev.ts'
import { qlooKey } from './qloo.ts'
import { sense } from './sense.ts'
import { parseImage } from './vision/contract.ts'
import { look, scan, visionProvider } from './vision/index.ts'
import { youcamKey } from './vision/youcam.ts'

const PORT = Number(process.env.API_PORT ?? 8787)
const MAX_MESSAGE = 500
const MAX_HISTORY = 12
// The agent's history (shelf, 45 days, reviews) rides along with each chat turn.
const MAX_BODY = 128_000
// Two photos at 768 px plus the memory block.
const MAX_PHOTO_BODY = 3_200_000

const app = new Hono().basePath('/api')

app.get('/health', (c) => {
  const p = chatProvider()
  const v = visionProvider()
  return c.json<HealthResult>({
    chat: { provider: p.name, status: p.name === 'local' ? 'sample' : 'live', model: p.model },
    vision: { provider: v.name, status: v.name === 'local' ? 'sample' : 'live', model: v.model },
    jev: jevKey() ? 'live' : 'sample',
    qloo: qlooKey() ? 'live' : 'sample',
  })
})

// One user message: the chat model and Jev run at the same time, so a turn is
// one round trip to each provider at most.
app.post('/chat', async (c) => {
  const raw = await c.req.text()
  if (raw.length > MAX_BODY) return c.json({ error: 'request too large' }, 413)
  const req = JSON.parse(raw) as ChatRequest
  const message = req.message?.trim().slice(0, MAX_MESSAGE)
  if (!message || !req.context) return c.json({ error: 'message and context are required' }, 400)
  const history = (req.history ?? []).slice(-MAX_HISTORY).map((t) => ({ role: t.role, text: String(t.text).slice(0, MAX_MESSAGE) }))

  const [{ draft, meta }, felt] = await Promise.all([chat(req.context, history, message), sense(message)])
  return c.json<ChatResult>({
    reply: draft.reply,
    mood: draft.mood,
    extract: {
      products: draft.products,
      feelings: felt.feelings ?? draft.feelings,
      facts: draft.facts,
      events: draft.events,
    },
    // The memory block first, then what the tools found.
    evidence: [...chatEvidence(draft.basis, req.context).filter((e) => !draft.evidence?.some((d) => d.kind === e.kind)), ...(draft.evidence ?? [])],
    meta: { chat: meta, sense: felt.meta, trace: draft.trace },
  })
})

// One skin check: one vision call with today's photo and the previous one.
app.post('/look', async (c) => {
  const raw = await c.req.text()
  if (raw.length > MAX_PHOTO_BODY) return c.json({ error: 'photos too large' }, 413)
  const req = JSON.parse(raw) as LookRequest
  const photo = parseImage(req.photo)
  if (!photo || !req.context) return c.json({ error: 'a JPEG, PNG or WebP photo and context are required' }, 400)
  const prev = req.previous && parseImage(req.previous.photo)
  return c.json(await look(photo, prev ? { photo: prev, date: String(req.previous!.date) } : undefined, req.context, req.estimate))
})

// One product scan: one vision call with the front, and the back label if given.
app.post('/scan', async (c) => {
  const raw = await c.req.text()
  if (raw.length > MAX_PHOTO_BODY) return c.json({ error: 'photos too large' }, 413)
  const req = JSON.parse(raw) as ScanRequest
  const photos = (req.photos ?? []).slice(0, 2).map((p) => parseImage(p))
  if (!photos.length || photos.some((p) => !p) || !req.context) return c.json({ error: 'one or two photos and context are required' }, 400)
  return c.json(await scan(photos as NonNullable<(typeof photos)[number]>[], req.context))
})

app.post('/compare', async (c) => {
  const req = await c.req.json<CompareRequest>()
  if (!Array.isArray(req.brands) || !req.brands.length) return c.json({ error: 'brands are required' }, 400)
  return c.json(await compare({ brands: req.brands.map(String), audience: req.audience ?? {} }))
})

app.get('/products/:id', (c) => {
  const info = productInfo(c.req.param('id'))
  return info ? c.json(info) : c.json({ error: 'unknown product' }, 404)
})

app.post('/explore', async (c) => {
  const req = await c.req.json<ExploreRequest>()
  const places = Array.isArray(req.places) ? req.places.map((p) => String(p).slice(0, 60)) : []
  return c.json(await explore({ audience: req.audience ?? {}, places }))
})

serve({ fetch: app.fetch, port: PORT }, () => {
  const p = chatProvider()
  console.log(
    `momo agent server on http://localhost:${PORT}  (chat: ${p.name}${p.model ? ` ${p.model}` : ''}, vision: ${visionProvider().name}, jev: ${jevKey() ? 'live' : 'sample'}, qloo: ${qlooKey() ? 'live' : 'sample'}, youcam: ${youcamKey() ? 'live' : 'off'})`,
  )
})
