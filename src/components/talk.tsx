import { useEffect, useRef, useState } from 'react'
import { Camera, Lock, LockOpen, MessageCircle, Mic, ScanLine, Smile, Sparkles, Square, Volume2, VolumeX } from 'lucide-react'
import { Link } from 'react-router'
import type { Evidence, TraceStep } from '@shared/types.ts'
import { Chips } from '@/components/chips'
import { EvidenceChips } from '@/components/evidence'
import { InfoTip } from '@/components/info-tip'
import { TraceList } from '@/components/trace'
import { FullSheet } from '@/components/full-sheet'
import { Momo3D } from '@/components/momo-3d'
import { Button } from '@/components/ui/button'
import { canListen, isMuted, setMuted } from '@/lib/speech'
import { cn } from '@/lib/utils'
import { closeSheet, lastMomo, openSheet, uiStore, useMomo, useQuestion, wake } from '@/state/momo'
import { setLocked, startVoice, stopVoice, tapMic, useVoice } from '@/state/voice'

// Talking with momo. The loop itself is in src/state/voice.ts. Spoken answers
// are matched to the check-in chips on the device; anything else goes to the
// chat model. The chips stay on screen for anyone who would rather tap.
//
// Home shows this panel under a large momo. There the voice loop starts on the
// first tap of the mic, not on page load, and it pauses while a camera sheet
// is open on top.

