import * as THREE from 'three'
import type { Vec3 } from '@shared/types'
import { composeDepthMatrix, depthToThree, threeToDepth } from '../../engine/spatial'

export const TYPE_COLORS: Record<string, string> = {
  image: '#8b7bff',
  text: '#0284c7',
  solid: '#f59e6b',
  particles: '#ffc24b'
}

export function getTopViewCorners(
  pos: Vec3,
  rot: Vec3,
  scale: Vec3,
  size: [number, number]
): { p0: Vec3; p1: Vec3; p2: Vec3; p3: Vec3; isTilted: boolean } {
  const [w, h] = size
  const halfW = w / 2
  const halfH = h / 2
  const m = composeDepthMatrix(pos, rot, scale)
  const v = new THREE.Vector3()
  const p0 = threeToDepth(v.set(-halfW, -halfH, 0).applyMatrix4(m))
  const p1 = threeToDepth(v.set(halfW, -halfH, 0).applyMatrix4(m))
  const p2 = threeToDepth(v.set(halfW, halfH, 0).applyMatrix4(m))
  const p3 = threeToDepth(v.set(-halfW, halfH, 0).applyMatrix4(m))
  const isTilted = Math.abs(p0[2] - p3[2]) > 10
  return { p0, p1, p2, p3, isTilted }
}
