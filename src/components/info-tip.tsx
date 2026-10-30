import { Popover } from '@base-ui/react/popover'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// A small (i) button that opens the explanation, so pages lead with products,
// not paragraphs.

export function InfoTip({ label = 'More information', children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={label} className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground', className)}>
        <Info className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} collisionPadding={12} className="z-50">
          <Popover.Popup className="max-w-xs space-y-2 rounded-2xl border bg-popover p-3 text-sm leading-snug text-popover-foreground shadow-lg outline-none">{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
