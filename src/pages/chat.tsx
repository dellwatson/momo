import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { FEELING_LABELS, type Mood } from '@shared/types.ts'
import type { Alert } from '@shared/watch.ts'
import { AlertCard } from '@/components/alert-card'
import { Chips } from '@/components/chips'
import { EvidenceChips } from '@/components/evidence'
import { TraceList } from '@/components/trace'
import { Mascot } from '@/components/mascot'
import { Momo3D } from '@/components/momo-3d'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dayOf, type Message } from '@/lib/memory'
import { cn } from '@/lib/utils'
import { sendText, useAlerts, useMomo, useQuestion, wake } from '@/state/momo'

const MOOD_LINE = {
  happy: 'Happy to see you.',
  calm: 'All calm here.',
  excited: 'So excited!',
  curious: 'Hmm, tell me more.',
  concerned: 'Something needs a look.',
} as const

function Bubble({ m, showAvatar, alert, mood }: { m: Message; showAvatar: boolean; alert?: Alert; mood: Mood }) {
  if (m.role === 'user')
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{m.text}</p>
      </div>
    )
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 shrink-0">{showAvatar && <Mascot mood={mood} size={32} />}</div>
      <div className="min-w-0 max-w-[85%] space-y-1">
        {alert ? (
          <AlertCard alert={alert} />
        ) : (
          <p className={cn('whitespace-pre-wrap rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2 text-sm', m.alertId && 'text-muted-foreground')}>
            {m.alertId ? `${m.text} (handled)` : m.text}
          </p>
        )}
        <EvidenceChips items={m.evidence} className="px-1" />
        <TraceList trace={m.trace} className="px-1" />
        {m.meta && <p className="px-1 text-[10px] text-muted-foreground/70">{m.meta}</p>}
      </div>
    </div>
  )
}

function TodayCard() {
  const s = useMomo((st) => st)
  const d = dayOf(s)
  const used = d.used?.map((id) => s.shelf.find((i) => i.id === id)?.name).filter(Boolean)
  return (
    <div className="rounded-2xl border bg-card p-4 text-sm">
      <p className="mb-2 font-medium">Today</p>
      {!d.score && !d.feelings ? (
        <p className="text-muted-foreground">Not checked in yet.</p>
      ) : (
        <div className="space-y-2">
          {d.score && <p>Skin feels {['', 'not great', 'okay', 'great'][d.score]}.</p>}
          {!!d.feelings?.length && (
            <div className="flex flex-wrap gap-1">
              {d.feelings.map((f) => (
                <Badge key={f} variant="secondary">
                  {FEELING_LABELS[f]}
                </Badge>
              ))}
            </div>
          )}
          {!!used?.length && <p className="text-muted-foreground">Used {used.join(', ')}</p>}
        </div>
      )}
    </div>
  )
}

export function ChatPage() {
  const messages = useMomo((s) => s.messages)
  const busy = useMomo((s) => s.busy)
  const mood = useMomo((s) => s.mood)
  const name = useMomo((s) => s.profile.name)
  const q = useQuestion()
  const alerts = useAlerts()
  const [text, setText] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  // Back to where the chat was opened from, or Home when it was opened directly.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  useEffect(() => {
    wake()
  }, [])
  useEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, busy, q?.key])

  const alertById = useMemo(() => new Map(alerts.map((a) => [a.id, a])), [alerts])
  const rows = useMemo(() => messages.map((m, i) => ({ m, showAvatar: m.role === 'momo' && messages[i + 1]?.role !== 'momo' })), [messages])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void sendText(text)
    setText('')
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-6">
      <aside className="hidden space-y-4 lg:block">
        <div className="flex flex-col items-center rounded-2xl border bg-gradient-to-b from-accent/60 to-card p-5 text-center">
          <Momo3D mood={mood} size={140} thinking={busy} />
          <p className="mt-2 font-heading text-xl font-medium">momo</p>
          <p className="text-sm text-muted-foreground">{MOOD_LINE[mood]}</p>
        </div>
        <TodayCard />
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Watching</p>
            <Link to="/shelf" className="text-xs text-primary hover:underline">
              Shelf
            </Link>
          </div>
          {alerts.length ? (
            <ul className="space-y-1.5">
              {alerts.slice(0, 4).map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', a.level === 'stop' ? 'bg-rose-500' : a.level === 'watch' ? 'bg-amber-500' : 'bg-sky-500')} />
                  <span className="leading-snug">{a.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nothing to worry about right now.</p>
          )}
        </div>
      </aside>

      <section className="flex h-[calc(100svh-5.5rem)] min-w-0 flex-col overflow-hidden rounded-2xl border bg-background lg:h-[calc(100svh-6.5rem)]">
        <div className="flex items-center gap-2 border-b bg-card/60 px-2 py-2 lg:hidden">
          <Button variant="ghost" size="icon-lg" className="rounded-full" onClick={back} aria-label="Back">
            <ArrowLeft />
          </Button>
          <Mascot mood={mood} size={40} thinking={busy} />
          <div className="text-sm">
            <p className="font-medium">momo</p>
            <p className="text-xs text-muted-foreground">{alerts.length ? `Watching ${alerts.length} thing${alerts.length > 1 ? 's' : ''}` : MOOD_LINE[mood]}</p>
          </div>
        </div>

        <div ref={box} className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
          {rows.map(({ m, showAvatar }) => (
            <Bubble key={m.id} m={m} showAvatar={showAvatar} mood={mood} alert={m.alertId ? alertById.get(m.alertId) : undefined} />
          ))}
          {busy && (
            <div className="flex items-end gap-2">
              <Mascot mood="curious" size={32} />
              <span className="rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2 text-sm text-muted-foreground">momo is thinking…</span>
            </div>
          )}
        </div>

        <div className="space-y-2.5 border-t bg-card/60 p-3">
          {q && !busy && <Chips key={q.key} q={q} />}
          <form onSubmit={submit} className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={q?.freeText ? (q.placeholder ?? 'Type here') : `Tell momo anything${name ? `, ${name}` : ''}…`}
              maxLength={500}
              disabled={busy}
              className="h-10 rounded-full bg-background px-4"
              aria-label="Message to momo"
            />
            <Button type="submit" size="icon-lg" className="size-10 rounded-full" disabled={busy || !text.trim()} aria-label="Send">
              <ArrowUp />
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
