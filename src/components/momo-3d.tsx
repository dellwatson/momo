import { useEffect, useRef, useState } from 'react'
import type { Mood } from '@shared/types.ts'
import { Mascot } from '@/components/mascot'
import { cn } from '@/lib/utils'
import { furById } from '@/lib/momo3d/furs'
import { onGesture, type MascotRenderer } from '@/state/mascot'
import { useMomo } from '@/state/momo'
import { useVoice, voiceStore } from '@/state/voice'

// The 3D momo for the large spots (home, the voice sheet, the chat). Three.js
// loads only when one of these is on screen. The flat SVG shows until the model
// is ready, and stays when the browser has no WebGL 2.
// Small avatars stay flat: each 3D momo needs its own WebGL context.

export function Momo3D({
  mood = 'happy',
  size = 120,
  thinking,
  paused,
  fur: furId,
  className,
}: {
  mood?: Mood
  size?: number
  thinking?: boolean
  paused?: boolean
  /** A fur color to preview. Default: the one the user wears. */
  fur?: string
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const worn = useMomo((s) => s.account?.fur)
  const fur = furById(furId ?? worn)
  const [momo, setMomo] = useState<MascotRenderer>()
  const listening = useVoice((v) => v.phase === 'listening')

  useEffect(() => {
    let alive = true
    let r: MascotRenderer | undefined
    import('@/lib/momo3d/scene')
      .then(({ createMomo }) => {
        if (!alive || !host.current) return
        r = createMomo(host.current, { size, fur })
        setMomo(r)
      })
      .catch(() => {
        // No WebGL 2, or the chunk failed to load: the flat momo stays.
      })
    return () => {
      alive = false
      r?.dispose()
      setMomo(undefined)
    }
    // A new fur color rebuilds the model. fur is looked up by id, so the id is the dependency.
  }, [size, fur.id])

  useEffect(() => {
    momo?.set({ mood, phase: thinking ? 'thinking' : listening ? 'listening' : 'idle' })
  }, [momo, mood, thinking, listening])

  // Draw only while it can be seen.
  useEffect(() => {
    if (!momo || !host.current) return
    let onScreen = true
    const update = () => momo.pause(!!paused || !onScreen || document.hidden)
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      update()
    })
    io.observe(host.current)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [momo, paused])

  // Gestures from the app, and a small nod while the person is talking.
  useEffect(() => {
    if (!momo) return
    let nodAt = 0
    let heard = ''
    const offGesture = onGesture((g) => momo.play(g))
    const offVoice = voiceStore.subscribe(() => {
      const { partial } = voiceStore.get()
      if (partial && partial !== heard && performance.now() - nodAt > 900) {
        nodAt = performance.now()
        momo.play('nod')
      }
      heard = partial
    })
    return () => {
      offGesture()
      offVoice()
    }
  }, [momo])

  return (
    <div className={cn('relative inline-block', className)} style={{ width: size, height: size }}>
      <div ref={host} className="size-full" aria-hidden={!!momo} />
      {!momo && (
        <div className="absolute inset-0">
          <Mascot mood={mood} size={size} fur={fur} />
        </div>
      )}
      {momo && <span className="sr-only">momo, {mood}</span>}
      {thinking && (
        <span className="absolute -right-1 top-2 flex gap-1 rounded-full border bg-card px-2 py-1 shadow-sm">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </span>
      )}
    </div>
  )
}
