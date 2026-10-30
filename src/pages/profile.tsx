import { useEffect, useMemo } from 'react'
import { AtSign, BookOpen, ChevronRight, Flame, Lock, RotateCcw, Smile, Sparkles, Star } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { AGE_LABELS, SKIN_TYPE_LABELS } from '@shared/types.ts'
import { Mascot } from '@/components/mascot'
import { AgentMode } from '@/components/site-header'
import { ActivityGrid, ActivityLegend } from '@/components/activity-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { brief } from '@/lib/brief'
import { bestStreak, streakOf } from '@/lib/memory'
import { furById } from '@/lib/momo3d/furs'
import { cn } from '@/lib/utils'
import { forgetFact, loadDemo, setPublic, setSocial, useAlerts, useMomo } from '@/state/momo'

// Profile: progress (streak, the week, skin checks, diary), the user's own
// reviews, their skin details, and what others can see.

const SENS = { low: 'Rarely reacts', medium: 'Sometimes reacts', high: 'Often reacts' } as const

function Stat({ icon: Icon, value, label, tone }: { icon: typeof Flame; value: string | number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <Icon className={cn('mx-auto mb-1 size-5', tone)} />
      <p className="font-heading text-2xl leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function Row({ to, icon: Icon, title, detail }: { to: string; icon: typeof Flame; title: string; detail: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:border-primary/40">
      <Icon className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )
}

export function ProfilePage() {
  const s = useMomo((st) => st)
  const alerts = useAlerts()
  const { hash } = useLocation()
  const b = useMemo(() => brief(s, alerts), [s, alerts])
  const streak = useMemo(() => streakOf(s.days), [s.days])
  const best = useMemo(() => bestStreak(s.days), [s.days])
  const a = s.account
  const p = s.profile
  const reviews = s.reviews ?? []
  const checks = Object.values(s.days).filter((d) => d.look).length
  const logged = Object.values(s.days).filter((d) => d.score).length

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' })
  }, [hash])

  const skin: [string, string | undefined][] = [
    ['Skin type', p.skinType && `${SKIN_TYPE_LABELS[p.skinType]} (${p.skinType})`],
    ['Reactions', p.sensitivity && SENS[p.sensitivity]],
    ['Age group', p.ageRange && AGE_LABELS[p.ageRange]],
    ['Gender', p.gender],
    ['City', p.city],
    ['Next trip', a?.trip && `${a.trip.city}${a.trip.when ? `, ${a.trip.when}` : ''}`],
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <section className="flex items-center gap-4">
        <Mascot mood={s.mood} size={76} fur={furById(a?.fur)} />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-medium tracking-tight">{p.name ?? 'You'}</h1>
          <p className="text-sm text-muted-foreground">
            @{a?.handle ?? 'guest'}
            {a?.joined && ` · with momo since ${new Date(`${a.joined}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
          </p>
          {a?.demo && (
            <Badge variant="outline" className="mt-1 border-dashed border-amber-300 text-amber-800">
              Demo account · sample data
            </Badge>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Stat icon={Flame} value={streak} label="day streak" tone="text-orange-500" />
        <Stat icon={Sparkles} value={a?.points ?? 0} label="points" tone="text-amber-500" />
        <Stat icon={Star} value={reviews.length} label="reviews" tone="text-primary" />
      </section>

      <section className="rounded-3xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">
            {logged} check-ins in the last 6 months
          </p>
          <ActivityLegend />
        </div>
        <ActivityGrid days={s.days} />
        <p className="mt-3 text-xs text-muted-foreground">
          {b.goodDays} good day{b.goodDays === 1 ? '' : 's'} this week · best run {best} days
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Row to="/skin" icon={Smile} title="Skin timeline" detail={checks ? `${checks} skin check${checks > 1 ? 's' : ''}` : 'No skin checks yet'} />
        <Row to="/diary" icon={BookOpen} title="Diary" detail={`${logged} days logged · what momo remembers`} />
      </section>

      <section>
        <h2 className="mb-2 font-heading text-xl">Your skin</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-3xl border bg-card p-4 text-sm">
          {skin.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="first-letter:uppercase">{v ?? 'Not told yet'}</dd>
            </div>
          ))}
        </dl>
        {!!p.facts.length && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted-foreground">What momo remembers (tap to forget)</p>
            <div className="flex flex-wrap gap-1.5">
              {p.facts.map((f) => (
                <button key={f} type="button" onClick={() => forgetFact(f)} className="rounded-full border bg-card px-3 py-1 text-xs hover:border-rose-300 hover:line-through">
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="font-heading text-xl">Your reviews</h2>
          <Link to="/explore?tab=reviews" className="text-sm text-primary hover:underline">
            Write one
          </Link>
        </div>
        {!reviews.length ? (
          <p className="rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">No reviews yet. Each one earns 20 points, whatever it says.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  {r.productId ? (
                    <Link to={`/explore/reviews/${r.productId}`} className="font-medium hover:underline">
                      {r.brand} {r.name}
                    </Link>
                  ) : (
                    <p className="font-medium">
                      {r.brand} {r.name}
                    </p>
                  )}
                  <span className="shrink-0 text-xs text-amber-600">+{r.points}</span>
                </div>
                <p className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn('size-3.5', i <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">{r.at}</span>
                </p>
                <p className="mt-1 text-muted-foreground">{r.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {a && (
        <section>
          <h2 className="mb-2 font-heading text-xl">What others see</h2>
          <div className="space-y-3 rounded-3xl border bg-card p-4 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">Public profile</span>
                <span className="block text-xs text-muted-foreground">
                  {a.public ? 'Others see your momo, streak and links. Reviews stay anonymous.' : 'Only you see this page. Reviews are always anonymous.'}
                </span>
              </span>
              <input type="checkbox" className="size-5 accent-primary" checked={a.public} onChange={(e) => setPublic(e.target.checked)} />
            </label>
            {a.public ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <AtSign className="size-4 text-muted-foreground" />
                  <Input defaultValue={a.socials.instagram} onBlur={(e) => setSocial('instagram', e.target.value)} placeholder="Instagram handle" maxLength={40} />
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-4 text-center text-xs font-semibold text-muted-foreground">T</span>
                  <Input defaultValue={a.socials.tiktok} onBlur={(e) => setSocial('tiktok', e.target.value)} placeholder="TikTok handle" maxLength={40} />
                </label>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Links show only on a public profile.
              </p>
            )}
          </div>
        </section>
      )}

      <section id="status" className="scroll-mt-20">
        <h2 className="mb-2 font-heading text-xl">Agent status</h2>
        <div className="rounded-3xl border bg-card p-4">
          <AgentMode full />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
        <span>Prototype: no sign-in. Everything stays in this browser.</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            loadDemo()
            toast.success('Demo account loaded again')
          }}
        >
          <RotateCcw /> Reload demo data
        </Button>
      </section>
    </div>
  )
}
