import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ExternalLink, Heart, Star, Users } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PRODUCT_BY_ID } from '@shared/catalog.ts'
import { marketOf, storeLink, storesFor, type Market } from '@shared/availability.ts'
import { ratingOf } from '@shared/reviews.ts'
import { AGE_LABELS, FEELING_LABELS, type ProductInfo } from '@shared/types.ts'
import { AlertCard } from '@/components/alert-card'
import { InfoTip } from '@/components/info-tip'
import { Mascot } from '@/components/mascot'
import { ProductSwatch } from '@/components/product-swatch'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { POINTS, sameProduct } from '@/lib/memory'
import { furById } from '@/lib/momo3d/furs'
import { cn } from '@/lib/utils'
import { asItem } from '@/pages/explore'
import { addProduct, addReview, trialAlerts, useMomo } from '@/state/momo'

// One product: what people with the same skin said, Qloo taste for the brand,
// what momo's watcher would note for this shelf, and the user's own review.

function Stars({ value, size = 'size-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
      ))}
    </span>
  )
}

function Stat({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border bg-card px-3 py-2">
      <p className="flex items-center gap-1 font-heading text-lg leading-tight">{children}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function WriteReview({ productId, brand, name }: { productId: string; brand: string; name: string }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  return (
    <form
      className="space-y-2 rounded-3xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!rating || !text.trim()) return
        addReview({ productId, brand, name, rating: rating as 1, text: text.trim().slice(0, 400) })
        toast.success(`Thank you. +${POINTS.review} points`)
      }}
    >
      <div className="flex items-center gap-2">
        <p className="font-medium">Your review</p>
        <InfoTip label="About reviews">
          <p>Anonymous: others see your skin type, age group and city, never your name.</p>
          <p className="text-muted-foreground">Every review earns {POINTS.review} points, whatever it says.</p>
        </InfoTip>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
            <Star className={cn('size-7', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
          </button>
        ))}
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="How did it feel? When do you use it?" />
      <Button type="submit" disabled={!rating || !text.trim()}>
        Share anonymously
      </Button>
    </form>
  )
}

