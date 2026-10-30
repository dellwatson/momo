import { useState } from 'react'
import { TalkPanel } from '@/components/talk'
import { useStore } from '@/lib/store'
import { uiStore } from '@/state/momo'

// The home screen is momo: a large 3D momo you talk to. History, typing, and
// the camera are buttons under it. Progress lives on Profile, products on
// Shelf, and what others love on Explore.

/** As large as the screen allows, and leaves room for the words and buttons under it. */
const stageSize = () => Math.round(Math.max(180, Math.min(340, window.innerWidth - 64, window.innerHeight * 0.32)))

export function HomePage() {
  const covered = useStore(uiStore, (u) => !!u.sheet)
  const [size] = useState(stageSize)

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem-4.5rem)] max-w-xl flex-col px-4 pb-[4.75rem] pt-2 md:min-h-[calc(100svh-3.5rem)] md:pb-4">
      <TalkPanel size={size} paused={covered} className="flex-1" />
    </div>
  )
}
