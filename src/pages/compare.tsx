import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CATALOG, PRODUCT_BY_ID } from '@shared/catalog.ts'
import type { CompareResult, Product, Profile, ShelfItem } from '@shared/types.ts'
import { effectsOf, watch } from '@shared/watch.ts'
import { Meter } from '@/components/meter'
import { ProductSwatch } from '@/components/product-swatch'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { itemStats } from '@/lib/memory'
import { addProduct, useAlerts, useMomo } from '@/state/momo'
import { Button } from '@/components/ui/button'
import { EvidenceChips } from '@/components/evidence'
import { InfoTip } from '@/components/info-tip'
import { toast } from 'sonner'

// Qloo says what people like the user love. momo adds how well it fits their
// skin, and the diary adds how it actually felt for them.

const STRONG = ['retinoid', 'aha', 'bha', 'benzoyl_peroxide']

function fitScore(p: Product | undefined, item: Pick<ShelfItem, 'actives' | 'fragranceFree'>, profile: Profile, alertCount: number): number {
  const reactive = profile.sensitivity === 'high' || profile.skinType === 'sensitive'
  let s = 0.7
  if (p && profile.skinType) s += p.skinTypes === 'all' || p.skinTypes.includes(profile.skinType) ? 0.2 : -0.25
  if (reactive && (item.fragranceFree ?? p?.fragranceFree) === false) s -= 0.2
  if (reactive && item.actives.some((a) => STRONG.includes(a))) s -= 0.1
  s -= 0.2 * alertCount
  return Math.max(0.05, Math.min(1, s))
}

interface Row {
  key: string
  item: Pick<ShelfItem, 'brand' | 'name' | 'category' | 'productId' | 'actives' | 'fragranceFree'>
  fit: number
  felt?: number
  onShelf: boolean
}

/** Qloo taste for the user's own brands, next to skin fit and their diary. Shown in Explore. */
export function CompareSection() {
  const shelf = useMomo((s) => s.shelf)
  const profile = useMomo((s) => s.profile)
  const days = useMomo((s) => s.days)
  const alerts = useAlerts()
  const [result, setResult] = useState<CompareResult>()
  const [error, setError] = useState<string>()

  const { mine, picks } = useMemo(() => {
    const dayList = Object.values(days)
    const mine: Row[] = shelf.map((i) => {
      const st = itemStats(i, dayList)
      const n = alerts.filter((a) => a.items.includes(i.id) && a.level !== 'tip').length
      return { key: i.id, item: i, fit: fitScore(i.productId ? PRODUCT_BY_ID.get(i.productId) : undefined, i, profile, n), felt: st.daysUsed ? st.goodDays / st.daysUsed : undefined, onShelf: true }
    })
    const owned = new Set(shelf.map((i) => i.productId))
    const cats = new Set(shelf.map((i) => i.category))
    if (!shelf.some((i) => i.category === 'sunscreen')) cats.add('sunscreen')
    const picks: Row[] = []
    for (const c of cats) {
      const best = CATALOG.filter((p) => p.category === c && !owned.has(p.id))
        .map((p) => {
          // Put the candidate on a copy of the shelf and let the watcher judge it like an owned product.
          const trial: ShelfItem = { id: '__trial', productId: p.id, brand: p.brand, name: p.name, category: p.category, actives: p.actives, fragranceFree: p.fragranceFree, when: p.time, addedAt: '' }
          const raised = watch({ shelf: [...shelf, trial], profile, days: [], today: '' }).filter((a) => a.items.includes(trial.id) && a.level !== 'tip').length
          return { p, fit: fitScore(p, p, profile, raised) }
        })
        .sort((a, b) => b.fit - a.fit)[0]
      // Only suggest what momo would be happy to see on this shelf.
      if (best && best.fit >= 0.65) picks.push({ key: best.p.id, item: { ...best.p, productId: best.p.id }, fit: best.fit, onShelf: false })
    }
    return { mine, picks: picks.slice(0, 6) }
  }, [shelf, profile, days, alerts])

  const brands = useMemo(() => [...new Set([...mine, ...picks].map((r) => r.item.brand).filter(Boolean))].sort(), [mine, picks])
  const brandKey = brands.join('|')

  // One Qloo call per visit or when the brand set or audience changes. No polling.
  useEffect(() => {
    if (!brandKey) return
    let live = true
    setError(undefined)
    api
      .compare({ brands: brandKey.split('|'), audience: { ageRange: profile.ageRange, gender: profile.gender } })
      .then((r) => live && setResult(r), (e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [brandKey, profile.ageRange, profile.gender])

  const affinity = (brand: string) => result?.brands.find((b) => b.brand === brand)?.affinity
  const audience = result?.audienceLabel ?? 'people like you'

  const RowView = ({ r }: { r: Row }) => {
    const a = affinity(r.item.brand)
    return (
      <li className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <ProductSwatch item={r.item} size="sm" className="size-14 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{r.item.brand || 'Unknown brand'}</p>
            <p className="truncate font-medium">{r.item.name}</p>
            <p className="text-xs text-muted-foreground first-letter:uppercase">{effectsOf(r.item)}</p>
          </div>
        </div>
        {r.item.brand ? (
          a === undefined ? (
            <Skeleton className="h-6" />
          ) : a === null ? (
            <p className="text-xs text-muted-foreground">No Qloo taste data yet</p>
          ) : (
            <Meter label={`Loved by ${audience}`} value={a} />
          )
        ) : (
          <p className="text-xs text-muted-foreground">No brand to compare</p>
        )}
        <Meter label="Fits your skin" value={r.fit} />
        {r.onShelf ? (
          r.felt === undefined ? <p className="text-xs text-muted-foreground">No diary days yet</p> : <Meter label="Felt good for you" value={r.felt} />
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              addProduct(`${r.item.brand} ${r.item.name}`)
              toast.success(`Added ${r.item.name} to your shelf`)
            }}
          >
            I use this
          </Button>
        )}
      </li>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-1">
        <EvidenceChips items={result?.evidence} />
        <InfoTip label="About these scores">
          <p>What {audience} love (Qloo), how well it fits your skin (momo), and how it felt for you (your diary).</p>
          <p className="text-muted-foreground">
            Taste shows what people like, not what works.{result?.meta.note ? ` Qloo: ${result.meta.note}.` : ''}
            {!profile.ageRange ? ' Tell momo your age group to sharpen the audience.' : ''}
          </p>
        </InfoTip>
      </div>
      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Could not reach Qloo: {error}</p>}

      {!shelf.length ? (
        <p className="rounded-2xl border bg-card p-6 text-muted-foreground">
          Add products on your <Link to="/shelf" className="text-primary underline">shelf</Link> first.
        </p>
      ) : (
        <>
          <h2 className="mb-3 font-heading text-xl">Your products</h2>
          <ul className="mb-8 space-y-3">
            {mine.map((r) => (
              <RowView key={r.key} r={r} />
            ))}
          </ul>
          {!!picks.length && (
            <>
              <h2 className="mb-3 flex items-center gap-1 font-heading text-xl">
                Worth a look
                <InfoTip label="About these picks">
                  <p>One per type you use, picked for your skin.</p>
                  <p className="text-muted-foreground">Sample catalog: names and prices are placeholders.</p>
                </InfoTip>
              </h2>
              <ul className="space-y-3">
                {picks.map((r) => (
                  <RowView key={r.key} r={r} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