export function ProductPage() {
  const { productId = '' } = useParams()
  const p = PRODUCT_BY_ID.get(productId)
  const profile = useMomo((s) => s.profile)
  const shelf = useMomo((s) => s.shelf)
  const mine = useMomo((s) => s.reviews?.find((r) => r.productId === productId))
  const [same, setSame] = useState(!!profile.skinType)
  const [loved, setLoved] = useState<{ value: number | null; label: string }>()
  const trip = useMomo((s) => s.account?.trip)
  const [info, setInfo] = useState<ProductInfo>()

  // Reviews come from the server, which masks the usernames.
  useEffect(() => {
    let live = true
    setInfo(undefined)
    api.product(productId).then((r) => live && setInfo(r), () => undefined)
    return () => {
      live = false
    }
  }, [productId])

  // One Qloo call for this brand, for the user's audience.
  useEffect(() => {
    if (!p) return
    let live = true
    api.compare({ brands: [p.brand], audience: { ageRange: profile.ageRange, gender: profile.gender } }).then(
      (r) => live && setLoved({ value: r.brands[0]?.affinity ?? null, label: r.audienceLabel }),
      () => live && setLoved({ value: null, label: '' }),
    )
    return () => {
      live = false
    }
  }, [p, profile.ageRange, profile.gender])

  if (!p) return <Navigate to="/explore?tab=reviews" replace />
  const item = asItem(p)
  const owned = shelf.some((i) => sameProduct(i, item))
  const notes = owned ? [] : trialAlerts(item).filter((a) => a.level !== 'tip')
  const forMe = ratingOf(p.id, profile.skinType)
  const all = ratingOf(p.id)
  const reviews = (info?.reviews ?? []).filter((r) => !same || r.skinType === profile.skinType).sort((a, b) => b.at.localeCompare(a.at))
  const markets = [...new Set([marketOf(profile.city), marketOf(trip?.city)].filter((m): m is Market => !!m))]

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link to="/explore?tab=reviews" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Explore
      </Link>

      <section className="flex gap-4">
        <ProductSwatch item={item} size="sm" className="size-28 shrink-0 rounded-3xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{p.brand}</p>
          <h1 className="font-heading text-2xl font-medium leading-tight">{p.name}</h1>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            {p.category[0].toUpperCase() + p.category.slice(1)} · {p.size} · ${p.price}
            <InfoTip label="What is inside">
              <p>{p.description}</p>
              <p className="text-muted-foreground">
                {p.keyIngredients.join(', ')}. {p.fragranceFree ? 'No added fragrance.' : 'Contains fragrance.'}
              </p>
              <p className="text-xs text-muted-foreground">Sample catalog: price and size are placeholders.</p>
            </InfoTip>
          </p>
          <div className="mt-2">
            {owned ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                <Check className="size-4" /> On your shelf
              </span>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  addProduct(`${p.brand} ${p.name}`)
                  toast.success(`Added ${p.name} to your shelf`)
                }}
              >
                I use this
              </Button>
            )}
          </div>
          {info && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" /> On the shelf of {info.owners.toLocaleString()} momo users
              {info.status === 'sample' && <span className="text-amber-700">· sample</span>}
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Stat label={profile.skinType ? `${forMe.n} from ${profile.skinType} skin` : 'your skin type'}>
          <Star className="size-4 fill-amber-400 text-amber-400" />
          {forMe.n ? forMe.avg.toFixed(1) : '–'}
        </Stat>
        <Stat label={`${all.n} reviews in all`}>
          <Star className="size-4 fill-amber-400 text-amber-400" />
          {all.n ? all.avg.toFixed(1) : '–'}
        </Stat>
        <Stat label={loved?.label ? `${p.brand}, loved by ${loved.label}` : 'Qloo taste'}>
          <Heart className="size-4 fill-rose-400 text-rose-400" />
          {loved === undefined ? '…' : loved.value === null ? '–' : `${Math.round(loved.value * 100)}%`}
        </Stat>
      </section>

      {!!notes.length && (
        <section className="space-y-2">
          {notes.map((a) => (
            <AlertCard key={a.id} alert={a} compact preview />
          ))}
        </section>
      )}

      {owned && !mine && <WriteReview productId={p.id} brand={p.brand} name={p.name} />}
      {mine && (
        <section className="rounded-3xl border border-primary/30 bg-accent/40 p-4 text-sm">
          <p className="flex items-center justify-between font-medium">
            Your review <Stars value={mine.rating} />
          </p>
          <p className="mt-1 text-muted-foreground">{mine.text}</p>
        </section>
      )}

      {!!markets.length && (
        <section>
          <h2 className="mb-2 flex items-center gap-1 font-heading text-xl">
            Where to buy
            <InfoTip label="About stores">
              <p>Sample store lists, not live stock. A link opens the store's own search.</p>
            </InfoTip>
          </h2>
          <div className="space-y-2">
            {markets.map((m) => {
              const stores = storesFor(p.brand, m)
              return (
                <div key={m} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="mr-1 w-24 shrink-0 text-xs text-muted-foreground">
                    {m}
                    {trip && marketOf(trip.city) === m && marketOf(profile.city) !== m ? ' (trip)' : ''}
                  </span>
                  {!stores.length && <span className="text-xs text-muted-foreground">Not sold there</span>}
                  {stores.map((st) => {
                    const href = storeLink(st, `${p.brand} ${p.name}`)
                    return href ? (
                      <a key={st} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs hover:border-primary/40">
                        {st} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span key={st} className="rounded-full border px-2.5 py-0.5 text-xs">
                        {st}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-heading text-xl">Reviews</h2>
          <span className="rounded-full border border-dashed border-amber-300 px-2 py-0.5 text-[11px] text-amber-800">sample</span>
          {profile.skinType && (
            <button type="button" onClick={() => setSame((v) => !v)} className={cn('ml-auto rounded-full border px-3 py-1 text-xs', same ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40')}>
              {profile.skinType} skin
            </button>
          )}
        </div>
        {info && !reviews.length && <p className="text-sm text-muted-foreground">No reviews from {same ? `${profile.skinType} skin` : 'anyone'} yet.</p>}
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Mascot fur={furById(r.fur)} size={32} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{r.user}</p>
                  <Stars value={r.rating} size="size-3" />
                </div>
                <span className="text-[11px] text-muted-foreground">{r.at}</span>
              </div>
              <p className="mt-1.5 leading-snug">{r.text}</p>
              <p className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                {[`${r.skinType} skin`, AGE_LABELS[r.ageRange], r.city, `${r.weeks} weeks`, ...r.feelings.map((f) => FEELING_LABELS[f].toLowerCase())].map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
