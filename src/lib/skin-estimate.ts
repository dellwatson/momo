import type { Signs } from '@shared/types.ts'

// A rough, on-device reading of a selfie, used when no vision model is set.
// It looks only at skin-colored pixels in the middle of the photo. Lighting
// moves these numbers a lot, so momo calls it an estimate and only shows the
// signs it can measure.

export const ESTIMATED: (keyof Signs)[] = ['redness', 'shine', 'unevenness']

const scale = (x: number, lo: number, hi: number) => Math.max(0, Math.min(1, (x - lo) / (hi - lo)))

export function estimateSkin(canvas: HTMLCanvasElement): Signs | undefined {
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  const w = canvas.width
  const h = canvas.height
  // The face guide is an oval in the middle of the frame.
  const x0 = Math.round(w * 0.3)
  const y0 = Math.round(h * 0.25)
  const { data } = ctx.getImageData(x0, y0, Math.round(w * 0.4), Math.round(h * 0.5))
  let n = 0
  let red = 0
  let shiny = 0
  let lum = 0
  let lum2 = 0
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // A common skin-pixel rule for RGB.
    if (!(r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15)) continue
    n++
    red += (r - g) / (r + g + b)
    const l = 0.299 * r + 0.587 * g + 0.114 * b
    lum += l
    lum2 += l * l
    if (l > 215 && Math.max(r, g, b) - Math.min(r, g, b) < 40) shiny++
  }
  if (n < 200) return undefined
  const mean = lum / n
  const sd = Math.sqrt(Math.max(0, lum2 / n - mean * mean))
  return {
    redness: scale(red / n, 0.09, 0.22),
    dryness: 0,
    shine: scale(shiny / n, 0.01, 0.12),
    breakouts: 0,
    unevenness: scale(sd / mean, 0.08, 0.3),
  }
}
