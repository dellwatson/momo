import { useState } from 'react'
import { Play, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

// A small "watch our pitch" chip in the bottom-left corner on desktop. It opens
// the pitch video in a dialog. The video loads only when the dialog opens, so
// the chip costs nothing on page load. Phones have the tab bar there: no chip.

const VIDEO_ID = 'cEP2JCG20nw'
const DISMISS_KEY = 'momo.pitch.dismissed'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function PitchVideo() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(wasDismissed)

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private mode: the chip comes back next visit. Fine.
    }
  }

  return (
    <>
      {!hidden && (
        <div className="fixed bottom-6 left-6 z-30 hidden items-center gap-1 rounded-full border bg-background py-1 pl-1 pr-1.5 shadow-lg md:flex">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
              <Play className="size-3.5 fill-current" />
            </span>
            Watch our pitch
          </button>
          <button type="button" onClick={hide} aria-label="Hide the pitch chip" className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle>Check out our pitch</DialogTitle>
          <DialogDescription className="sr-only">The momo pitch video</DialogDescription>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
              title="momo pitch"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <a href={`https://youtu.be/${VIDEO_ID}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
            Open on YouTube
          </a>
        </DialogContent>
      </Dialog>
    </>
  )
}
