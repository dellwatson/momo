import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// A full-screen panel for the voice check-in and the camera flows, like a
// screen in a mobile app. Escape or the X closes it.

export function FullSheet({ title, onClose, children, className }: { title: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', key)
      document.body.style.overflow = overflow
    }
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <p className="font-heading text-lg font-medium">{title}</p>
        <Button variant="ghost" size="icon-lg" className="rounded-full" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
      <div className={cn('mx-auto w-full max-w-xl flex-1 overflow-y-auto px-4 py-5', className)}>{children}</div>
    </div>
  )
}
