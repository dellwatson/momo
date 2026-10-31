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

/**
 * A 3:4 portrait crop around the face oval, so the face fills about 70% of the
 * width. YouCam skin analysis needs the face wider than 60% of the image and a
 * short side of 480 px or more; a small crop is scaled up to reach 480.
 * `ovalW` is the oval width as a part of the visible preview width.
 */
export function faceToJpeg(v: HTMLVideoElement, view: { w: number; h: number }, ovalW: number, mirror: boolean): { dataUrl: string; canvas: HTMLCanvasElement } {
  const vw = v.videoWidth
  const vh = v.videoHeight
  // The preview uses object-cover, so it shows the centre of the frame.
  const k = Math.max(view.w / vw, view.h / vh)
  const visibleW = view.w / k
  const w = Math.min(vw, (visibleW * ovalW) / 0.7, (vh * 3) / 4)
  const h = (w * 4) / 3
  const sx = (vw - w) / 2
  const sy = (vh - h) / 2
  const scale = Math.max(480 / w, Math.min(1, MAX_SIDE / h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  if (mirror) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(v, sx, sy, w, h, 0, 0, canvas.width, canvas.height)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), canvas }
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
