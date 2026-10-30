# momo

A skincare companion with a mascot. momo talks with the user every day by voice, looks at their skin through the camera, and reads the products they show it. It remembers everything, keeps a diary, and watches in the background for products that do not work well together or with the user's skin.

The home screen works like a banking app: momo greets the user and says what it noticed ("3 good days this week, one thing on your shelf needs a look"). It does not open on a statement. The chat is optional.

Users talk about how their skin feels, what results they see, and which brands they like. momo reads the ingredients for them and answers in those terms. Ingredient detail is only shown when the user taps "Why?" or "What is inside?".

This is a hackathon prototype. It runs on your computer for the demo (see [Run](#run)). Store lists and peer reviews are sample data, and every screen that shows them says "sample".

## Contents

- [Folders and ports](#folders-and-ports)
- [Run](#run)
- [The agent and Qloo](#the-agent-and-qloo)
- [Use the agent directly](#use-the-agent-directly)
- [Agent test (A/B)](#agent-test-ab)
- [Reviews: goal and rules](#reviews-goal-and-rules)
- [Screens](#screens)
- [How it works](#how-it-works)
- [Switching models](#switching-models)
- [Data and privacy](#data-and-privacy)
- [Cost](#cost)
- [Not tested yet](#not-tested-yet)

## Folders and ports

| Folder | Port | Role |
|---|---|---|
| `momo/src` | 5173 | React + Vite + Tailwind + shadcn/ui app. Holds all memory in the browser: localStorage for the diary, IndexedDB for skin photos. Proxies `/api` to the agent server. |
| `momo/server` | 8787 (`API_PORT`) | Hono agent server. Holds the chat, vision, Jev and Qloo keys. Stores nothing. |
| `momo/shared` | - | Types, the formula catalog, sample reviews, store lists, product matching and the watcher. Used by both. |
| `momo/scripts` | - | `qloo-proof.mjs` (`npm run proof:qloo`) and `agent-ab.mjs` (`npm run test:agent`), the agent A/B test. |

## Run

```bash
npm install
cp .env.example .env   # add keys, or leave them empty for mock mode
npm run dev            # starts the app (5173) and the agent server (8787)
```

Open http://localhost:5173. The header shows a dot per provider on wide screens: green is live, amber is mock. Voice answers need Chrome or Safari. The camera needs `localhost` or HTTPS.

The keys stay in `momo/.env`, which git ignores. `momo/.env.example` lists every setting. A missing key puts that provider in mock mode, so the app always starts.

To see which providers are live:

```bash
curl -s http://localhost:8787/api/health
```

```json
{"chat":{"provider":"openai","status":"live","model":"gpt-6-luna"},"vision":{"provider":"local","status":"sample"},"jev":"sample","qloo":"live"}
```

## The agent and Qloo

A product question in the chat starts a short agent loop in `momo/server/chat/openai.ts`. The model calls momo's tools in `momo/server/agent/tools.ts`, then answers in at most 3 short spoken sentences. The rules for the model are in `momo/server/agent/prompt.ts`.

| Tool | Reads | Gives the model |
|---|---|---|
| `my_history` | The user's shelf, diary days and own reviews, sent with the turn | How the skin felt on the days each product was used, what the user told momo (sport, travel, likes) |
| `find_products` | `momo/shared/catalog.ts`, `momo/shared/availability.ts`, `momo/shared/reviews.ts`, `momo/shared/watch.ts` | Products sold in the user's city or trip city, made-for-your-skin flag, same-skin stars, watcher notes with a plan |
| `qloo_taste` | Qloo `/search` and `/v2/insights` | Skincare brands loved by people with the user's taste and age group, and, separately, the brands loved in a city |
| `peer_reviews` | `momo/shared/reviews.ts` | Quotes and stars from people with the same skin type |
| `check_shelf` | `momo/shared/watch.ts` | Watcher notes for one product on this shelf |
| `read_link` | YouTube oEmbed only | Title and channel of a shared video, and the catalog product it names |

For a product question the model calls `my_history`, `find_products` and `qloo_taste` together in its first step. Limits per turn: 3 model steps, 4 tool calls per step, 6 tool calls in total. The same call twice in one turn returns the first answer.

### How momo decides

The order of the checks is fixed. Taste comes last.

1. **Can the user buy it there?** A product not sold in the user's city, or the trip city, is not a pick.
2. **Is it made for their skin?** From the catalog and the user's own diary.
3. **What did people with the same skin type say?** Same-skin stars from momo reviews.
4. **Taste breaks ties.** When two products are equal on 1 to 3 (same-skin stars within half a star), momo picks the brand that ranks higher in Qloo's `loved_brands` for this user's taste. momo then says that people who share their taste love it.

Qloo tells momo what people like. It never tells momo whether a product works. Skin type and region always come from the user and momo's reviews, never from Qloo. Qloo's safe-use rules forbid guessing health facts from taste.

### Where Qloo is used

1. **Picks that fit the person.** Taste chooses the brand. momo's reviews and the watcher decide whether it suits the user's skin and is safe.
2. **The user's own words.** Qloo's aesthetic tags ("Minimalist", "Clinical", "Botanical") let momo describe products the way this user likes to hear them.
3. **Reviews from people like you.** momo reviews from people with the same skin type, the same region and a similar taste (taste groups from Qloo). Neither Qloo nor reviews can do this alone.
4. **Travel.** The destination tells momo what is popular there. momo's reviews from that climate tell it what works there.
5. **Gifts.** "A gift for my sister who loves Taylor Swift" gives brand picks plus their reviews.

Explore (`/explore`, `momo/server/explore.ts`) uses Qloo for discovery: brands loved by the user's age group, in their city, and in their next trip city. The product page uses Qloo for one brand score (`momo/server/compare.ts`).

### Two Qloo calls, not one

`qloo_taste` asks Qloo twice: once for taste with no city, once for the city with no taste. Both answers are cached in the server for 6 hours.

The reason is a test result. With `city = Jakarta` in the same call, Qloo returns only 5 global skincare brands, and taste only reorders them. Two very different tastes then get nearly the same list. Without a city, taste changes the picks clearly.

### Known limits of Qloo for skincare

- With a city, Qloo returns only a few global skincare brands. So momo uses taste without a city for picks, and the city only for discovery.
- Local brands such as Wardah exist in Qloo but do not appear under the skincare tag. momo's own reviews must fill that gap.
- Qloo search can return the wrong thing ("The Ordinary" gives a music label). `searchEntity()` in `momo/server/qloo.ts` checks each result before it accepts one.

## Use the agent directly

The agent server takes plain JSON. You do not need the app to try it. The app builds the `context` from the user's memory (`buildContext()` in `momo/src/lib/memory.ts`); for a direct call you write it yourself.

### Ask a product question

```bash
curl -s http://localhost:8787/api/chat \
  -H 'content-type: application/json' \
  -d '{
    "message": "Which sunscreen should I take for a long outdoor day in Tokyo?",
    "history": [],
    "context": {
      "today": "2026-10-30",
      "profile": {
        "name": "Sari", "skinType": "combination", "sensitivity": "medium",
        "city": "Jakarta", "ageRange": "25_to_29", "gender": "female",
        "facts": ["Fan of BLACKPINK and Muji"]
      },
      "shelf": [], "recentDays": [], "watching": [],
      "agent": { "shelf": [], "days": [], "reviews": [], "trip": { "city": "Tokyo", "when": "December" } }
    }
  }'
```

What to put in `context`:

| Field | What it does |
|---|---|
| `profile.skinType`, `profile.sensitivity` | Decide which products are made for the user, and whose reviews count as "same skin". |
| `profile.city`, `agent.trip.city` | Decide where the product must be sold. |
| `profile.ageRange`, `profile.gender` | The Qloo audience. Age values: `24_and_younger`, `25_to_29`, `30_to_34`, `35_to_44`, `45_to_54`, `55_and_older`. Gender: `female` or `male`. |
| `profile.facts` | What the user told momo. The model takes public interests from here (a band, a brand, a team) and passes them to `qloo_taste`. |
| `agent.shelf`, `agent.days`, `agent.reviews` | The user's own history, read by `my_history`. Empty is fine. |

The reply (shortened):

```json
{
  "reply": "Take Shiseido Anessa. It stayed put through a summer festival for someone with your skin, and people who share your taste love Shiseido.",
  "evidence": [
    { "kind": "product", "status": "sample", "count": 8, "detail": "catalog, stores in Japan" },
    { "kind": "reviews", "status": "sample", "count": 31, "detail": "combination skin first" },
    { "kind": "qloo", "status": "live", "count": 10, "detail": "fans of BLACKPINK, Muji" }
  ],
  "meta": {
    "trace": [
      { "tool": "my_history", "status": "live", "ms": 1, "label": "your shelf and diary" },
      { "tool": "find_products", "status": "sample", "ms": 3, "label": "sunscreens in Japan" },
      { "tool": "qloo_taste", "status": "live", "ms": 1840, "label": "Qloo taste of BLACKPINK + Muji fans in Tokyo",
        "top": [{ "name": "Glossier", "pct": 85, "inCatalog": true }, { "name": "Shiseido", "pct": 85, "inCatalog": true }] }
    ]
  }
}
```

- `reply` is what momo says out loud.
- `evidence` is the source tags the app shows in the sources popover. `status` is `live`, `cached` or `sample`.
- `meta.trace` is every tool the agent used, with its time. `top` on `qloo_taste` is Qloo's ranked brands for this taste.

The numbers above are an example. Your run gives other times and percentages.

### Other endpoints

```bash
# Brands loved by women 25 to 29, and by the same audience in Tokyo (Qloo discovery)
curl -s http://localhost:8787/api/explore -H 'content-type: application/json' \
  -d '{"audience":{"ageRange":"25_to_29","gender":"female"},"places":["Tokyo"]}'

# Qloo affinity of your own brands for an audience
curl -s http://localhost:8787/api/compare -H 'content-type: application/json' \
  -d '{"brands":["CeraVe","Shiseido"],"audience":{"ageRange":"25_to_29","gender":"female"}}'

# One product with its reviews (usernames masked by the server)
curl -s http://localhost:8787/api/products/shiseido-anessa-milk
```

## Agent test (A/B)

This test proves that Qloo changes the agent's answer. It asks the same question for two test users. Both have the same skin (Sari: combination, medium sensitivity, Jakarta, trip to Tokyo). They differ only in taste.

There are two ways to show it in the demo.

### Option 1: in the app (one person at a time)

1. Open http://localhost:5173 with the demo account.
2. Ask in the chat: "Which sunscreen should I take for a long outdoor day in Tokyo?" momo answers for Sari's current interests.
3. On Profile (`/profile`), remove the BLACKPINK and Muji fact.
4. Tell momo: "I love Real Madrid and Nike."
5. Ask the same question again. The sources popover shows the new Qloo list.

This path is not tested yet. Try it once before the demo.

### Option 2: the script (side by side, for backup)

The script sends the same question for both tastes and prints the answers one after the other. Start the agent server first (`npm run dev` or `npm run dev:api`). Then, from the `momo` folder:

```bash
npm run proof:qloo
```

With no question added, it asks the outdoor-day question. To ask something else:

```bash
npm run proof:qloo -- "Which moisturizer should I get for humid days?"
```

`npm run test:agent` (`momo/scripts/agent-ab.mjs`) runs the same test and also prints the chat provider and the label of each tool step. `npm run proof:qloo` is `momo/scripts/qloo-proof.mjs`. To point either one at another server, set `MOMO_API` (default `http://localhost:8787`). One run costs 2 chat turns.

The script is also proof that the answers are not scripted. During the demo you can change the question, or the interests in the script, and run it again live. A repeat run within 6 hours shows Qloo as `cached`, because the agent server keeps Qloo answers for 6 hours. The first run after that shows `live`.

Output of `npm run test:agent`, for each user:

```
=== A: fan of BLACKPINK and Muji (7412 ms, chat: openai live)
tools: my_history [live, 1 ms] ... | find_products [sample, 3 ms] ... | qloo_taste [live, 1840 ms] ...
qloo top: Glossier 85%, Shiseido 85%, Aveeno 83%, ...
reply: ...
```

### Result

| Question | BLACKPINK + Muji fan | Real Madrid + Nike fan |
|---|---|---|
| Qloo top brands | Glossier, Shiseido, Aveeno, Cetaphil | Clean & Clear, Neutrogena, Sun Bum, Bondi Sands |
| "Which sunscreen should I take for a long outdoor day in Tokyo?" | Shiseido Anessa (6 of 6 runs) | Bondi Sands (4 of 6 runs), Shiseido Anessa (2 of 6) |
| "Which moisturizer should I get for humid days?" | Neutrogena Hydro Boost | Hydro Boost in one run, Clean & Clear in the other |
| "Which sunscreen should I buy in Tokyo?" | Shiseido Anessa | Bioré |

Use the outdoor-day question for the demo. There, Anessa and Bondi Sands fit Sari's skin equally well, so taste decides. For the other questions, skin fit usually wins. That is the design: Qloo shows taste, not whether a product works.

The outdoor-day question does not give the taste pick every time. In 2 of 6 runs the second user also got Anessa, because both products are equal on skin fit and the model sometimes stays with the stronger festival review. In those runs momo did not say "people who share your taste love it", so it made no false taste claim. For the demo, run the test once before you present, or show the `qloo top` line, which changes every time.

The moisturizer question once picked Clean & Clear for the second user, a 3-star product, over a 5-star one. One run is not enough to tell if this happens often, so do not use that question in the demo.

A product reply takes about 5 to 10 s (measured 4.6 to 8.9 s on 2026-10-30).

## Reviews: goal and rules

### Goal

Trust is the product. Reviews on Instagram or X can be paid for or pushed by brands. momo reviews come from people who own the product and use it, and they are anonymous. momo needs these reviews and stories to tell, later, what works for which skin, in which climate, after how many weeks.

### The rules, and how strict they are

momo is strict on honesty and on safety. It is not strict on the user.

| Rule | Where | What it stops |
|---|---|---|
| Points are flat: 20 per review, 10 per story. They never depend on the stars or the words. | `POINTS` in `momo/src/lib/memory.ts`, `addReview()` in `momo/src/state/momo.ts` | Paying for praise. A 1-star review earns the same as a 5-star review. |
| Only a product on the user's shelf can be reviewed, and only once. | `momo/src/pages/product.tsx` | Reviews of products the user does not have, and repeat reviews for points. |
| A review needs stars and text, at most 400 characters. | `momo/src/pages/product.tsx` | Empty reviews for points. |
| Reviews are anonymous. Others see skin type, age group and city, plus a masked name and an avatar ("sun*********ly"). The server masks the name, so the full name never reaches the browser. | `maskName()` in `momo/server/reviews.ts` | Finding the reviewer. Brands and friends cannot press a person. |
| Each review records how many weeks it was used. | `weeks` in `momo/shared/reviews.ts` | A first-day opinion counting the same as two months of use (the agent sees the weeks). |
| Same-skin reviews come first. | `find_products` and `peer_reviews` in `momo/server/agent/tools.ts` | A dry-skin rave deciding a pick for oily skin. |
| Sample data says "sample". The agent must not claim live stock or real people. | `momo/server/agent/prompt.ts`, every screen | Fake proof. |
| Every claim has a source tag (diary, product, skin check, reviews, Qloo). A source momo does not have is not shown. | `momo/server/evidence.ts` | A claim with no fact behind it. |
| Qloo never counts as proof that a product works. It only breaks ties. | `momo/server/agent/prompt.ts` | Popular brands winning over products that fit the skin. |

### What momo is not strict about

- **A shelf conflict is a warning with a plan, never a ban.** Products that clash can still work on alternate nights, without the third product, or not on sport days. momo says "not for you now" only when a product goes against the user's skin type and their recent reactions, and then it says when and how to start.
- **No negative words about skin.** momo names a sign and where it is, in neutral words, and asks what changed. When it is not sure, it asks for a better photo.
- **Mood and points never depend on how the skin looks.** They depend only on care and sharing.

### Visitors and logged-in users (planned)

The prototype has one demo account and no login yet. This is the plan:

| | Visitor (no login) | Logged-in user |
|---|---|---|
| Review count, top feel words ("light", "no sting") | Yes | Yes |
| Share who would use it again | Yes | Yes |
| Quotes | 2 short ones | All |
| Filter by skin type, region, age band | Locked | Yes |
| "People like you" (taste plus skin) | Locked | Yes |
| Results over weeks, backed by diaries | Locked | Yes, compared with your own diary |

Also planned, not built: review analysis by AI as a batch job (not on each request), and checks against one person writing reviews from many accounts.

## Screens

| Screen | What it does |
|---|---|
| Home (`/`) | Greeting and what momo noticed: this week's good days, the last skin check, what it is watching, what is working. Three actions: talk, skin check, scan a product. Shows at most 3 lines of momo's reply, plus "Read all in chat". |
| Talk (sheet) | The voice check-in. momo says each question out loud and listens for the answer, hands-free, until the user goes quiet. Tap answers and a text box stay on screen. |
| Skin check (sheet) | Selfie with a face guide and a 3-second count. Shows today next to the last check, what momo sees, and what changed. |
| Scan (sheet) | The front of a product, and the back label if the user likes. momo names it, says what it does, and says whether it works with the rest of the shelf. |
| Skin (`/skin`) | Every skin check, newest first, with the change from the one before. |
| Shelf (`/shelf`) | Products the user owns, when they use them, how each one felt, and the watcher's notes. |
| Diary (`/diary`) | One entry per day. "What momo knows about you". Download or reset all data. |
| Explore (`/explore`) | Qloo discovery: products from brands loved by people like the user, in their city and their trip city. The brands tab compares the user's own brands (the old `/compare`). |
| Product (`/explore/reviews/:id`) | Same-skin reviews, Qloo score for the brand, watcher notes for this shelf, and the user's own review. |
| Profile (`/profile`) | Skin profile, trip, socials, public or private. |
| Shop (`/shop`) | Spend points on momo's fur colors. Leaderboard and mascots. |
| Chat (`/chat`) | Optional. The same check-in and memory, typed. Product questions run the agent. |

## How it works

| Part | Where | What it does |
|---|---|---|
| Check-in | `momo/src/lib/checkin.ts` | Computes the next question from memory, so each thing is asked once. A new day asks: how the skin feels, a skin check, what it feels like, what was used, anything new. |
| Voice | `momo/src/lib/speech.ts`, `momo/src/state/voice.ts`, `momo/src/lib/voice-match.ts` | The browser's own speech engines, so voice costs no API call. Spoken answers are matched to the check-in chips on the device ("not so good" picks "Not great"). Anything else goes to the chat model. |
| Vision | `POST /api/look`, `POST /api/scan`, `momo/server/vision/` | One vision call per skin check (today's photo and the last one) and one per product scan (front, and back label if given). |
| Memory | `momo/src/lib/memory.ts`, `momo/src/state/momo.ts`, `momo/src/lib/photos.ts` | Profile, compiled facts, shelf, diary, skin checks, chat, reviews, points. `buildContext()` turns it into one `ContextPack` that every model receives. |
| Watcher | `momo/shared/watch.ts` | Rules on formulas, skin profile and diary. A scanned product is checked on a copy of the shelf before the user adds it. |
| Home greeting | `momo/src/lib/brief.ts` | Computed on the device from memory. No API call. |
| Chat | `POST /api/chat`, `momo/server/chat/` | Writes momo's reply (short, because it is spoken) and extracts products, feelings, facts and life events. |
| Agent | `momo/server/agent/` | Tools and rules for product questions. See [The agent and Qloo](#the-agent-and-qloo). |
| Sense | `momo/server/sense.ts` | Jev scores every feeling in a chat message, at the same time as the chat call. |
| Qloo | `momo/server/qloo.ts`, `momo/server/explore.ts`, `momo/server/compare.ts` | Qloo client, discovery lists, and brand scores. |
| Reviews | `momo/shared/reviews.ts`, `momo/server/reviews.ts` | Sample peer reviews, and the masked names the app shows. |

## Switching models

Chat and vision each have one contract that every provider follows: `momo/server/chat/contract.ts` and `momo/server/vision/contract.ts`. To add a provider, implement the interface in that folder, add it to `PROVIDERS` in its `index.ts`, and set `CHAT_PROVIDER` or `VISION_PROVIDER`.

- `openai`: the only chat provider that runs the agent tools today. Set `OPENAI_MODEL` to an exact model ID. `OPENAI_EFFORT` defaults to `low`.
- `claude`: `claude-opus-5-5` at low effort, with structured output and server-side refusal fallback (`fallbacks: "default"`). One retry at most, 30 s timeout. No agent tools yet.
- `local`: chat uses keyword rules. Vision uses a rough on-device estimate for skin (redness, shine and uneven tone only, from skin-colored pixels) and asks for the product name on a scan.

If a live chat provider fails, the turn falls back to `local` and the reply is marked `sample`.

Speech runs in the browser. To move to a server speech model, keep `speak()` and `listen()` in `momo/src/lib/speech.ts` and change what is inside them.

## Data and privacy

Everything is in the user's browser: the diary under the localStorage key `momo.memory.v1`, and skin photos in the IndexedDB database `momo`. A skin check photo is sent once to the vision model to be read, and is not stored on the server. Photos are at most 768 px. The Diary download includes the diary but not the photos.

`qloo_taste` sends Qloo only public interests (a brand, a band, a show), the age group and the gender. It never sends names, health facts or skin data.

## Cost

There is no database, no background job, no polling and no retry loop.

- Voice and tap answers: no API call, unless the answer does not match a chip.
- One typed or unmatched spoken message: one chat call and one Jev call, in parallel.
- One product question: at most 3 model steps and 6 tool calls. `qloo_taste` makes at most 2 Qloo insights calls, plus one search per new interest. Both are cached for 6 hours.
- One skin check: one vision call with two images at most.
- One product scan: one vision call with two images at most.
- Opening Explore: one Qloo insights call per list (at most 3), cached for 6 hours.
- Opening a product: one Qloo call for that brand.

## Not tested yet

- Live Claude chat and vision, and live Jev. The agent was tested live with the `openai` chat provider and live Qloo only.
- Voice and the live camera on a real phone. The browser pane used for testing blocks the microphone and camera, so the flows were tested with uploaded photos and with spoken answers fed in as text.
- The on-device skin estimate is rough and moves with lighting. It is labeled as an estimate.
- The catalog in `momo/shared/catalog.ts`, the store lists in `momo/shared/availability.ts` and the reviews in `momo/shared/reviews.ts` are sample data.
- The A/B result comes from 6 runs for the outdoor-day question and 1 or 2 runs for the others. It shows the effect; it does not measure how often it happens.
