import { Camera } from 'lucide-react'
import { SIGNS } from '@shared/types.ts'
import { StoredPhoto } from '@/components/photo'
import { SignMeters } from '@/components/sign-meters'
import { Button } from '@/components/ui/button'
import { ESTIMATED } from '@/lib/skin-estimate'
import { openSheet, useMomo } from '@/state/momo'

// The skin timeline: every skin check, newest first, with what changed since
// the one before. Photos come from this device only.

const fmt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function SkinPage() {
  const days = useMomo((s) => s.days)
  const looks = Object.values(days)
    .filter((d) => d.look)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6 pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl font-medium tracking-tight">Your skin</h1>
          <p className="text-muted-foreground">Every check, and what changed since the one before.</p>
        </div>
        <Button className="rounded-full" onClick={() => openSheet('skin')}>
          <Camera /> New skin check
        </Button>
      </div>

      {!looks.length ? (
        <div className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">
          No skin checks yet. Take one today, and momo can tell you what changes from here.
        </div>
      ) : (
        <ol className="space-y-4">
          {looks.map((d, i) => {
            const look = d.look!
            const before = looks[i + 1]?.look
            return (
              <li key={d.date} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 rounded-3xl border bg-card p-4 sm:grid-cols-[140px_minmax(0,1fr)_200px]">
                <StoredPhoto id={look.photoId} alt={`Skin check from ${fmt(d.date)}`} className="aspect-[3/4] w-full rounded-2xl" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{fmt(d.date)}</p>
                  <p className="text-sm leading-snug">{look.summary}</p>
                  {look.status === 'sample' && <p className="text-xs text-muted-foreground">On-device estimate</p>}
                </div>
                <SignMeters signs={look.signs} previous={before?.signs} only={look.status === 'live' ? [...SIGNS] : ESTIMATED} className="col-span-2 sm:col-span-1" />
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
