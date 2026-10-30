import { BookOpen, Heart, Link2, Search, ShieldCheck, Users } from 'lucide-react'
import type { TraceStep } from '@shared/types.ts'
import { cn } from '@/lib/utils'

// What the agent did for a reply: one line per tool call. In the chat it is
// listed; on Home it sits in the sources popover (src/components/talk.tsx).

const ICON: Record<string, typeof Search> = {
  my_history: BookOpen,
  find_products: Search,
  peer_reviews: Users,
  qloo_taste: Heart,
  check_shelf: ShieldCheck,
  read_link: Link2,
}

function Step({ s }: { s: TraceStep }) {
  const Icon = ICON[s.tool] ?? Search
  return (
    <li>
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {s.label}
          {s.count !== undefined && s.tool !== 'my_history' ? ` · ${s.count}` : ''}
        </span>
        {s.status === 'sample' && <span className="text-amber-700">sample</span>}
        <span className="tabular-nums opacity-60">{s.ms} ms</span>
      </div>
      {!!s.top?.length && <QlooTop top={s.top} />}
    </li>
  )
}

/** Qloo's own answer, top first. Brands momo carries are solid; the others are outlined. */
function QlooTop({ top }: { top: NonNullable<TraceStep['top']> }) {
  return (
    <ol className="mt-1 mb-1 ml-4.5 flex flex-wrap gap-1" aria-label="Brands Qloo ranked for this taste">
      {top.map((b) => (
        <li
          key={b.name}
          title={b.inCatalog ? 'momo carries this brand' : 'Not in momo yet'}
          className={cn('rounded-full px-1.5 py-px', b.inCatalog ? 'bg-rose-100 text-rose-900' : 'border border-dashed opacity-70')}
        >
          {b.name} <span className="tabular-nums">{b.pct}%</span>
        </li>
      ))}
    </ol>
  )
}

export function TraceList({ trace, className }: { trace?: TraceStep[]; className?: string }) {
  if (!trace?.length) return null
  return <ul className={cn('space-y-0.5 text-[11px] text-muted-foreground', className)}>{trace.map((s, i) => <Step key={i} s={s} />)}</ul>
}
