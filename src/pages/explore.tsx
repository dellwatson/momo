import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Heart, MapPin, Plane, Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { CATALOG, PRODUCT_BY_ID } from '@shared/catalog.ts'
import { PEER_REVIEWS, ratingOf } from '@shared/reviews.ts'
import { type Category, type ExploreResult, type Product, type ShelfItem } from '@shared/types.ts'
import { InfoTip } from '@/components/info-tip'
import { ProductSwatch } from '@/components/product-swatch'
import { AgentMode } from '@/components/site-header'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { sameProduct } from '@/lib/memory'
import { cn } from '@/lib/utils'
import { CompareSection } from '@/pages/compare'
import { trialAlerts, useMomo } from '@/state/momo'

// Explore leads with products. Qloo says what people like the user love; each
// card adds what momo checked: stars from the same skin type, on the shelf or
// not, and any watcher note. The words behind it sit in (i) popovers.

const TABS = [
  { key: 'culture', label: 'For you' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'brands', label: 'Your brands' },
] as const
type Tab = (typeof TABS)[number]['key']

export const asItem = (p: Product): ShelfItem => ({ id: `__${p.id}`, productId: p.id, brand: p.brand, name: p.name, category: p.category, actives: p.actives, fragranceFree: p.fragranceFree, when: p.time, addedAt: '' })

/** A product as a card. Tap: its reviews page. */
export function ProductCard({ p, loved, className }: { p: Product; loved?: number; className?: string }) {
  const skinType = useMomo((s) => s.profile.skinType)
  const shelf = useMomo((s) => s.shelf)
  const item = asItem(p)
  const owned = shelf.some((i) => sameProduct(i, item))
  const mine = ratingOf(p.id, skinType)
  const all = ratingOf(p.id)
  const r = mine.n ? mine : all
  const noted = !owned && trialAlerts(item).some((a) => a.level !== 'tip')
  return (
    <Link to={`/explore/reviews/${p.id}`} className={cn('group relative flex w-40 shrink-0 flex-col rounded-3xl border bg-card p-2.5 hover:border-primary/40', className)}>
      <ProductSwatch item={item} size="sm" className="aspect-square w-full rounded-2xl" />
      {owned && (
        <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white" title="On your shelf">
          <Check className="size-3.5" />
        </span>
      )}
      {noted && (
        <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-amber-400 text-amber-950" title="momo has a note for your shelf">
          <AlertTriangle className="size-3.5" />
        </span>
      )}
      <p className="mt-2 truncate text-[11px] text-muted-foreground">{p.brand}</p>
      <p className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
      <div className="mt-auto flex items-center gap-2 pt-1.5 text-xs text-muted-foreground">
        {loved !== undefined && (
          <span className="flex items-center gap-0.5" title="Loved by people like you (Qloo)">
            <Heart className="size-3 fill-rose-400 text-rose-400" /> {Math.round(loved * 100)}%
          </span>
        )}
        {r.n ? (
          <span className="flex items-center gap-0.5" title={mine.n ? `${mine.n} reviews from ${skinType} skin` : `${all.n} reviews`}>
            <Star className="size-3 fill-amber-400 text-amber-400" /> {r.avg.toFixed(1)}
            <span className="opacity-70">({r.n})</span>
          </span>
        ) : null}
        <span className="ml-auto">${p.price}</span>
      </div>
    </Link>
  )
}

const byBrand = (() => {
  const m = new Map<string, Product[]>()
  for (const p of CATALOG) m.set(p.brand.toLowerCase(), [...(m.get(p.brand.toLowerCase()) ?? []), p])
  return m
})()

