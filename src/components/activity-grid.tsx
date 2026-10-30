import { useEffect, useMemo, useRef } from 'react'
import type { DayLog } from '@shared/types.ts'
import { todayKey } from '@/lib/memory'
import { cn } from '@/lib/utils'

// A year-at-a-glance grid, one square per day, like a contribution graph.
// The shade counts what the user shared that day (a check-in, a story, a skin
// check), never how the skin looked: a hard day logged is as green as a good one.

const WEEKS = 26
const SHADE = ['bg-muted', 'bg-emerald-200 dark:bg-emerald-900', 'bg-emerald-400 dark:bg-emerald-700', 'bg-emerald-600 dark:bg-emerald-500'] as const

function level(d?: DayLog): 0 | 1 | 2 | 3 {
  if (!d) return 0
  const n = (d.score ? 1 : 0) + (d.notes.length ? 1 : 0) + (d.look ? 1 : 0)
  return Math.min(3, n) as 0 | 1 | 2 | 3
}

export function ActivityGrid({ days, className }: { days: Record<string, DayLog>; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const weeks = useMemo(() => {
    const today = new Date()
    // Start on the Sunday WEEKS-1 weeks ago, so today is in the last column.
    const start = new Date(today)
    start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7)
    const out: { date: string; month?: string; future: boolean }[][] = []
    for (let w = 0; w < WEEKS; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(start)
        day.setDate(start.getDate() + w * 7 + d)
        col.push({ date: todayKey(day), month: day.getDate() <= 7 && d === 0 ? day.toLocaleDateString(undefined, { month: 'short' }) : undefined, future: day > today })
      }
      out.push(col)
    }
    return out
  }, [])

  // On a phone, show the newest weeks first.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  // One grid, filled column by column: the day labels first, then one column
  // per week (month label + 7 days). Rows size to the squares, so the labels line up.
  return (
    <div ref={scroller} className={cn('overflow-x-auto text-[11px] text-muted-foreground', className)}>
      <div
        className="grid min-w-max grid-flow-col gap-[3px] sm:min-w-0"
        style={{ gridTemplateColumns: `auto repeat(${WEEKS}, minmax(0.875rem, 1fr))`, gridTemplateRows: '1rem repeat(7, auto)' }}
      >
        <span />
        {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((l, i) => (
          <span key={i} className="flex items-center pr-1 leading-none">
            {l}
          </span>
        ))}
        {weeks.flatMap((col, w) => [
          // w-0: a long month name must not widen its week.
          <span key={`m${w}`} className="w-0 whitespace-nowrap leading-4">
            {col[0].month ?? ''}
          </span>,
          ...col.map((c) => {
            const l = level(days[c.date])
            return <span key={c.date} title={c.future ? undefined : `${c.date}${l ? '' : ': no check-in'}`} className={cn('aspect-square rounded-[3px]', c.future ? 'bg-transparent' : SHADE[l])} />
          }),
        ])}
      </div>
    </div>
  )
}

export function ActivityLegend() {
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      Less
      {SHADE.map((s) => (
        <span key={s} className={cn('size-3 rounded-[3px]', s)} />
      ))}
      More
    </span>
  )
}
