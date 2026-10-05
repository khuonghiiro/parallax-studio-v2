// 16:9 canvas calibrated so screen (1920x1080) sits dead-center with 240px X and 135px Y parallax bleed.
export const PLATE_WIDTH = 2400
export const PLATE_HEIGHT = 1350

export function createPlateCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (typeof document === 'undefined') {
    const dummyCtx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_target, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} })
        }
        return () => {}
      }
    })
    const dummyCanvas = {
      width: PLATE_WIDTH,
      height: PLATE_HEIGHT,
      toBlob: (cb: (b: Blob | null) => void) => {
        cb(new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }))
      },
      getContext: () => dummyCtx
    } as unknown as HTMLCanvasElement
    return [dummyCanvas, dummyCtx]
  }
  const c = document.createElement('canvas')
  c.width = PLATE_WIDTH
  c.height = PLATE_HEIGHT
  return [c, c.getContext('2d')!]
}

export const W = PLATE_WIDTH
export const H = PLATE_HEIGHT
