import { useState } from 'react'
import { Play, X } from 'lucide-react'
import { useLocation } from 'react-router'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

// A "watch our pitch" chip, bottom-left, on every screen size. It opens the
// pitch video in a dialog. The video loads only when the dialog opens, so the
// chip costs nothing on page load. On phones it sits above the tab bar (the
// watch pill is on the right). The X shrinks the chip to a round play button;
// it never goes away, so the pitch can always be opened. On Chat it is hidden
// on phones, where the composer uses the bottom edge.

const VIDEO_ID = 'cEP2JCG20nw'
const DISMISS_KEY = 'momo.pitch.small'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function PitchVideo() {
  const [open, setOpen] = useState(false)
  const [small, setSmall] = useState(wasDismissed)
  const onChat = useLocation().pathname === '/chat'

  const shrink = () => {
    setSmall(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private mode: the chip is big again next visit. Fine.
    }
  }

  return (
    <>
      <div
        className={`fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-4 z-30 items-center gap-1 rounded-full border bg-background p-1 shadow-lg md:bottom-6 md:left-6 ${onChat ? 'hidden md:flex' : 'flex'}`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Watch our pitch"
          className="flex items-center gap-2 rounded-full text-sm font-medium transition-colors hover:bg-muted"
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Play className="size-3.5 fill-current" />
          </span>
          {!small && <span className="pr-1">Watch our pitch</span>}
        </button>
        {!small && (
          <button type="button" onClick={shrink} aria-label="Make the pitch chip small" className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-3.5" />
          </button>
        )}
      </div>
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
