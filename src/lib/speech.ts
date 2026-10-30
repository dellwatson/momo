// momo's voice and ears, using the browser's own speech engines. This costs no
// API call. Chrome and Safari can listen; every modern browser can speak.
// To move to a server speech model later, keep these two functions and change
// what is inside them.

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => Recognition

const Ctor = (): RecognitionCtor | undefined => {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canListen = () => !!Ctor()
export const canSpeak = () => typeof speechSynthesis !== 'undefined'

const MUTE_KEY = 'momo.voice.muted'
export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}
export function setMuted(on: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0')
  } catch {
    // Not saved; it still applies to this visit.
  }
  if (on) stopSpeaking()
}

let voice: SpeechSynthesisVoice | null | undefined
function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice
  const all = speechSynthesis.getVoices()
  if (!all.length) return null // Voices load late in Chrome. Try again next time.
  const en = all.filter((v) => v.lang.startsWith('en'))
  const liked = ['Samantha', 'Ava', 'Google US English', 'Microsoft Aria', 'Karen', 'Moira']
  voice = liked.map((n) => en.find((v) => v.name.includes(n))).find(Boolean) ?? en.find((v) => v.localService) ?? en[0] ?? null
  return voice
}

/** What the mascot's mouth follows: start, each spoken word (when the engine reports words), and end. */
export type VoiceBeat = { kind: 'start' } | { kind: 'end' } | { kind: 'word'; length: number }
const beats = new Set<(b: VoiceBeat) => void>()
export function onVoiceBeat(fn: (b: VoiceBeat) => void): () => void {
  beats.add(fn)
  return () => beats.delete(fn)
}
const beat = (b: VoiceBeat) => beats.forEach((fn) => fn(b))

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel()
  beat({ kind: 'end' })
}

/** Says the text out loud. Resolves when momo stops talking, at once when muted. */
export function speak(text: string): Promise<void> {
  if (!canSpeak() || isMuted() || !text.trim()) return Promise.resolve()
  stopSpeaking()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice()
    if (v) u.voice = v
    u.lang = v?.lang ?? 'en-US'
    u.pitch = 1.15
    u.rate = 1.03
    let started = false
    let ended = false
    // Some engines never fire onend. Allow about 90 ms per character.
    const guard = setTimeout(() => done(), 1500 + text.length * 90)
    const done = () => {
      ended = true
      clearTimeout(guard)
      beat({ kind: 'end' })
      resolve()
    }
    const start = () => {
      if (started || ended) return
      started = true
      beat({ kind: 'start' })
    }
    u.onstart = start
    // Some engines speak but never fire onstart.
    setTimeout(() => speechSynthesis.speaking && start(), 400)
    u.onboundary = (e) => {
      if (e.name !== 'word') return
      const word = text.slice(e.charIndex).match(/^\S+/)?.[0] ?? ''
      beat({ kind: 'word', length: e.charLength || word.length || 4 })
    }
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
  })
}

export interface Listening {
  /** The final transcript. Empty when the user said nothing. */
  result: Promise<string>
  stop(): void
}

/** Listens for one answer. The browser ends it after a short silence. */
export function listen(onPartial?: (text: string) => void, lang = 'en-US'): Listening {
  const C = Ctor()
  if (!C) return { result: Promise.reject(new Error('This browser cannot listen. Try Chrome or Safari.')), stop() {} }
  stopSpeaking()
  const rec = new C()
  rec.lang = lang
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1
  let finalText = ''
  let partial = ''
  const result = new Promise<string>((resolve, reject) => {
    rec.onresult = (e) => {
      partial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else partial += r[0].transcript
      }
      onPartial?.((finalText + partial).trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      reject(new Error(e.error === 'not-allowed' ? 'Microphone access was blocked.' : `Listening failed: ${e.error}`))
    }
    rec.onend = () => resolve((finalText || partial).trim())
  })
  rec.start()
  return { result, stop: () => rec.stop() }
}
