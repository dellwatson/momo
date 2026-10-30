import { useEffect, useState } from 'react'
import { getPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils'

/** A skin photo from this device's IndexedDB. */
export function StoredPhoto({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let live = true
    getPhoto(id).then((p) => live && setSrc(p?.dataUrl), () => undefined)
    return () => {
      live = false
    }
  }, [id])
  return src ? <img src={src} alt={alt} className={cn('object-cover', className)} /> : <div className={cn('bg-muted', className)} aria-label={alt} />
}
