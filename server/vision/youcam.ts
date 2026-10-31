import type { Measure, ShotIssue, Signs } from '../../shared/types.ts'
import type { Image } from './contract.ts'

// YouCam (Perfect Corp) AI Skin Analysis: measured scores for the skin check.
// Docs: https://docs.perfectcorp.com/reference/ai_skin_analysis
// It runs next to the vision model. YouCam gives the numbers, the vision model
// still writes what momo says. One check is 3 calls (upload URL, upload, task),
// a few status polls, and one balance read for the demo quota line.
// Units are charged only when the task succeeds: SD 1 to 4 concerns = 9 units.

const API = process.env.YOUCAM_API_URL || 'https://yce-api-01.makeupar.com'
const KEY = () => process.env.YOUCAM_API_KEY

// The four concerns that map to momo's signs. Unevenness stays with the vision model.
const ACTIONS = ['redness', 'oiliness', 'acne', 'moisture'] as const
const SIGN_OF: Record<(typeof ACTIONS)[number], keyof Signs> = { redness: 'redness', oiliness: 'shine', acne: 'breakouts', moisture: 'dryness' }
const COST = 9

// Poll budget: 1 s, then x1.5 up to 3 s, stop after 45 s.
const POLL_FIRST = 1000
const POLL_MAX = 3000
const POLL_LIMIT = 45_000

const SHOT_OF: Record<string, ShotIssue> = {
  error_src_face_too_small: 'too_far',
  error_src_face_out_of_bound: 'too_close',
  error_below_min_image_size: 'too_far',
  error_lighting_dark: 'too_dark',
  error_no_face: 'no_face',
  error_pose: 'no_face',
  error_large_face_angle: 'no_face',
  error_face_parsing: 'no_face',
  error_multiple_people: 'no_face',
}

export const youcamKey = () => !!KEY()

class YoucamError extends Error {
  readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = (await r.json().catch(() => ({}))) as T & { error?: string; error_code?: string }
  if (!r.ok) throw new YoucamError(`${method} ${path} ${r.status}: ${j.error ?? ''}`, j.error_code)
  return j
}

/** Units left, summed over every unit bucket. */
async function unitsLeft(): Promise<number> {
  const j = await call<{ results?: { amount_dec?: number; amount?: number }[] }>('GET', '/s2s/v1.0/client/credit')
  const total = (j.results ?? []).reduce((s, b) => s + (b.amount_dec ?? b.amount ?? 0), 0)
  return Math.round(total * 100) / 100
}

interface FileUpload {
  file_id: string
  requests: { method?: string; url: string; headers: Record<string, string> }[]
}

interface TaskStatus {
  task_status: 'running' | 'success' | 'error'
  error?: string
  error_message?: string
  results?: { output?: { type: string; ui_score?: number; raw_score?: number; score?: number }[] }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One YouCam skin analysis. A face or light problem comes back as `shot`, with no units used. */
export async function youcamMeasure(photo: Image): Promise<{ signs: Partial<Signs>; shot?: ShotIssue; measure: Measure }> {
  const t0 = performance.now()
  const ms = () => Math.round(performance.now() - t0)
  const bytes = Buffer.from(photo.data, 'base64')
  const ext = photo.mediaType === 'image/png' ? 'png' : 'jpg'
  if (photo.mediaType === 'image/webp') throw new YoucamError('YouCam takes jpg or png only')

  try {
    const up = await call<{ data?: { files: FileUpload[] }; files?: FileUpload[] }>('POST', '/s2s/v2.0/file', {
      files: [{ content_type: photo.mediaType, file_name: `skin-check.${ext}`, file_size: bytes.length }],
    })
    const file = (up.data?.files ?? up.files ?? [])[0]
    if (!file) throw new YoucamError('YouCam gave no upload URL')
    const put = file.requests[0]
    const u = await fetch(put.url, { method: put.method ?? 'PUT', headers: put.headers, body: bytes })
    if (!u.ok) throw new YoucamError(`upload ${u.status}`)

    const task = await call<{ data: { task_id: string } }>('POST', '/s2s/v2.1/task/skin-analysis', {
      src_file_id: file.file_id,
      dst_actions: ACTIONS,
      format: 'json',
    })
    const id = task.data.task_id

    let wait = POLL_FIRST
    let status: TaskStatus | undefined
    while (performance.now() - t0 < POLL_LIMIT) {
      await sleep(wait)
      status = (await call<{ data: TaskStatus }>('GET', `/s2s/v2.1/task/skin-analysis/${id}`)).data
      if (status.task_status !== 'running') break
      wait = Math.min(wait * 1.5, POLL_MAX)
    }
    if (!status || status.task_status === 'running') throw new YoucamError(`task ${id} still running after ${POLL_LIMIT / 1000} s`)
    if (status.task_status === 'error') {
      // Face errors can sit in error or in error_message.
      const code = Object.keys(SHOT_OF).find((k) => status!.error === k || status!.error_message?.includes(k)) ?? status.error
      throw new YoucamError(`task error: ${status.error ?? ''} ${status.error_message ?? ''}`.trim(), code)
    }

    // ui_score is 1 to 100, higher is healthier skin, so a sign is 1 - score/100.
    const output = status.results?.output ?? []
    const signs: Partial<Signs> = {}
    const scores: Measure['scores'] = []
    for (const o of output) {
      const score = o.ui_score ?? o.score
      if (typeof score !== 'number') continue
      scores.push({ type: o.type, score, raw: o.raw_score })
      const sign = SIGN_OF[o.type as (typeof ACTIONS)[number]]
      if (sign) signs[sign] = Math.max(0, Math.min(1, 1 - score / 100))
    }
    const left = await unitsLeft().catch(() => undefined)
    console.log(`[youcam] ${id} ok in ${ms()} ms, ${COST} units, ${left ?? '?'} left, scores ${scores.map((s) => `${s.type} ${s.score}`).join(', ')}`)
    return { signs, measure: { tool: 'youcam', status: 'live', ms: ms(), scores, units: { used: COST, left } } }
  } catch (err) {
    const e = err as YoucamError
    const shot = e.code ? SHOT_OF[e.code] : undefined
    console.warn(`[youcam] failed in ${ms()} ms:`, e.message)
    return { signs: {}, shot, measure: { tool: 'youcam', status: 'sample', ms: ms(), scores: [], units: { used: 0 }, note: e.code ?? e.message } }
  }
}