function CameraMenu() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent'
  return (
    <div ref={box} className="relative">
      <Button variant="outline" size="icon-lg" className="size-12 rounded-full" onClick={() => setOpen((o) => !o)} aria-label="Camera" aria-expanded={open}>
        <Camera />
      </Button>
      {open && (
        <div className="absolute bottom-14 right-0 z-10 w-60 rounded-2xl border bg-popover p-1.5 shadow-lg" role="menu">
          <button type="button" role="menuitem" className={item} onClick={() => (setOpen(false), openSheet('skin'))}>
            <Smile className="size-5 text-primary" />
            <span>
              <span className="block font-medium">Skin check</span>
              <span className="block text-xs text-muted-foreground">A selfie, compared with last time</span>
            </span>
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => (setOpen(false), openSheet('scan'))}>
            <ScanLine className="size-5 text-primary" />
            <span>
              <span className="block font-medium">Scan a product</span>
              <span className="block text-xs text-muted-foreground">Will it suit you?</span>
            </span>
          </button>
          <button type="button" role="menuitem" className={item} disabled>
            <Sparkles className="size-5 text-primary" />
            <span>
              <span className="block font-medium">momo in AR</span>
              <span className="block text-xs text-muted-foreground">Coming in the mobile app</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

/** Long replies are clamped on Home; the full text is in the chat. */
const LONG = 120

export function TalkPanel({ autoStart, size, paused, className }: { autoStart?: boolean; size: number; paused?: boolean; className?: string }) {
  const busy = useMomo((s) => s.busy)
  const mood = useMomo((s) => s.mood)
  const q = useQuestion()
  const phase = useVoice((v) => v.phase)
  const partial = useVoice((v) => v.partial)
  const caption = useVoice((v) => v.caption)
  const locked = useVoice((v) => v.locked)
  const said = useMomo(lastMomo)
  const error = useVoice((v) => v.error)
  const [muted, setMute] = useState(isMuted)
  const [on, setOn] = useState(!!autoStart)
  const since = useRef(uiStore.get().talkSince ?? new Date().toISOString())

  // Without the voice loop, momo still asks what is open, in writing.
  useEffect(() => {
    if (!autoStart) wake()
  }, [autoStart])

  useEffect(() => {
    if (!on || paused) return
    startVoice(since.current)
    return stopVoice
  }, [on, paused])

  const mic = () => (on ? tapMic() : setOn(true))
  const lock = () => {
    setOn(true)
    setLocked(!locked)
  }
  const line = (on && caption) || said?.text || q?.text || 'Hi! How is your skin today?'
  const long = line.length > LONG
  const stage = q && !busy && q.chips.length > 6 ? Math.round(size * 0.65) : size

  // A product question takes the agent several seconds: say what it is doing.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!busy) return setSlow(false)
    const t = setTimeout(() => setSlow(true), 2000)
    return () => clearTimeout(t)
  }, [busy])

  const status = busy
    ? slow
      ? 'Checking your history, the stores, and what people like you love…'
      : 'momo is thinking…'
    : phase === 'listening'
      ? locked
        ? 'Listening, mic stays open'
        : 'Listening…'
      : phase === 'speaking'
        ? 'Tap to skip'
        : canListen()
          ? 'Tap to talk'
          : 'Voice needs Chrome or Safari. Tap a chip or open the chat.'

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="relative">
          {/* Many chips need the room: momo shrinks with a CSS scale, which does not rebuild the 3D model. */}
          <div className="transition-[width,height] duration-300" style={{ width: stage, height: stage }}>
            <div
              className={cn('origin-top-left rounded-full transition-[transform,box-shadow] duration-300', phase === 'speaking' && 'shadow-[0_0_0_12px_var(--color-accent)]')}
              style={{ transform: `scale(${stage / size})` }}
            >
              <Momo3D mood={mood} size={size} thinking={busy} paused={paused} />
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-2 rounded-full bg-background/80 backdrop-blur"
            onClick={() => {
              setMuted(!muted)
              setMute(!muted)
            }}
            aria-label={muted ? 'Turn momo’s voice on' : 'Mute momo'}
            aria-pressed={!muted}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </div>
        <p className={cn('max-w-md font-heading leading-snug', long ? 'line-clamp-3 text-xl' : 'text-2xl')} aria-live="polite">
          {line}
        </p>
        {line === said?.text && <Sources evidence={said.evidence} trace={said.trace} more={long} />}
        <p className={cn('min-h-6 max-w-md text-base text-muted-foreground', partial && 'italic text-foreground')}>{partial ? `“${partial}”` : ''}</p>
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </div>

      <div className="space-y-3 pb-2">
        {q && !busy && <Chips key={q.key} q={q} className="justify-center" />}
        <div className="flex items-center justify-center gap-5">
          <Button variant="outline" size="icon-lg" className="size-12 rounded-full" render={<Link to="/chat" />} nativeButton={false} aria-label="Chat and history">
            <MessageCircle />
          </Button>
          <button
            type="button"
            onClick={mic}
            disabled={busy || (!canListen() && phase !== 'speaking')}
            aria-label={phase === 'listening' ? 'Stop listening' : 'Talk to momo'}
            className={cn(
              'relative flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40',
              phase === 'listening' && 'bg-rose-500',
            )}
          >
            {phase === 'listening' && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/50" />}
            {phase === 'listening' ? <Square className="relative size-7" /> : <Mic className="relative size-8" />}
            {locked && (
              <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border-2 border-background bg-foreground text-background">
                <Lock className="size-3" />
              </span>
            )}
          </button>
          <CameraMenu />
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>{status}</span>
          {canListen() && (
            <button
              type="button"
              onClick={lock}
              aria-pressed={locked}
              className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5', locked ? 'border-foreground bg-foreground text-background' : 'hover:text-foreground')}
            >
              {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
              Keep mic open
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** One small line under momo's words: what it checked and where it comes from, in a popover. */
function Sources({ evidence, trace, more }: { evidence?: Evidence[]; trace?: TraceStep[]; more?: boolean }) {
  const n = trace?.length || evidence?.length || 0
  if (!n && !more) return null
  return (
    <div className="-mt-1 flex items-center gap-3 text-xs text-muted-foreground">
      {!!n && (
        <span className="inline-flex items-center gap-1">
          {trace?.length ? `momo checked ${n} thing${n > 1 ? 's' : ''}` : `Based on ${n} source${n > 1 ? 's' : ''}`}
          <InfoTip label="Where this comes from">
            <EvidenceChips items={evidence} />
            <TraceList trace={trace} className="text-xs" />
          </InfoTip>
        </span>
      )}
      {more && (
        <Link to="/chat" className="font-medium text-primary hover:underline">
          Read all in chat
        </Link>
      )}
    </div>
  )
}

/** The voice check-in as a full-screen sheet, for flows that open it from another page. */
export function TalkSheet() {
  return (
    <FullSheet title="Talk with momo" onClose={closeSheet} className="flex flex-col">
      <TalkPanel autoStart size={200} className="flex-1" />
    </FullSheet>
  )
}
