import type { Mood } from '@shared/types.ts'
import { onVoiceBeat } from '@/lib/speech'

// The one contract every momo renderer follows: the flat SVG, the 3D model, or
// a rigged model from an artist later. Each renderer reads the same inputs, so
// momo behaves the same way whatever it looks like.
//
// - phase and mood: set by the app.
// - mouthOpen(): read once per frame, 0 (closed) to 1 (wide open).
// - gestures: one-shot moves that any part of the app can ask for.

export type MascotPhase = 'idle' | 'listening' | 'thinking' | 'speaking'
export type Gesture = 'hop' | 'wiggle' | 'wave' | 'squish' | 'nod' | 'droop' | 'perk'

export interface MascotInput {
  mood: Mood
  phase: MascotPhase
}

export interface MascotRenderer {
  set(input: MascotInput): void
  play(g: Gesture): void
  pause(on: boolean): void
  dispose(): void
}

const gestureFns = new Set<(g: Gesture) => void>()
/** Asks every momo on screen to do a move. */
export function playGesture(g: Gesture) {
  gestureFns.forEach((fn) => fn(g))
}
export function onGesture(fn: (g: Gesture) => void): () => void {
  gestureFns.add(fn)
  return () => gestureFns.delete(fn)
}

// The browser voice gives no audio to measure, only "a word starts here" events.
// Each word opens and closes the mouth once per syllable. Engines that send no
// word events get a steady talking rhythm instead.
let talking = false
let wordAt = -1
let wordLen = 0
const now = () => performance.now() / 1000

onVoiceBeat((b) => {
  if (b.kind === 'start') {
    talking = true
    wordAt = -1
  } else if (b.kind === 'end') talking = false
  else {
    talking = true
    wordAt = now()
    wordLen = b.length
  }
})

/** True while the voice is speaking. */
export const isTalking = () => talking

export function mouthOpen(t = now()): number {
  if (!talking) return 0
  const since = t - wordAt
  if (wordAt >= 0 && since < 0.9) {
    const syllables = Math.max(1, Math.round(wordLen / 3))
    const dur = Math.max(0.16, wordLen * 0.07)
    if (since > dur) return 0
    return Math.abs(Math.sin((Math.PI * syllables * since) / dur)) * (wordLen > 6 ? 1 : 0.8)
  }
  // No word events: two mixed beats with a short pause about every 1.7 s.
  const pause = (t % 1.7) > 1.45 ? 0 : 1
  return pause * Math.min(1, Math.max(0, 0.3 + 0.4 * Math.sin(t * 11) + 0.35 * Math.sin(t * 17.3 + 1)))
}
