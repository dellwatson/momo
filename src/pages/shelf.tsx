import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Package, Plus, ScanLine, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CATALOG, PRODUCT_BY_ID } from '@shared/catalog.ts'
import { FEELING_LABELS, type ShelfItem, type When } from '@shared/types.ts'
import { effectsOf } from '@shared/watch.ts'
import { openDock } from '@/components/watch-dock'
import { Mascot } from '@/components/mascot'
import { ProductSwatch } from '@/components/product-swatch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { itemStats } from '@/lib/memory'
import { cn } from '@/lib/utils'
import { addProduct, openSheet, removeProduct, setWhen, useAlerts, useMomo } from '@/state/momo'

const fmt = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
const daysUntil = (date: Date) => Math.round((date.getTime() - Date.now()) / 86_400_000)

/** Opened date plus the open-jar months on the pack. */
function useBy(i: ShelfItem): Date | undefined {
  if (!i.openedAt || !i.paoMonths) return undefined
  const d = new Date(`${i.openedAt}T12:00:00`)
  d.setMonth(d.getMonth() + i.paoMonths)
  return d
}

/** Stock and dates, in neutral words. A product near its date is information, not a ban. */
function Stock({ i }: { i: ShelfItem }) {
  const by = useBy(i)
  const left = by && daysUntil(by)
  if (i.left === undefined && !by) return null
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-2.5 text-xs">
      {i.left !== undefined && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-muted-foreground">
            <Package className="size-3.5" /> {Math.round(i.left * 100)}% left
            {i.left <= 0.2 ? ' · time to restock' : ''}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-background">
            <div className={cn('h-full rounded-full', i.left <= 0.2 ? 'bg-amber-400' : 'bg-primary/70')} style={{ width: `${Math.round(i.left * 100)}%` }} />
          </div>
        </div>
      )}
      {by && left !== undefined && (
        <p className={cn('flex items-start gap-1 text-muted-foreground', left <= 30 && 'text-amber-800')}>
          <CalendarClock className="mt-px size-3.5 shrink-0" />
          {left < 0 ? `Past its use-by date (${by.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})` : `Use within ${left} days`}
        </p>
      )}
    </div>
  )
}

const WHEN: { value: When; label: string }[] = [
  { value: 'am', label: 'Morning' },
  { value: 'pm', label: 'Night' },
  { value: 'both', label: 'Both' },
]

export function ShelfPage() {
  const shelf = useMomo((s) => s.shelf)
  const days = useMomo((s) => s.days)
  const reviews = useMomo((s) => s.reviews ?? [])
  const alerts = useAlerts()
  const [text, setText] = useState('')
  const [inside, setInside] = useState<string>()
  const dayList = useMemo(() => Object.values(days), [days])

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const r = addProduct(text)
    if (!r) toast.info('That one is already on your shelf.')
    else toast.success(r.known ? `Added ${r.item.brand} ${r.item.name}` : `Added "${r.item.name}". momo is guessing what it does from the name.`)
    setText('')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Mascot mood={alerts.some((a) => a.level !== 'tip') ? 'concerned' : 'happy'} size={64} />
        <div>
          <h1 className="font-heading text-4xl font-medium tracking-tight">Your shelf</h1>
          <p className="text-muted-foreground">
            {shelf.length
              ? `momo knows what is inside your ${shelf.length} product${shelf.length > 1 ? 's' : ''} and watches how they work together.`
              : 'Add what you use. momo remembers what is inside, so you do not have to.'}
          </p>
        </div>
      </div>

      <form onSubmit={add} className="mb-6 flex gap-2">
        <Button type="button" size="lg" className="h-10 shrink-0" onClick={() => openSheet('scan')}>
          <ScanLine /> Scan
        </Button>
        <Input list="known-products" value={text} onChange={(e) => setText(e.target.value)} placeholder='Or type a name, for example "Laneige water sleeping mask"' className="h-10" maxLength={80} />
        <datalist id="known-products">
          {CATALOG.map((p) => (
            <option key={p.id} value={`${p.brand} ${p.name}`} />
          ))}
        </datalist>
        <Button type="submit" size="lg" variant="outline" className="h-10 shrink-0" aria-label="Add">
          <Plus /> <span className="hidden sm:inline">Add</span>
        </Button>
      </form>

      <ul className="grid gap-4 md:grid-cols-2">
        {shelf.map((i) => {
          const st = itemStats(i, dayList)
          const p = i.productId ? PRODUCT_BY_ID.get(i.productId) : undefined
          const noted = alerts.filter((a) => a.level !== 'tip' && a.items.includes(i.id))
          const mine = reviews.find((r) => (r.productId ? r.productId === i.productId : r.name === i.name))
          const logged = dayList.filter((d) => d.score && d.date >= (i.openedAt ?? i.addedAt.slice(0, 10))).length
          return (
            <li key={i.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <div className="flex gap-4">
                <ProductSwatch item={i} size="sm" className="size-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{i.brand || 'Unknown brand'}</p>
                  <p className="font-medium leading-snug">{i.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">{effectsOf(i)}</p>
                  {mine && (
                    <p className="mt-1 flex items-center gap-0.5" aria-label={`You rated it ${mine.rating} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={cn('size-3', n <= mine.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">your review</span>
                    </p>
                  )}
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => removeProduct(i.id)}>
                  <Trash2 />
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex rounded-full border p-0.5 text-xs">
                  {WHEN.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setWhen(i.id, w.value)}
                      className={cn('rounded-full px-2.5 py-1', i.when === w.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {st.daysUsed
                    ? `Used ${st.daysUsed} day${st.daysUsed > 1 ? 's' : ''} · good on ${st.goodDays}${st.top.length ? ` · often ${st.top.map((f) => FEELING_LABELS[f].toLowerCase()).join(', ')}` : ''}`
                    : 'No diary days yet'}
                  {st.daysUsed && logged ? ` · ${Math.round((st.daysUsed / logged) * 100)}% of logged days` : ''}
                </p>
              </div>
              <Stock i={i} />
              {!!noted.length && (
                <button
                  type="button"
                  onClick={openDock}
                  className="flex items-center gap-1.5 self-start rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                >
                  <AlertTriangle className="size-3.5 text-amber-500" /> {noted.length === 1 ? noted[0].title : `${noted.length} notes from momo`}
                </button>
              )}
              <div className="text-xs">
                <button type="button" className="text-muted-foreground underline-offset-2 hover:underline" onClick={() => setInside(inside === i.id ? undefined : i.id)}>
                  {inside === i.id ? 'Hide details' : 'Details and ingredients'}
                </button>
                {inside === i.id && (
                  <div className="mt-1.5 space-y-1 rounded-lg bg-muted p-2 text-muted-foreground">
                    {(i.purchasedAt || i.openedAt || i.store) && (
                      <p>
                        {[
                          i.purchasedAt && `Bought ${fmt(i.purchasedAt)}`,
                          i.store && `at ${i.store}`,
                          i.openedAt && `opened ${fmt(i.openedAt)}`,
                          i.paoMonths && `use within ${i.paoMonths} months of opening`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    <p>
                      {p
                        ? `${p.keyIngredients.join(', ')}. ${p.fragranceFree ? 'No added fragrance.' : 'Contains fragrance.'}`
                        : i.actives.length
                          ? `momo does not know this formula. From the name it likely has: ${i.actives.join(', ').replace(/_/g, ' ')}.`
                          : 'momo does not know this formula yet, so it watches this one through your diary only.'}
                    </p>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
