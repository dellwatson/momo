// YouCam (Perfect Corp) AI Skin Analysis test for the demo.
// Docs: https://docs.perfectcorp.com/reference/ai_skin_analysis
//
// It reads the unit balance, runs one skin analysis on a selfie, reads the
// balance again, and appends one line to demo/youcam-quota.md. The quota file
// shows the units left, because in momo these units will come from the
// subscription.
//
// Put YOUCAM_API_KEY in .env (key from https://yce.makeupar.com/api-console/en/api-keys/), then:
//   npm run test:youcam -- quota                  balance only, costs 0 units
//   npm run test:youcam -- ./selfie.jpg           SD, 4 concerns, costs 9 units
//   npm run test:youcam -- ./selfie.jpg --hd      HD, 4 concerns, costs 12 units
//
// Photo rules: jpg or png under 10 MB, short side 480 px or more (1080 px for HD),
// face wider than 60% of the image, front-facing, eyes open.
// Units are charged only when the task succeeds.

import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, basename } from 'node:path'

try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  // No .env file: the key check below explains what to do.
}

const API = process.env.YOUCAM_API_URL ?? 'https://yce-api-01.makeupar.com'
const KEY = process.env.YOUCAM_API_KEY
const LOG = new URL('../demo/youcam-quota.md', import.meta.url)

// The four concerns that map to momo's signs: redness, shine, breakouts, dryness.
const SD = ['redness', 'oiliness', 'acne', 'moisture']
const HD = ['hd_redness', 'hd_oiliness', 'hd_acne', 'hd_moisture']
const COST = { sd: 9, hd: 12 }

if (!KEY) {
  console.error('YOUCAM_API_KEY is not set in .env. Get a key at https://yce.makeupar.com/api-console/en/api-keys/')
  process.exit(1)
}

async function call(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${method} ${path} answered ${r.status}: ${JSON.stringify(j)}`)
  return j
}

// Each result is a unit bucket with its own expiry; the balance is their sum.
async function balance() {
  const j = await call('GET', '/s2s/v1.0/client/credit')
  const buckets = j.results ?? []
  const total = buckets.reduce((s, b) => s + (b.amount_dec ?? b.amount ?? 0), 0)
  return { total: Math.round(total * 100) / 100, buckets }
}

function record(row) {
  if (!existsSync(LOG)) {
    writeFileSync(LOG, '# YouCam API units (demo)\n\nIn momo these units come from the subscription. Written by scripts/youcam-skin-test.mjs.\n\n| Time (UTC) | Run | Mode | Units before | Units after | Used | Result |\n|---|---|---|---|---|---|---|\n')
  }
  appendFileSync(LOG, `| ${new Date().toISOString().slice(0, 16).replace('T', ' ')} | ${row.run} | ${row.mode} | ${row.before} | ${row.after} | ${row.used} | ${row.result} |\n`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function analyze(photo, hd) {
  const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[extname(photo).toLowerCase()]
  if (!type) throw new Error('The photo must be .jpg, .jpeg or .png')
  const bytes = readFileSync(photo)

  // 1. Ask for an upload URL.
  const up = await call('POST', '/s2s/v2.0/file', {
    files: [{ content_type: type, file_name: basename(photo), file_size: statSync(photo).size }],
  })
  const file = (up.data?.files ?? up.files)[0]
  const put = file.requests[0]

  // 2. Upload the bytes with the headers exactly as returned.
  const u = await fetch(put.url, { method: put.method ?? 'PUT', headers: put.headers, body: bytes })
  if (!u.ok) throw new Error(`Upload answered ${u.status}`)

  // 3. Start the task.
  const t0 = Date.now()
  const task = await call('POST', '/s2s/v2.1/task/skin-analysis', {
    src_file_id: file.file_id,
    dst_actions: hd ? HD : SD,
    format: 'json',
  })
  const id = task.data.task_id
  console.log('task:', id)

  // 4. Poll with backoff: 2 s, then x1.5 up to 10 s, stop after 3 minutes.
  let wait = 2000
  while (Date.now() - t0 < 180_000) {
    await sleep(wait)
    const s = (await call('GET', `/s2s/v2.1/task/skin-analysis/${id}`)).data
    if (s.task_status === 'success') return { ms: Date.now() - t0, output: s.results?.output ?? [], raw: s }
    if (s.task_status === 'error') throw new Error(`Task error: ${s.error} ${s.error_message ?? ''}`)
    wait = Math.min(wait * 1.5, 10_000)
  }
  throw new Error(`Task ${id} still running after 3 minutes`)
}

const [arg, flag] = process.argv.slice(2)
const before = await balance()
console.log('units left:', before.total)
for (const b of before.buckets) console.log(`  ${b.type}: ${b.amount_dec} (expires ${new Date(b.expiry).toISOString().slice(0, 10)})`)

if (!arg || arg === 'quota') {
  record({ run: 'balance check', mode: '-', before: before.total, after: before.total, used: 0, result: 'ok' })
  process.exit(0)
}

const hd = flag === '--hd'
const mode = hd ? 'HD 4 concerns' : 'SD 4 concerns'
console.log(`running ${mode} on ${arg} (expected cost ${hd ? COST.hd : COST.sd} units)`)
try {
  const r = await analyze(arg, hd)
  const after = await balance()
  console.log(`\ndone in ${r.ms} ms`)
  for (const o of r.output) console.log(`  ${o.type}: ui_score ${o.ui_score ?? o.score}, raw ${o.raw_score ?? '-'}`)
  writeFileSync(new URL('../demo/youcam-last-result.json', import.meta.url), JSON.stringify(r.raw, null, 2))
  console.log('\nunits left:', after.total, `(used ${Math.round((before.total - after.total) * 100) / 100})`)
  record({ run: basename(arg), mode, before: before.total, after: after.total, used: Math.round((before.total - after.total) * 100) / 100, result: `ok, ${r.ms} ms` })
} catch (e) {
  const after = await balance().catch(() => before)
  record({ run: basename(arg), mode, before: before.total, after: after.total, used: Math.round((before.total - after.total) * 100) / 100, result: String(e.message).slice(0, 80).replaceAll('|', '/') })
  console.error(e.message)
  process.exit(1)
}
