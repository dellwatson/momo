import { useState } from 'react'
import { Camera, Check, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CAMERA, SCAN, type Question } from '@/lib/checkin'
import { cn } from '@/lib/utils'
import { answerChips } from '@/state/momo'

// Tap answers for momo's check-in question. Used in the voice sheet and the chat.

export function Chips({ q, className }: { q: Question; className?: string }) {
  const [picked, setPicked] = useState<string[]>([])
  if (!q.chips.length) return null
  const toggle = (v: string) =>
    setPicked((p) => {
      if (v === '__none') return p.includes(v) ? [] : [v]
      const next = p.filter((x) => x !== '__none')
      return next.includes(v) ? next.filter((x) => x !== v) : [...next, v]
    })
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {q.chips.map((c) => {
        const on = picked.includes(c.value)
        const Icon = c.value === CAMERA ? Camera : c.value === SCAN ? ScanLine : undefined
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => (q.multi ? toggle(c.value) : answerChips([c.value]))}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
              on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50 hover:bg-accent',
              Icon && 'border-primary/40 text-primary',
            )}
          >
            {Icon && <Icon className="size-4" />}
            {c.label}
          </button>
        )
      })}
      {q.multi && (
        <Button size="sm" className="rounded-full" disabled={!picked.length} onClick={() => answerChips(picked)}>
          <Check /> Done
        </Button>
      )}
    </div>
  )
}
