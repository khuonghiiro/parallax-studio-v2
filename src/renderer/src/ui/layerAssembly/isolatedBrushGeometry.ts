import type { BrushPoint } from './brushStroke'

export interface IsolatedTransform { zoom: number; pan: BrushPoint }
export interface ImageRect { left: number; top: number; width: number; height: number }

/** Shared by image layout, cursor size and pointer-to-pixel conversion. */
export function isolatedImageGeometry(rect: ImageRect, width: number, height: number, transform: IsolatedTransform) {
  const fit = Math.min(rect.width / width, rect.height / height)
  const scale = fit * transform.zoom
  return {
    fit, scale, width: width * scale, height: height * scale,
    centerX: rect.width / 2 + transform.pan.x,
    centerY: rect.height / 2 + transform.pan.y
  }
}

export function isolatedBrushPixel(point: BrushPoint, rect: ImageRect, width: number, height: number, transform: IsolatedTransform) {
  const g = isolatedImageGeometry(rect, width, height, transform)
  return { x: (point.x - rect.left - g.centerX) / g.scale + width / 2,
    y: (point.y - rect.top - g.centerY) / g.scale + height / 2 }
}
