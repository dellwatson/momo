// A/B test for the momo agent: same skin, same question, only the taste differs.
// It sends two chat turns to the running agent server (momo/server, port 8787)
// and prints the tools the agent used, Qloo's top brands, and the reply.
//
// Usage (the agent server must be running, see README "Agent test"):
//   node scripts/agent-ab.mjs "Which sunscreen should I take for a long outdoor day in Tokyo?"
//
// Cost: 2 chat turns. Each turn is at most 3 model steps and 6 tool calls.
// Qloo answers are cached in the server for 6 hours, so a repeat run costs fewer Qloo calls.

const API = process.env.MOMO_API ?? 'http://localhost:8787'

// Sari: combination skin, medium sensitivity, lives in Jakarta, travels to Tokyo.
// Only `facts` changes between the two users. Qloo reads the taste from it.
const USERS = [
  { who: 'A: fan of BLACKPINK and Muji', facts: ['Fan of BLACKPINK and Muji'] },
  { who: 'B: fan of Real Madrid and Nike', facts: ['Fan of Real Madrid and Nike'] },
]

function contextFor(facts) {
  return {
    today: '2026-10-30',
    profile: { name: 'Sari', skinType: 'combination', sensitivity: 'medium', city: 'Jakarta', ageRange: '25_to_29', gender: 'female', facts },
    shelf: [],
    recentDays: [],
    watching: [],
    agent: { shelf: [], days: [], reviews: [], trip: { city: 'Tokyo', when: 'December' } },
  }
}

async function ask(who, facts, message) {
  const t0 = Date.now()
  const res = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context: contextFor(facts), history: [], message }),
  })
  if (!res.ok) throw new Error(`${API}/api/chat replied ${res.status}: ${await res.text()}`)
  const j = await res.json()
  const trace = j.meta.trace ?? []
  console.log(`\n=== ${who} (${Date.now() - t0} ms, chat: ${j.meta.chat.tool} ${j.meta.chat.status})`)
  console.log('tools:', trace.map((t) => `${t.tool} [${t.status}, ${t.ms} ms] ${t.label}`).join(' | ') || 'none')
  const q = trace.find((t) => t.tool === 'qloo_taste')
  console.log('qloo top:', (q?.top ?? []).map((b) => `${b.name} ${b.pct}%${b.inCatalog ? '' : ' (not in momo)'}`).join(', ') || 'none')
  console.log('reply:', j.reply)
}

const message = process.argv[2] ?? 'Which sunscreen should I take for a long outdoor day in Tokyo?'
console.log('question:', message)
for (const u of USERS) await ask(u.who, u.facts, message)
