// Frame capture and resizing. Every photo momo keeps or sends is a JPEG of at
// most 768 px on the long side, so one vision call stays small.

export const MAX_SIDE = 768

export function toJpeg(source: CanvasImageSource, w: number, h: number, mirror = false, max = MAX_SIDE): { dataUrl: string; canvas: HTMLCanvasElement } {
  const k = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  const ctx = canvas.getContext('2d')!
  if (mirror) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), canvas }
}

export function fileToJpeg(file: File): Promise<{ dataUrl: string; canvas: HTMLCanvasElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(toJpeg(img, img.naturalWidth, img.naturalHeight))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This file is not an image momo can read.'))
    }
    img.src = url
  })
}