function CultureTab() {
  const profile = useMomo((s) => s.profile)
  const trip = useMomo((s) => s.account?.trip)
  const [res, setRes] = useState<ExploreResult>()
  const [error, setError] = useState<string>()
  const places = [profile.city, trip?.city].filter((c): c is string => !!c)
  const key = `${profile.ageRange}|${profile.gender}|${places.join('|')}`

  // One Qloo request per visit, or when the audience changes. The server keeps answers for 6 hours.
  useEffect(() => {
    let live = true
    setRes(undefined)
    setError(undefined)
    api.explore({ audience: { ageRange: profile.ageRange, gender: profile.gender }, places }).then(
      (r) => live && setRes(r),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
    // key covers the audience and the places.
  }, [key])

  const icon = (k: string) => (k.startsWith('aud') ? Heart : trip && k.includes(trip.city.toLowerCase()) ? Plane : MapPin)

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Could not reach the agent server: {error}</p>
  if (!res)
    return (
      <div className="space-y-8">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-60 w-40 shrink-0 rounded-3xl" />
            ))}
          </div>
        ))}
      </div>
    )
  if (!res.lists.length) return <p className="text-sm text-muted-foreground">Tell momo your age group, and Qloo can rank brands for people like you.</p>

  return (
    <div className="space-y-8">
      {res.lists.map((l) => {
        const Icon = icon(l.key)
        const cards = l.brands.flatMap((b) => (byBrand.get(b.name.toLowerCase()) ?? []).map((p) => ({ p, loved: b.affinity })))
        const others = l.brands.filter((b) => !byBrand.has(b.name.toLowerCase()))
        return (
          <section key={l.key}>
            <div className="mb-3 flex items-center gap-2">
              <Icon className="size-4 text-primary" />
              <h2 className="font-heading text-xl">{l.label}</h2>
              <span className={cn('rounded-full border px-2 py-0.5 text-[11px]', l.status === 'sample' ? 'border-dashed border-amber-300 text-amber-800' : 'text-muted-foreground')}>Qloo · {l.status}</span>
              <InfoTip label={`About ${l.label}`}>
                <p>Qloo ranks skincare brands by what this audience loves. momo shows the products it has for each brand, in that order.</p>
                <p className="text-muted-foreground">Taste is not proof that a product works. Stars come from people with your skin type.</p>
                {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
              </InfoTip>
            </div>
            {cards.length ? (
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                {cards.map(({ p, loved }) => (
                  <ProductCard key={p.id} p={p} loved={loved} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">None of these brands is in momo's catalog yet.</p>
            )}
            {!!others.length && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                Also loved:
                {others.map((b) => (
                  <span key={b.name} className="rounded-full border px-2 py-0.5">
                    {b.name} {Math.round(b.affinity * 100)}%
                  </span>
                ))}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

const CATS: (Category | 'all')[] = ['all', 'sunscreen', 'serum', 'treatment', 'cleanser', 'moisturizer', 'mask']

function ReviewsTab() {
  const profile = useMomo((s) => s.profile)
  const [same, setSame] = useState(!!profile.skinType)
  const [cat, setCat] = useState<Category | 'all'>('all')

  const products = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of PEER_REVIEWS) if (!same || r.skinType === profile.skinType) n.set(r.productId, (n.get(r.productId) ?? 0) + 1)
    return [...n.entries()]
      .map(([id, count]) => ({ p: PRODUCT_BY_ID.get(id)!, count }))
      .filter((x) => x.p && (cat === 'all' || x.p.category === cat))
      .sort((a, b) => b.count - a.count)
  }, [same, cat, profile.skinType])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {profile.skinType && (
          <button type="button" onClick={() => setSame((v) => !v)} className={cn('rounded-full border px-3 py-1 text-xs', same ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40')}>
            {profile.skinType} skin
          </button>
        )}
        {CATS.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={cn('rounded-full border px-3 py-1 text-xs capitalize', cat === c ? 'border-foreground/60 bg-accent' : 'text-muted-foreground hover:text-foreground')}>
            {c}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1 rounded-full border border-dashed border-amber-300 px-2 py-0.5 text-[11px] text-amber-800">
          sample
          <InfoTip label="About these reviews" className="size-4">
            <p>Sample reviews, written for this prototype. They are not from real users.</p>
            <p className="text-muted-foreground">Real reviews are anonymous: skin type, age group and city, never a name. Each one earns the same points, whatever it says.</p>
          </InfoTip>
        </span>
      </div>
      {!products.length && <p className="text-sm text-muted-foreground">No reviews match yet.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {products.map(({ p }) => (
          <ProductCard key={p.id} p={p} className="w-auto" />
        ))}
      </div>
    </div>
  )
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'culture') as Tab
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="font-heading text-4xl font-medium tracking-tight">Explore</h1>
        <InfoTip label="How Explore works" className="mt-1">
          <p>Qloo knows what people love across music, places, fashion and brands. It ranks skincare brands for your age group, your city and your next trip.</p>
          <p>momo checks each product against your skin type, your shelf and diary, and reviews from people with the same skin.</p>
          <div className="border-t pt-2">
            <AgentMode full />
          </div>
        </InfoTip>
      </div>
      <div className="mb-6 flex gap-1 rounded-full border bg-card p-1 text-sm" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParams(t.key === 'culture' ? {} : { tab: t.key }, { replace: true })}
            className={cn('flex-1 rounded-full px-3 py-1.5', tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'culture' && <CultureTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'brands' && <CompareSection />}
    </div>
  )
}
