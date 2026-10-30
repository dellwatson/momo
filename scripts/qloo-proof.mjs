// Qloo proof for the demo: two users with the same skin and the same question,
// who differ only in what they like. It prints Qloo's brand list for each and
// momo's pick, so you can see taste change the answer.
//
// Run the dev server first (npm run dev), then:
//   npm run proof:qloo
//   npm run proof:qloo -- "Which moisturizer should I get for humid days?"
//
// Each run makes 2 chat calls (OpenAI) and up to 4 Qloo calls. Qloo answers are
// cached for 6 hours in the API process, so a second run shows "cached".
// Taste only decides between products that fit the skin equally well; the
// default question is one where Shiseido Anessa and Bondi Sands tie on skin.

const API = process.env.MOMO_API ?? 'http://localhost:8787'
const QUESTION = 'Which sunscreen should I take for a long outdoor day in Tokyo?'

async function ask(who, facts, message) {
  const context = {
    today: new Date().toISOString().slice(0, 10),
    profile: { name: 'Sari', skinType: 'combination', sensitivity: 'medium', city: 'Jakarta', ageRange: '25_to_29', gender: 'female', facts },
    shelf: [],
    recentDays: [],
    watching: [],
    agent: { shelf: [], days: [], reviews: [], trip: { city: 'Tokyo', when: 'December' } },
  }
  const t0 = Date.now()
  const r = await fetch(`${API}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ context, history: [], message }) })
  if (!r.ok) throw new Error(`${API}/api/chat answered ${r.status}. Is the dev server running?`)
  const j = await r.json()
  const q = j.meta.trace?.find((t) => t.tool === 'qloo_taste')
  console.log(`\n=== ${who} (${Date.now() - t0} ms)`)
  console.log('steps:', (j.meta.trace ?? []).map((t) => `${t.tool} [${t.status}, ${t.ms} ms]`).join(' | '))
  console.log('qloo: ', q ? `${q.status}, ${q.label}` : 'not called')
  console.log('top:  ', (q?.top ?? []).map((b) => `${b.name} ${b.pct}%${b.inCatalog ? '' : ' (not in momo)'}`).join(', '))
  console.log('reply:', j.reply)
}

const message = process.argv[2] ?? QUESTION
console.log('question:', message)
await ask('A: fan of BLACKPINK and Muji', ['Fan of BLACKPINK and Muji'], message)
await ask('B: fan of Real Madrid and Nike', ['Fan of Real Madrid and Nike'], message)
