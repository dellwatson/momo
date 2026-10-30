import { useEffect, useState } from 'react'
import { Compass, Home, ShoppingBag, Sparkles, SprayCan, UserRound } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import type { HealthResult, Status } from '@shared/types.ts'
import { Mascot } from '@/components/mascot'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { furById } from '@/lib/momo3d/furs'
import { cn } from '@/lib/utils'
import { useAlerts, useMomo } from '@/state/momo'

function ModeDot({ label, status }: { label: string; status?: Status }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-1.5 rounded-full', status === 'live' ? 'bg-emerald-500' : status === 'sample' ? 'bg-amber-500' : 'bg-muted-foreground/40')} />
      {label}
    </span>
  )
}

/** Which APIs are live. Always on screen, so it is easy to see whether Qloo is live. Tap: the status card on Profile. */
export function AgentMode({ full }: { full?: boolean }) {
  const [health, setHealth] = useState<HealthResult | 'down'>()
  useEffect(() => {
    api.health().then(setHealth, () => setHealth('down'))
  }, [])
  const h = health === 'down' ? undefined : health
  const help =
    health === 'down'
      ? 'The agent server is not reachable. Run npm run dev in /Users/Shared/momo.'
      : `Green: live API${h?.vision.model ? ` (vision: ${h.vision.model})` : ''}. Amber: sample data, no key in /Users/Shared/momo/.env.`
  const dots = (
    <>
      <ModeDot label="Qloo" status={h?.qloo} />
      <ModeDot label="Chat" status={h?.chat.status} />
      <ModeDot label="Vision" status={h?.vision.status} />
      <ModeDot label="Jev" status={h?.jev} />
    </>
  )
  if (full)
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1">{dots}</div>
        <p className="text-xs text-muted-foreground">
          {help}
          {h?.chat.model ? ` Chat model: ${h.chat.model}.` : ''}
        </p>
      </div>
    )
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Link to="/profile#status" />}
        className="flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground [&>span:nth-child(n+2)]:hidden lg:[&>span:nth-child(n+2)]:flex"
        aria-label="API status"
      >
        {dots}
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  )
}

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/shelf', label: 'Shelf', icon: SprayCan, alerts: true },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

/** Points and the shop, top right. The shop is where momo is customized. */
function Wallet() {
  const points = useMomo((s) => s.account?.points ?? 0)
  return (
    <NavLink
      to="/shop"
      className={({ isActive }) => cn('flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-sm font-medium hover:border-primary/40', isActive && 'border-primary/40 bg-accent')}
      aria-label={`${points} points. Open the shop`}
    >
      <Sparkles className="size-4 text-amber-500" />
      {points}
      <ShoppingBag className="ml-0.5 size-4 text-muted-foreground" />
    </NavLink>
  )
}

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-medium text-white">{n}</span>
}

export function SiteHeader() {
  const mood = useMomo((s) => s.mood)
  const fur = furById(useMomo((s) => s.account?.fur))
  const watching = useAlerts().filter((a) => a.level !== 'tip').length
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-6">
        <Link to="/" className="flex items-center gap-1.5 font-heading text-2xl font-semibold tracking-tight text-primary">
          <Mascot mood={mood} size={30} fur={fur} />
          momo
        </Link>
        <nav className="hidden items-center gap-0.5 text-sm md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('relative whitespace-nowrap rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground', isActive && 'bg-accent text-accent-foreground')
              }
            >
              {n.label}
              {n.alerts && <Badge n={watching} />}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AgentMode />
          <Wallet />
        </div>
      </div>
    </header>
  )
}

/** The phone tab bar, like a banking app. Hidden on wide screens, where the header has the links. */
export function TabBar() {
  const watching = useAlerts().filter((a) => a.level !== 'tip').length
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground', isActive && 'text-primary')}
          >
            <n.icon className="size-5" />
            {n.label}
            {n.alerts && !!watching && <span className="absolute right-[30%] top-1.5 size-2 rounded-full bg-amber-500" aria-label={`${watching} to watch`} />}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
