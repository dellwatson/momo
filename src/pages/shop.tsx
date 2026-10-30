import { useState } from 'react'
import { ArrowLeft, Check, Crown, Lock, Sparkles, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Mascot } from '@/components/mascot'
import { Momo3D } from '@/components/momo-3d'
import { Button } from '@/components/ui/button'
import { streakOf } from '@/lib/memory'
import { FURS, furById } from '@/lib/momo3d/furs'
import { cn } from '@/lib/utils'
import { buyFur, useMomo, wearFur } from '@/state/momo'

// The shop: points from stories and reviews buy things for momo. Fur colors
// work now; accessories and food come with the feeding system.

const SOON = [
  { name: 'Sun hat', price: 120, kind: 'Accessory' },
  { name: 'Round glasses', price: 180, kind: 'Accessory' },
  { name: 'Ribbon', price: 90, kind: 'Accessory' },
  { name: 'Mochi snack', price: 30, kind: 'Food' },
  { name: 'Matcha treat', price: 45, kind: 'Food' },
  { name: 'Skin doctor chat', price: 500, kind: 'Feature' },
]

function Points() {
  const points = useMomo((s) => s.account?.points ?? 0)
  return (
    <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 font-medium">
      <Sparkles className="size-4 text-amber-500" /> {points} points
    </span>
  )
}

function ShopNav() {
  const item = 'flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Points />
      <Link to="/shop/leaderboard" className={item}>
        <Trophy className="size-4 text-amber-500" /> Leaderboard
      </Link>
      <Link to="/shop/mascots" className={item}>
        <Users className="size-4 text-primary" /> Other momos
      </Link>
    </div>
  )
}

export function ShopPage() {
  const a = useMomo((s) => s.account)
  const [preview, setPreview] = useState(a?.fur ?? 'sky')
  const fur = furById(preview)
  const owned = a?.furs.includes(fur.id)
  const worn = a?.fur === fur.id

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl font-medium tracking-tight">Shop</h1>
          <p className="text-muted-foreground">Share stories and reviews, earn points, dress up momo.</p>
        </div>
        <ShopNav />
      </div>

      <section className="grid gap-6 rounded-3xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
        <div className="flex flex-col items-center gap-3">
          <Momo3D size={220} fur={fur.id} mood="excited" />
          <p className="font-heading text-xl">{fur.name}</p>
          {worn ? (
            <p className="flex items-center gap-1 text-sm text-emerald-700">
              <Check className="size-4" /> momo is wearing this
            </p>
          ) : owned ? (
            <Button onClick={() => wearFur(fur.id)}>Wear {fur.name}</Button>
          ) : (
            <Button
              disabled={!a || a.points < fur.price}
              onClick={() => {
                if (buyFur(fur.id, fur.price)) toast.success(`momo is ${fur.name} now`)
              }}
            >
              <Sparkles /> Buy for {fur.price}
            </Button>
          )}
          {!owned && a && a.points < fur.price && <p className="text-xs text-muted-foreground">{fur.price - a.points} more points. A story earns 10, a review 20.</p>}
        </div>
        <div>
          <h2 className="mb-3 font-heading text-xl">Fur colors</h2>
          <ul className="grid grid-cols-3 gap-3">
            {FURS.map((f) => {
              const have = a?.furs.includes(f.id)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setPreview(f.id)}
                    className={cn('flex w-full flex-col items-center gap-1 rounded-2xl border p-2 text-xs hover:border-primary/40', preview === f.id && 'border-primary ring-2 ring-primary/20')}
                    aria-pressed={preview === f.id}
                  >
                    <Mascot fur={f} size={56} />
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground">{have ? (a?.fur === f.id ? 'Wearing' : 'Owned') : `${f.price} pts`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-heading text-xl">Coming soon</h2>
        <p className="mb-3 text-sm text-muted-foreground">Accessories, food for momo, and features. Food arrives with the daily ration: momo eats when it thinks for you.</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SOON.map((x) => (
            <li key={x.name} className="rounded-2xl border border-dashed bg-card/60 p-3 text-sm text-muted-foreground">
              <p className="text-[11px] uppercase tracking-wide">{x.kind}</p>
              <p className="font-medium text-foreground">{x.name}</p>
              <p className="mt-1 flex items-center gap-1 text-xs">
                <Lock className="size-3" /> {x.price} pts
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Back() {
  return (
    <Link to="/shop" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Shop
    </Link>
  )
}

// Sample players. Points come from sharing (stories and reviews), never from
// what a review says, so the board rewards sharing, not praise.
const BOARD = [
  { handle: 'mochi.skin', points: 1240, streak: 41, fur: 'lilac' },
  { handle: 'oilyinbandung', points: 980, streak: 33, fur: 'mint' },
  { handle: 'tokyodewy', points: 910, streak: 28, fur: 'honey' },
  { handle: 'sunscreen.daily', points: 760, streak: 19, fur: 'sky' },
  { handle: 'calmcheeks', points: 520, streak: 15, fur: 'peach' },
  { handle: 'nightowl.glow', points: 410, streak: 9, fur: 'night' },
  { handle: 'firstweek', points: 120, streak: 4, fur: 'sky' },
]

export function LeaderboardPage() {
  const a = useMomo((s) => s.account)
  const days = useMomo((s) => s.days)
  const name = useMomo((s) => s.profile.name)
  const me = a && { handle: a.handle, points: a.points, streak: streakOf(days), fur: a.fur, me: true }
  const rows = [...BOARD.map((r) => ({ ...r, me: false })), ...(me ? [me] : [])].sort((x, y) => y.points - x.points)
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Back />
      <h1 className="font-heading text-4xl font-medium tracking-tight">Leaderboard</h1>
      <p className="mb-1 text-muted-foreground">This month. Points come from sharing stories and reviews, never from what a review says.</p>
      <p className="mb-5 text-xs text-amber-800">Other players are sample data.</p>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.handle} className={cn('flex items-center gap-3 rounded-2xl border bg-card p-3', r.me && 'border-primary/50 bg-accent')}>
            <span className="w-6 text-center font-heading text-lg tabular-nums">{i === 0 ? <Crown className="mx-auto size-5 text-amber-500" /> : i + 1}</span>
            <Mascot fur={furById(r.fur)} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.me ? `${name ?? 'You'} (you)` : `@${r.handle}`}</span>
              <span className="block text-xs text-muted-foreground">{r.streak} day streak</span>
            </span>
            <span className="flex items-center gap-1 font-medium tabular-nums">
              <Sparkles className="size-4 text-amber-500" /> {r.points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function MascotsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Back />
      <h1 className="font-heading text-4xl font-medium tracking-tight">Other momos</h1>
      <p className="mb-1 text-muted-foreground">How people with public profiles dressed their momo.</p>
      <p className="mb-5 text-xs text-amber-800">Sample profiles.</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BOARD.map((r) => (
          <li key={r.handle} className="flex flex-col items-center gap-1 rounded-3xl border bg-card p-4 text-center">
            <Mascot fur={furById(r.fur)} size={88} mood={r.streak > 20 ? 'excited' : 'happy'} />
            <p className="font-medium">@{r.handle}</p>
            <p className="text-xs text-muted-foreground">
              {furById(r.fur).name} · {r.streak} day streak
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
