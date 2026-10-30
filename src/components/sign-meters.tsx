import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { SIGN_LABELS, SIGNS, type Sign, type Signs } from '@shared/types.ts'
import { cn } from '@/lib/utils'

// What momo saw on the skin, with the change from the last check. For every
// sign, less is better, so a down arrow is green.

export function SignMeters({ signs, previous, only, className }: { signs: Signs; previous?: Signs; only?: Sign[]; className?: string }) {
  const keys = only ?? SIGNS
  return (
    <ul className={cn('space-y-2.5', className)}>
      {keys.map((k) => {
        const v = signs[k]
        const d = previous ? v - previous[k] : 0
        const Icon = Math.abs(d) < 0.08 ? Minus : d < 0 ? ArrowDown : ArrowUp
        return (
          <li key={k} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>{SIGN_LABELS[k]}</span>
              <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                {v < 0.15 ? 'None' : v < 0.4 ? 'A little' : v < 0.7 ? 'Some' : 'A lot'}
                {previous && <Icon className={cn('size-3.5', Math.abs(d) < 0.08 ? '' : d < 0 ? 'text-emerald-600' : 'text-rose-600')} aria-label={Math.abs(d) < 0.08 ? 'same as last time' : d < 0 ? 'less than last time' : 'more than last time'} />}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/75 transition-[width] duration-500" style={{ width: `${Math.round(v * 100)}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
