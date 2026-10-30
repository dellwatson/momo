import { useState } from 'react'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import type { Alert, AlertLevel } from '@shared/watch.ts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dismissAlert } from '@/state/momo'

const LEVEL: Record<AlertLevel, { icon: typeof Info; tone: string; label: string }> = {
  stop: { icon: OctagonAlert, tone: 'border-rose-300 bg-rose-50 text-rose-950', label: 'Take a break' },
  watch: { icon: AlertTriangle, tone: 'border-amber-300 bg-amber-50 text-amber-950', label: 'Watch out' },
  tip: { icon: Info, tone: 'border-sky-200 bg-sky-50 text-sky-950', label: 'Tip' },
}

export function AlertCard({ alert, compact, preview, className }: { alert: Alert; compact?: boolean; preview?: boolean; className?: string }) {
  const [why, setWhy] = useState(false)
  const L = LEVEL[alert.level]
  return (
    <div className={cn('rounded-xl border p-3 text-sm', L.tone, className)}>
      <div className="flex items-start gap-2">
        <L.icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{L.label}</p>
          <p className="font-medium leading-snug">{alert.title}</p>
          {!compact && <p className="opacity-90">{alert.body}</p>}
          <p className="opacity-90">
            <span className="font-medium">Try this: </span>
            {alert.tip}
          </p>
          {why && <p className="rounded-lg bg-white/60 p-2 text-xs opacity-90">{alert.why}</p>}
          <div className="flex gap-1 pt-0.5">
            <Button size="xs" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setWhy((w) => !w)}>
              {why ? 'Hide why' : 'Why?'}
            </Button>
            {!preview && (
              <Button size="xs" variant="ghost" className="h-6 px-2 text-xs" onClick={() => dismissAlert(alert.id)}>
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
