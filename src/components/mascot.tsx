import type { Mood } from '@shared/types.ts'
import { FURS, type FurColor } from '@/lib/momo3d/furs'
import { cn } from '@/lib/utils'

// The flat momo: a blue fluff ball, for small avatars and for browsers without
// WebGL 2. The large spots use the 3D model in src/components/momo-3d.tsx.
// Eyes, brows and mouth change with mood. Blink and float are CSS animations in
// src/index.css (momo-blink, momo-float).

const EYES: Record<Mood, React.ReactNode> = {
  happy: (
    <>
      <path d="M42 62 q6 -7 12 0" />
      <path d="M66 62 q6 -7 12 0" />
    </>
  ),
  calm: (
    <>
      <path d="M42 61 q6 5 12 0" />
      <path d="M66 61 q6 5 12 0" />
    </>
  ),
  excited: (
    <g className="momo-blink">
      <circle cx="48" cy="60" r="5.5" fill="currentColor" stroke="none" />
      <circle cx="72" cy="60" r="5.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="58" r="1.8" fill="#fff" stroke="none" />
      <circle cx="74" cy="58" r="1.8" fill="#fff" stroke="none" />
    </g>
  ),
  curious: (
    <g className="momo-blink">
      <circle cx="48" cy="61" r="4.2" fill="currentColor" stroke="none" />
      <circle cx="72" cy="60" r="5" fill="currentColor" stroke="none" />
    </g>
  ),
  concerned: (
    <g className="momo-blink">
      <circle cx="48" cy="62" r="4.2" fill="currentColor" stroke="none" />
      <circle cx="72" cy="62" r="4.2" fill="currentColor" stroke="none" />
    </g>
  ),
}

const BROWS: Partial<Record<Mood, React.ReactNode>> = {
  curious: <path d="M66 49 q6 -5 12 -1" />,
  concerned: (
    <>
      <path d="M42 53 l11 -4" />
      <path d="M78 53 l-11 -4" />
    </>
  ),
}

const MOUTH: Record<Mood, React.ReactNode> = {
  happy: <path d="M53 74 q7 7 14 0" />,
  calm: <path d="M55 75 q5 3 10 0" />,
  excited: <path d="M52 72 q8 12 16 0 z" fill="#c2415b" />,
  curious: <circle cx="61" cy="76" r="3" />,
  concerned: <path d="M53 78 q3.5 -3 7 0 q3.5 3 7 0" />,
}

export function Mascot({ mood = 'happy', size = 120, thinking, fur = FURS[0], className }: { mood?: Mood; size?: number; thinking?: boolean; fur?: FurColor; className?: string }) {
  const grad = `momo-skin-${fur.id}`
  return (
    <div className={cn('relative inline-block', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className={cn('momo-float size-full text-[#4a2a2a]', mood === 'curious' && '-rotate-6')} role="img" aria-label={`momo, ${mood}`}>
        <defs>
          <radialGradient id={grad} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor={fur.legTip} />
            <stop offset="55%" stopColor={fur.tip} />
            <stop offset="100%" stopColor={fur.belly} />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="110" rx="30" ry="4" fill="#000" opacity="0.07" />
        {/* legs and arms */}
        <rect x="42" y="94" width="12" height="16" rx="6" fill={fur.legRoot} />
        <rect x="66" y="94" width="12" height="16" rx="6" fill={fur.legRoot} />
        <ellipse cx="16" cy="76" rx="9" ry="6" transform="rotate(-20 16 76)" fill={fur.legRoot} />
        <ellipse cx="104" cy="76" rx="9" ry="6" transform="rotate(20 104 76)" fill={fur.legRoot} />
        {/* body: a cloud with a tuft on top */}
        <path
          d="M60 22 C68 14 82 16 84 28 C98 32 106 48 103 64 C106 84 92 102 60 102 C28 102 14 84 17 64 C14 48 24 32 40 28 C44 22 52 20 60 22 Z"
          fill={`url(#${grad})`}
        />
        {/* cheeks */}
        <ellipse cx="36" cy="72" rx="7" ry="4.5" fill="#ff8a9b" opacity="0.55" />
        <ellipse cx="84" cy="72" rx="7" ry="4.5" fill="#ff8a9b" opacity="0.55" />
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {BROWS[mood]}
          {EYES[mood]}
          {MOUTH[mood]}
        </g>
      </svg>
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
