import { useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import type { ScanResult } from '@shared/types.ts'
import { effectsOf } from '@shared/watch.ts'
import { AlertCard } from '@/components/alert-card'
import { Camera, type Shot } from '@/components/camera'
import { FullSheet } from '@/components/full-sheet'
import { Mascot } from '@/components/mascot'
import { ProductSwatch } from '@/components/product-swatch'
import { EvidenceChips } from '@/components/evidence'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { speak } from '@/lib/speech'
import { addProduct, addScanned, closeSheet, itemFromScan, onShelf, scanProduct, trialAlerts } from '@/state/momo'

// Product scan: the user shows the front (and the back label, if they like).
// momo reads or predicts what is inside, then says in effects whether it works
// with the rest of their shelf. One vision call per scan.

export function ScanSheet() {
  const [step, setStep] = useState<'front' | 'back' | 'reading' | 'result'>('front')
  const [photos, setPhotos] = useState<string[]>([])
  const [result, setResult] = useState<ScanResult>()
  const [error, setError] = useState<string>()
  const [inside, setInside] = useState(false)
  const [typed, setTyped] = useState('')

  const read = async (shots: string[]) => {
    setStep('reading')
    setError(undefined)
    try {
      const r = await scanProduct(shots)
      setResult(r)
      setStep('result')
      if (!r.found) return void speak("I couldn't make out the product. Try again, or tell me its name.")
      const item = itemFromScan(r)
      const alerts = trialAlerts(item)
      const verdict = onShelf(item)
        ? 'This one is already on your shelf.'
        : alerts.length
          ? alerts[0].title
          : 'It works with everything else you use.'
      void speak(`${item.brand} ${item.name}. ${verdict}`)
    } catch (e) {
      setError((e as Error).message)
      setStep('front')
    }
  }

  const onFront = ({ dataUrl }: Shot) => {
    setPhotos([dataUrl])
    setStep('back')
  }

  const item = useMemo(() => (result?.found ? itemFromScan(result) : undefined), [result])
  const alerts = useMemo(() => (item ? trialAlerts(item) : []), [item])
  const owned = item ? onShelf(item) : undefined

  return (
    <FullSheet title="Scan a product" onClose={closeSheet}>
      {step === 'front' && (
        <div className="space-y-3">
          <Camera facing="environment" guide="product" hint="Show the front of the product, with the name in the frame." onShot={onFront} />
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Could not read the photo: {error}</p>}
        </div>
      )}

      {step === 'back' && (
        <div className="space-y-3">
          <Camera facing="environment" guide="product" hint="Optional: turn it around and show the ingredient list." onShot={({ dataUrl }) => void read([...photos, dataUrl])} />
          <Button variant="outline" className="w-full rounded-full" onClick={() => void read(photos)}>
            Skip, the front is enough
          </Button>
        </div>
      )}

      {step === 'reading' && (
        <div className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="flex gap-2">
            {photos.map((p, i) => (
              <img key={i} src={p} alt="" className="h-48 rounded-2xl object-cover opacity-80" />
            ))}
          </div>
          <Mascot mood="curious" size={72} thinking />
          <p className="text-muted-foreground">momo is reading the label…</p>
        </div>
      )}

      {step === 'result' && result && !item && (
        <div className="space-y-4 pt-4 text-center">
          <Mascot mood="curious" size={88} className="mx-auto" />
          <p className="font-heading text-xl">I couldn't make out the product.</p>
          {result.meta.status === 'sample' && <p className="text-sm text-muted-foreground">momo's eyes need a vision key in /Users/Shared/momo/.env. Until then, tell me its name.</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!typed.trim()) return
              addProduct(typed)
              closeSheet()
            }}
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Product name" className="h-11 rounded-full px-4" aria-label="Product name" />
            <Button type="submit" className="h-11 rounded-full" disabled={!typed.trim()}>
              Add
            </Button>
          </form>
          <Button variant="ghost" onClick={() => setStep('front')}>
            <RotateCcw /> Scan again
          </Button>
        </div>
      )}

      {step === 'result' && result && item && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <ProductSwatch item={item} className="size-20 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{item.brand || 'Unknown brand'}</p>
              <p className="font-heading text-xl leading-tight">{item.name}</p>
              <p className="mt-1 text-sm first-letter:uppercase">{result.effects || effectsOf(item)}</p>
            </div>
          </div>
          <EvidenceChips items={result.evidence} />

          {owned ? (
            <p className="rounded-2xl border bg-card p-4">This one is already on your shelf.</p>
          ) : alerts.length ? (
            <div className="space-y-2">
              {alerts.map((a) => (
                <AlertCard key={a.id} alert={a} compact preview />
              ))}
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              It works with everything else you use{item.fragranceFree === false ? ', but it has fragrance' : ''}.
            </p>
          )}

          <div>
            <Button variant="ghost" size="sm" onClick={() => setInside((v) => !v)}>
              {inside ? 'Hide what is inside' : 'What is inside?'}
            </Button>
            {inside && (
              <p className="mt-1 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                {result.ingredients.length ? result.ingredients.join(', ') : item.actives.length ? `Key actives: ${item.actives.join(', ').replaceAll('_', ' ')}` : 'No key actives found.'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" className="h-12 rounded-full" onClick={closeSheet}>
              Just checking
            </Button>
            <Button
              size="lg"
              className="h-12 rounded-full"
              disabled={!!owned}
              onClick={() => {
                addScanned(item)
                closeSheet()
              }}
            >
              I use this
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/70">
            {result.meta.model ?? result.meta.tool} {result.meta.status} · {result.meta.ms} ms
          </p>
        </div>
      )}
    </FullSheet>
  )
}
