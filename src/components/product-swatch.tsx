import { PRODUCT_BY_ID } from '@shared/catalog.ts'
import type { Category, ShelfItem } from '@shared/types.ts'
import { cn } from '@/lib/utils'

// A drawn stand-in for product photography: a bottle or jar on the product's own colors.

const SHAPE: Record<Category, 'pump' | 'dropper' | 'jar' | 'tube'> = {
  cleanser: 'pump',
  toner: 'pump',
  serum: 'dropper',
  treatment: 'dropper',
  eye: 'dropper',
  moisturizer: 'jar',
  mask: 'jar',
  sunscreen: 'tube',
}

/** Soft colors from the name, for products momo does not know. */
function hashedSwatch(key: string): [string, string] {
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360
  return [`oklch(0.95 0.03 ${h})`, `oklch(0.84 0.07 ${(h + 25) % 360})`]
}

type SwatchItem = Pick<ShelfItem, 'brand' | 'name' | 'category' | 'productId'>

export function ProductSwatch({ item, className, size = 'md' }: { item: SwatchItem; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [a, b] = (item.productId && PRODUCT_BY_ID.get(item.productId)?.swatch) || hashedSwatch(item.name)
  const shape = SHAPE[item.category]
  const scale = { sm: 'scale-50', md: 'scale-90', lg: 'scale-125' }[size]
  return (
    <div
      className={cn('relative flex items-end justify-center overflow-hidden rounded-xl', className)}
      style={{ background: `radial-gradient(120% 90% at 30% 10%, ${a} 0%, ${b} 100%)` }}
      aria-hidden
    >
      <div className={cn('mb-[12%] flex origin-bottom flex-col items-center', scale)}>
        {shape === 'dropper' && (
          <>
            <div className="h-6 w-4 rounded-t-full bg-neutral-800/80" />
            <div className="h-2 w-6 rounded-sm bg-neutral-800/70" />
            <div className="h-16 w-12 rounded-b-lg rounded-t-md bg-white/70 shadow-sm ring-1 ring-black/5" />
          </>
        )}
        {shape === 'pump' && (
          <>
            <div className="ml-4 h-2 w-6 rounded-sm bg-neutral-700/70" />
            <div className="h-5 w-2 bg-neutral-700/70" />
            <div className="h-3 w-8 rounded-t-md bg-neutral-700/60" />
            <div className="h-20 w-14 rounded-b-xl rounded-t-sm bg-white/75 shadow-sm ring-1 ring-black/5" />
          </>
        )}
        {shape === 'jar' && (
          <>
            <div className="h-4 w-20 rounded-t-md bg-neutral-700/60" />
            <div className="h-11 w-20 rounded-b-xl bg-white/75 shadow-sm ring-1 ring-black/5" />
          </>
        )}
        {shape === 'tube' && (
          <>
            <div className="h-3 w-10 rounded-sm bg-white/60" style={{ clipPath: 'polygon(0 0,100% 0,90% 100%,10% 100%)' }} />
            <div className="h-20 w-11 rounded-t-sm rounded-b-lg bg-white/75 shadow-sm ring-1 ring-black/5" />
            <div className="h-4 w-8 rounded-b-md bg-neutral-700/60" />
          </>
        )}
      </div>
      {size !== 'sm' && item.brand && (
        <span className="absolute left-3 top-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-black/45">
          {item.brand}
        </span>
      )}
    </div>
  )
}
