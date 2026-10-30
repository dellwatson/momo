import { BookOpen, Camera, Heart, Stethoscope, Tag, Users } from 'lucide-react'
import { EVIDENCE_LABELS, type Evidence, type EvidenceKind } from '@shared/types.ts'
import { cn } from '@/lib/utils'

// Small chips under what momo says: where it comes from, and how much stands
// behind it. Qloo is labelled as a taste match, never as a result.

const ICONS: Record<EvidenceKind, typeof BookOpen> = {
  diary: BookOpen,
  reviews: Users,
  product: Tag,
  doctor: Stethoscope,
  skin_scan: Camera,
  qloo: Heart,
}

function chipText(e: Evidence): string {
  const label = e.kind === 'qloo' ? `${EVIDENCE_LABELS.qloo} · Qloo` : EVIDENCE_LABELS[e.kind]
  return e.detail ? `${label} · ${e.detail}` : label
}

export function EvidenceChips({ items, className }: { items?: Evidence[]; className?: string }) {
  if (!items?.length) return null
  return (
    <ul className={cn('flex flex-wrap gap-1', className)} aria-label="Where this comes from">
      {items.map((e, i) => {
        const Icon = ICONS[e.kind]
        const sample = e.status === 'sample'
        return (
          <li
            key={`${e.kind}-${i}`}
            title={sample ? 'Sample data: the real source is not connected' : e.status === 'cached' ? `Saved data${e.asOf ? ` from ${e.asOf}` : ''}` : undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground',
              sample && 'border-dashed border-amber-300 text-amber-800 dark:text-amber-300',
            )}
          >
            <Icon className="size-3" aria-hidden />
            {chipText(e)}
            {sample && <span className="font-medium">· sample</span>}
          </li>
        )
      })}
    </ul>
  )
}
