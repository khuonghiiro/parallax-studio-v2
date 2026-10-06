import type { Vec3 } from '@shared/types'

/**
 * Maps local X coordinate (depth space) to SVG screen X pixel.
 */
export function localToScreenX(x: number, sizeW: number, pad: number, xHalf: number): number {
  return pad + ((x + xHalf) / (2 * xHalf)) * (sizeW - pad * 2)
}

/**
 * Maps local Z coordinate (depth space) to SVG screen Y pixel.
 */
export function localToScreenZ(z: number, sizeH: number, pad: number, zMin: number, zMax: number): number {
  const span = zMax - zMin || 1
  return pad + (1 - (z - zMin) / span) * (sizeH - pad * 2)
}

/**
 * Maps SVG screen X pixel back to local X coordinate (depth space).
 */
export function screenToLocalX(px: number, sizeW: number, pad: number, xHalf: number): number {
  const span = sizeW - pad * 2 || 1
  return -xHalf + ((px - pad) / span) * (2 * xHalf)
}

/**
 * Maps SVG screen Y pixel back to local Z coordinate (depth space).
 */
export function screenToLocalZ(py: number, sizeH: number, pad: number, zMin: number, zMax: number): number {
  const span = sizeH - pad * 2 || 1
  return zMin + (1 - (py - pad) / span) * (zMax - zMin)
}

/**
 * Computes new camera position and parallel target offset.
 * If shiftKey is true, locks movement to either purely horizontal (X) or purely depth (Z).
 */
export function computeTranslatedCamera(
  initCam: Vec3,
  initTarget: Vec3,
  deltaX: number,
  deltaZ: number,
  shiftKey = false
): { camPos: Vec3; target: Vec3 } {
  let dx = deltaX
  let dz = deltaZ
  if (shiftKey) {
    if (Math.abs(dx) > Math.abs(dz)) {
      dz = 0
    } else {
      dx = 0
    }
  }
  return {
    camPos: [Math.round(initCam[0] + dx), initCam[1], Math.round(initCam[2] + dz)],
    target: [Math.round(initTarget[0] + dx), initTarget[1], Math.round(initTarget[2] + dz)]
  }
}

/**
 * Rotates the camera's viewing angle around its position in the top-down (X-Z) plane
 * so that it aims toward `lookPoint` [x, z]. Preserves target distance and height Y.
 */
export function computeRotatedTarget(
  camPos: Vec3,
  initTarget: Vec3,
  lookPoint: [number, number]
): Vec3 {
  const initDx = initTarget[0] - camPos[0]
  const initDz = initTarget[2] - camPos[2]
  const dist = Math.hypot(initDx, initDz) || 1000
  const angle = Math.atan2(lookPoint[0] - camPos[0], lookPoint[1] - camPos[2])
  return [
    Math.round(camPos[0] + Math.sin(angle) * dist),
    initTarget[1],
    Math.round(camPos[2] + Math.cos(angle) * dist)
  ]
}

/**
 * Computes new layer position in top-down space (X and Z).
 * Preserves height Y.
 * If shiftKey is true, locks movement to either purely horizontal (X) or purely depth (Z).
 * If snapGrid > 0, rounds X and Z to multiples of snapGrid.
 */
export function computeTranslatedLayer(
  initPos: Vec3,
  deltaX: number,
  deltaZ: number,
  shiftKey = false,
  snapGrid = 0
): Vec3 {
  let dx = deltaX
  let dz = deltaZ
  if (shiftKey) {
    if (Math.abs(dx) > Math.abs(dz)) {
      dz = 0
    } else {
      dx = 0
    }
  }
  let targetX = initPos[0] + dx
  let targetZ = initPos[2] + dz
  if (snapGrid > 0) {
    targetX = Math.round(targetX / snapGrid) * snapGrid
    targetZ = Math.round(targetZ / snapGrid) * snapGrid
  }
  return [Math.round(targetX), initPos[1], Math.round(targetZ)]
}
