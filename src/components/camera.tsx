import { useEffect, useRef, useState } from 'react'
import { Camera as CameraIcon, ImageUp, SwitchCamera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fileToJpeg, toJpeg } from '@/lib/image'
import { cn } from '@/lib/utils'

// A live camera view with a guide shape. The video never leaves the device:
// only the one frame the user captures is kept or sent.

export interface Shot {
  dataUrl: string
  canvas: HTMLCanvasElement
}

export function Camera({
  facing,
  guide,
  hint,
  countdown = 0,
  onShot,
  className,
}: {
  facing: 'user' | 'environment'
  guide: 'face' | 'product'
  hint: string
  /** Seconds to count before the capture, so the user can hold still. */
  countdown?: number
  onShot: (shot: Shot) => void
  className?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState(facing)
  const [error, setError] = useState<string>()
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let stream: MediaStream | undefined
    let live = true
    setReady(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera. Upload a photo instead.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (!live) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const v = video.current
        if (v) {
          v.srcObject = s
          void v.play().then(() => setReady(true), () => setReady(true))
        }
      })
      .catch((e: Error) => setError(e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in the browser, or upload a photo.' : 'No camera found. Upload a photo instead.'))
    return () => {
      live = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [mode])

  const grab = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    onShot(toJpeg(v, v.videoWidth, v.videoHeight, mode === 'user'))
  }

  useEffect(() => {
    if (!count) return
    const t = setTimeout(() => {
      if (count === 1) grab()
      setCount(count - 1)
    }, 1000)
    return () => clearTimeout(t)
    // grab reads the current video element, so it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  const upload = async (f?: File) => {
    if (!f) return
    try {
      onShot(await fileToJpeg(f))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-neutral-900 sm:aspect-[4/3]">
        {!error && <video ref={video} playsInline muted className={cn('size-full object-cover', mode === 'user' && '-scale-x-100')} />}
        {error && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-neutral-200">{error}</p>}
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                'border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]',
                guide === 'face' ? 'h-[62%] w-[52%] rounded-[50%] sm:w-[36%]' : 'h-[58%] w-[46%] rounded-2xl sm:w-[30%]',
              )}
            />
          </div>
        )}
        {!!count && <span className="absolute inset-0 flex items-center justify-center font-heading text-7xl font-semibold text-white drop-shadow">{count}</span>}
        <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8 text-center text-sm text-white">{hint}</p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon-lg" className="size-12 rounded-full" onClick={() => file.current?.click()} aria-label="Upload a photo">
          <ImageUp />
        </Button>
        <Button
          size="lg"
          className="h-14 rounded-full px-8 text-base"
          disabled={!!error || !ready || !!count}
          onClick={() => (countdown ? setCount(countdown) : grab())}
        >
          <CameraIcon /> {countdown ? 'Ready' : 'Take photo'}
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          className="rounded-full"
          disabled={!!error}
          onClick={() => setMode((m) => (m === 'user' ? 'environment' : 'user'))}
          aria-label="Switch camera"
        >
          <SwitchCamera />
        </Button>
      </div>
      <input ref={file} type="file" accept="image/*" capture={mode} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
    </div>
  )
}
