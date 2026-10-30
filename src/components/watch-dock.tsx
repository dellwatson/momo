import { useEffect } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useLocation } from 'react-router'
import { AlertCard } from '@/components/alert-card'
import { createStore, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useAlerts } from '@/state/momo'

// What the watcher noticed, as a floating panel over every page. It starts
// small: a pill with the count. Open, it lists the notes with a plan for each.
// A note is information and a plan, never a ban.

// Not saved: each page starts with the panel small.
export const dockStore = createStore<{ open: boolean }>(null, { open: false })
export const openDock = () => dockStore.set({ open: true })

export function WatchDock() {
  const alerts = useAlerts().filter((a) => a.level !== 'tip')
  const open = useStore(dockStore, (d) => d.open)
  const { pathname } = useLocation()
  useEffect(() => dockStore.set({ open: false }), [pathname])
  if (!alerts.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-end px-4 md:bottom-6">
      {open ? (
        <section className="pointer-events-auto flex max-h-[60svh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border bg-background shadow-xl" aria-label="momo is watching">
          <button type="button" onClick={() => dockStore.set({ open: false })} className="flex items-center justify-between gap-2 border-b px-4 py-2.5 text-sm font-medium" aria-label="Minimize">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> {alerts.length} to watch
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
          <div className="space-y-2 overflow-y-auto p-3">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={openDock}
          className={cn('pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-950 shadow-lg dark:bg-amber-950 dark:text-amber-100')}
        >
          <AlertTriangle className="size-4 text-amber-500" />
          {alerts.length} to watch
        </button>
      )}
    </div>
  )
}
