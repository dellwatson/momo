import { cn } from '@/lib/utils'

export function Meter({ label, value, className }: { label: string; value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary/80 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
