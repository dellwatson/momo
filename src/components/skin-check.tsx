import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { SIGNS, type Sign } from '@shared/types.ts'
import { Camera, type Shot } from '@/components/camera'
import { EvidenceChips } from '@/components/evidence'
import { FullSheet } from '@/components/full-sheet'
import { Mascot } from '@/components/mascot'
import { SignMeters } from '@/components/sign-meters'
import { Button } from '@/components/ui/button'
import { estimateSkin, ESTIMATED } from '@/lib/skin-estimate'
import { speak } from '@/lib/speech'
import { checkSkin, closeSheet, uiStore, type SkinCheck } from '@/state/momo'

// The daily skin check: a selfie with a face guide, one vision call, and what
// changed since the last check. The photo stays on this device.

const RETAKE: Record<string, string> = {
  too_dark: 'It is a bit dark. Face a window and try again.',
  blurry: 'That one is blurry. Hold still for the count.',
  no_face: "I can't see your face. Fit it inside the oval.",
  too_far: 'Come a little closer, so your face fills the oval.',
}

const fmt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function SkinCheckSheet() {
  const [step, setStep] = useState<'camera' | 'reading' | 'done'>('camera')
  const [shot, setShot] = useState<string>()
  const [check, setCheck] = useState<SkinCheck>()
  const [error, setError] = useState<string>()
  // From the voice check-in, the voice sheet says the result when it comes back.
  const fromTalk = uiStore.get().back === 'talk'

  const onShot = async ({ dataUrl, canvas }: Shot) => {
    setShot(dataUrl)
    setStep('reading')
    setError(undefined)
    try {
      const c = await checkSkin(dataUrl, estimateSkin(canvas))
      setCheck(c)
      setStep('done')
      const line = c.result.shot === 'ok' ? c.result.summary : RETAKE[c.result.shot]
      if (!fromTalk || c.result.shot !== 'ok') void speak(line)
    } catch (e) {
      setError((e as Error).message)
      setStep('camera')
    }
  }

  const r = check?.result
  const live = r?.meta.status === 'live'
  const only: Sign[] = live ? [...SIGNS] : ESTIMATED

  return (
    <FullSheet title="Skin check" onClose={closeSheet}>
      {step === 'camera' && (
        <div className="space-y-3">
          <Camera facing="user" guide="face" countdown={3} hint="Face a window. Fit your face in the oval, no makeup if you can." onShot={(s) => void onShot(s)} />
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Could not read the photo: {error}</p>}
          <p className="text-center text-xs text-muted-foreground">Your photo is saved only on this device. To read it, momo sends it once to the vision model.</p>
        </div>
      )}

      {step === 'reading' && (
        <div className="flex flex-col items-center gap-4 pt-6 text-center">
          {shot && <img src={shot} alt="Your skin check photo" className="w-56 rounded-3xl object-cover opacity-80" />}
          <Mascot mood="curious" size={72} thinking />
          <p className="text-muted-foreground">momo is looking…</p>
        </div>
      )}

      {step === 'done' && r && check && (
        <div className="space-y-5">
          {r.shot !== 'ok' ? (
            <div className="flex flex-col items-center gap-4 pt-4 text-center">
              <img src={check.photo} alt="The photo momo could not read" className="w-48 rounded-3xl object-cover" />
              <p className="font-heading text-xl">{RETAKE[r.shot]}</p>
              <Button className="rounded-full" onClick={() => setStep('camera')}>
                <RotateCcw /> Try again
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {check.previous ? (
                  <figure className="space-y-1">
                    <img src={check.previous.photo} alt={`Skin check from ${fmt(check.previous.date)}`} className="aspect-[3/4] w-full rounded-2xl object-cover" />
                    <figcaption className="text-center text-xs text-muted-foreground">{fmt(check.previous.date)}</figcaption>
                  </figure>
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Your first check. Next time I can compare.</div>
                )}
                <figure className="space-y-1">
                  <img src={check.photo} alt="Today's skin check" className="aspect-[3/4] w-full rounded-2xl object-cover" />
                  <figcaption className="text-center text-xs text-muted-foreground">Today</figcaption>
                </figure>
              </div>
              <div className="flex items-start gap-3">
                <Mascot mood={r.mood} size={44} className="shrink-0" />
                <div className="space-y-1.5">
                  <p className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-base leading-snug">{r.summary}</p>
                  <EvidenceChips items={r.evidence} />
                </div>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <p className="mb-3 text-sm font-medium">What momo sees{check.previous ? ', compared with last time' : ''}</p>
                <SignMeters signs={r.signs} previous={check.previous?.signs} only={only} />
                {!live && <p className="mt-3 text-xs text-muted-foreground">Rough on-device estimate. Add a vision key in /Users/Shared/momo/.env for a real read.</p>}
              </div>
              <Button size="lg" className="h-12 w-full rounded-full text-base" onClick={closeSheet}>
                {fromTalk ? 'Back to momo' : 'Done'}
              </Button>
            </>
          )}
        </div>
      )}
    </FullSheet>
  )
}
