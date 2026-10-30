import { useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { AGE_LABELS, FEELING_LABELS, SKIN_TYPE_LABELS, isReaction } from '@shared/types.ts'
import { Mascot } from '@/components/mascot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { exportMemory, forgetFact, resetMemory, useMomo } from '@/state/momo'

const SCORE = { 1: 'Not great', 2: 'Okay', 3: 'Great' } as const

function download() {
  const blob = new Blob([exportMemory()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `momo-memory-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function DiaryPage() {
  const profile = useMomo((s) => s.profile)
  const shelf = useMomo((s) => s.shelf)
  const daysMap = useMomo((s) => s.days)
  const [confirm, setConfirm] = useState(false)
  const days = useMemo(() => Object.values(daysMap).sort((a, b) => b.date.localeCompare(a.date)), [daysMap])
  const nameOf = (id: string) => shelf.find((i) => i.id === id)?.name ?? 'a removed product'

  const known: [string, string | undefined][] = [
    ['Name', profile.name],
    ['Skin', profile.skinType && SKIN_TYPE_LABELS[profile.skinType]],
    ['Reacts to new products', profile.sensitivity && { low: 'Rarely', medium: 'Sometimes', high: 'Often' }[profile.sensitivity]],
    ['City', profile.city],
    ['Age', profile.ageRange && AGE_LABELS[profile.ageRange]],
  ]

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <h1 className="mb-1 font-heading text-4xl font-medium tracking-tight">Diary</h1>
        <p className="mb-6 text-muted-foreground">momo writes this from your check-ins and chats.</p>
        {!days.length && <p className="rounded-2xl border bg-card p-6 text-muted-foreground">No days yet. Check in with momo on the Chat page.</p>}
        <ol className="space-y-3">
          {days.map((d) => {
            const bad = d.feelings?.some(isReaction)
            return (
              <li key={d.date} className="rounded-2xl border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {new Date(`${d.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  {d.score && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', d.score === 3 ? 'bg-emerald-100 text-emerald-900' : d.score === 1 ? 'bg-rose-100 text-rose-900' : 'bg-muted')}>
                      {SCORE[d.score]}
                    </span>
                  )}
                </div>
                {!!d.feelings?.length && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {d.feelings.map((f) => (
                      <Badge key={f} variant={isReaction(f) ? 'destructive' : 'secondary'}>
                        {FEELING_LABELS[f]}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="space-y-1 text-sm text-muted-foreground">
                  {!!d.used?.length && <p>Used: {d.used.map(nameOf).join(', ')}</p>}
                  {!!d.events?.length && <p>Life: {d.events.join(', ')}</p>}
                  {d.notes.map((n, i) => (
                    <p key={i}>"{n}"</p>
                  ))}
                  {bad && d.used?.length === 0 && <p>No products that day, so this was likely something else.</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <aside className="space-y-4 md:sticky md:top-20 md:self-start">
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <div className="mb-3 flex items-center gap-2">
            <Mascot mood="calm" size={36} />
            <p className="font-medium">What momo knows about you</p>
          </div>
          <dl className="space-y-1.5">
            {known.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{v ?? '-'}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">From your chats</p>
          {profile.facts.length ? (
            <ul className="space-y-1">
              {profile.facts.map((f) => (
                <li key={f} className="group flex items-start justify-between gap-2">
                  <span>{f}</span>
                  <button type="button" aria-label={`Forget: ${f}`} className="text-muted-foreground opacity-60 hover:opacity-100" onClick={() => forgetFact(f)}>
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nothing yet. Chat with momo and it will remember.</p>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <p className="mb-1 font-medium">Your data</p>
          <p className="mb-3 text-muted-foreground">Everything stays in this browser. Download it to keep a copy.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={download}>
              <Download /> Download
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
              Reset momo
            </Button>
          </div>
        </div>
      </aside>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset momo?</DialogTitle>
            <DialogDescription>This deletes your shelf, diary and chats from this browser. Download a copy first if you want to keep them.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetMemory()
                setConfirm(false)
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
