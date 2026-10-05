import * as THREE from 'three'
import type { EditorViewKind } from '../../engine/EditorCamera'
import type { EvaluatedScene } from '../../engine/evaluateScene'
import type { Rect } from '../../engine/SceneRenderer'

export type Quality = 1 | 0.5

export interface Layout {
  dpr: number
  /** CSS px, relative to the canvas. */
  cam: Rect | null
  ed: Rect | null
}

export const EDITOR_KINDS: { id: EditorViewKind; label: string }[] = [
  { id: 'custom', label: 'Tự do (orbit)' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' }
]

export const CLEAR = '#090a10'

export function fitRect(area: Rect, aspect: number, pad: number): Rect {
  const W = Math.max(16, area.w - pad * 2)
  const H = Math.max(9, area.h - pad * 2)
  let w = W
  let h = W / aspect
  if (h > H) {
    h = H
    w = H * aspect
  }
  w = Math.floor(w)
  h = Math.floor(h)
  return { x: Math.round(area.x + (area.w - w) / 2), y: Math.round(area.y + (area.h - h) / 2), w, h }
}

export const toDevice = (r: Rect, dpr: number): Rect => ({
  x: Math.round(r.x * dpr),
  y: Math.round(r.y * dpr),
  w: Math.max(2, Math.round(r.w * dpr)),
  h: Math.max(2, Math.round(r.h * dpr))
})

export const inRect = (r: Rect | null, x: number, y: number): r is Rect =>
  !!r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h

export function worldBox(ev: EvaluatedScene): THREE.Box3 {
  const box = new THREE.Box3()
  for (const s of ev.shots) if (s.shot.visible) box.union(s.bounds)
  for (const l of ev.layers) if (!l.shot && l.active && l.layer.type !== 'particles') box.union(l.bounds)
  box.expandByPoint(new THREE.Vector3(ev.camera.position[0], ev.camera.position[1], -ev.camera.position[2]))
  return box
}
