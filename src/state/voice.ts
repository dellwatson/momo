import { canListen, listen, speak, stopSpeaking, type Listening } from '@/lib/speech'
import { createStore, useStore } from '@/lib/store'
import { answerSpoken, currentQuestion, momoStore, wake } from '@/state/momo'

// The hands-free voice loop, outside React so that async steps always read the
// latest state: momo says each new message, then listens for one answer, then
// says what comes back. A silent turn ends the loop until the user taps the mic.

export type Phase = 'idle' | 'speaking' | 'listening'

export const voiceStore = createStore<{ phase: Phase; partial: string; caption: string; error?: string; locked: boolean }>(null, { phase: 'idle', partial: '', caption: '', locked: false })

/** With the mic locked open, momo stops listening after this long without hearing anything. */
const LOCK_IDLE_MS = 5 * 60 * 1000
let heardAt = 0
const ui = voiceStore.set

/** Message ids momo already said out loud in this visit. */
const spoken = new Set<string>()

let active = false
let since = ''
let handsFree = true
let draining = false
let ear: Listening | undefined
/** The question the user just answered. If the chat model replied and it is still open, momo asks it again. */
let repeatKey: string | undefined
let unsubscribe: (() => void) | undefined

const momoMessages = () => momoStore.get().messages.filter((m) => m.role === 'momo')

/** Starts the loop. `from` is when the voice sheet opened, so older messages are not read out. */
export function startVoice(from: string) {
  active = true
  since = from
  handsFree = true
  ui({ phase: 'idle', partial: '', error: undefined })
  unsubscribe = momoStore.subscribe(() => {
    if (!momoStore.get().busy) void drain()
  })
  const before = momoMessages().length
  wake()
  // Nothing new (the question was asked earlier, in the chat): say the open question again.
  if (momoMessages().length === before) {
    const open = currentQuestion(momoStore.get())?.text
    if (open) void sayThenListen(open)
  } else void drain()
}

export function stopVoice() {
  active = false
  unsubscribe?.()
  ear?.stop()
  ear = undefined
  stopSpeaking()
  ui({ phase: 'idle', partial: '' })
}

async function drain() {
  if (draining || !active) return
  draining = true
  let said = false
  try {
    for (;;) {
      const next = momoMessages().find((m) => m.at >= since && !spoken.has(m.id))
      if (!next || !active) break
      spoken.add(next.id)
      said = true
      ui({ caption: next.text, phase: 'speaking' })
      await speak(next.text)
    }
  } finally {
    draining = false
  }
  if (!active || !said) return
  ui({ phase: 'idle' })
  const open = currentQuestion(momoStore.get())
  if (repeatKey && open?.key === repeatKey && !momoStore.get().busy) {
    repeatKey = undefined
    return void sayThenListen(open.text)
  }
  repeatKey = undefined
  if (handsFree && !momoStore.get().busy) void listenOnce()
}

async function sayThenListen(line: string) {
  ui({ caption: line, phase: 'speaking' })
  await speak(line)
  if (!active) return
  ui({ phase: 'idle' })
  if (handsFree) void listenOnce()
}

async function listenOnce() {
  if (!canListen() || ear || !active) return
  ui({ phase: 'listening', partial: '', error: undefined })
  const l = listen((partial) => ui({ partial }))
  ear = l
  try {
    const said = await l.result
    ear = undefined
    if (!active) return
    ui({ phase: 'idle', partial: '' })
    if (!said) {
      // Locked: listen again, until LOCK_IDLE_MS of silence.
      if (voiceStore.get().locked && Date.now() - heardAt < LOCK_IDLE_MS) return void listenOnce()
      if (voiceStore.get().locked) ui({ locked: false })
      handsFree = false
      return
    }
    heardAt = Date.now()
    handsFree = true
    const before = momoStore.get().messages.length
    repeatKey = currentQuestion(momoStore.get())?.key
    await answerSpoken(said)
    // The answer added only the user's words (for example an unclear word): ask the question again.
    const after = momoStore.get()
    if (active && after.messages.length === before + 1 && after.messages.at(-1)?.role === 'user' && !after.busy) {
      const open = currentQuestion(after)?.text
      repeatKey = undefined
      if (open) await sayThenListen(`Sorry, I didn't catch that. ${open}`)
    }
  } catch (e) {
    ear = undefined
    ui({ phase: 'idle', error: (e as Error).message })
  }
}

/** The mic button: stop listening, skip what momo is saying, or start listening. */
export function tapMic() {
  const { phase } = voiceStore.get()
  if (phase === 'listening') {
    // Stopping by hand also unlocks, or the lock would open the mic again at once.
    ui({ locked: false })
    return ear?.stop()
  }
  if (phase === 'speaking') return stopSpeaking()
  handsFree = true
  void listenOnce()
}

/** Keeps the mic open between turns, like a phone call. Tapping it again closes it. */
export function setLocked(on: boolean) {
  ui({ locked: on })
  heardAt = Date.now()
  if (on && active && voiceStore.get().phase === 'idle') {
    handsFree = true
    void listenOnce()
  }
}

/** Typing in the voice sheet: stop the hands-free loop so momo does not talk over the keyboard. */
export function pauseHandsFree() {
  handsFree = false
}

export const useVoice = <T,>(sel: (s: ReturnType<typeof voiceStore.get>) => T) => useStore(voiceStore, sel)
