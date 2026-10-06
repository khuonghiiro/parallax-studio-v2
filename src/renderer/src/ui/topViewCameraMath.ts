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

/* ==========================================================================
   Side View (Z - Y) Orthogonal Projection Math
   Horizontal Screen: Z (Depth away: left is near, right is far)
   Vertical Screen: Y (Height: top is up/sky, bottom is down/ground)
   ========================================================================== */

/**
 * Maps local Z coordinate (depth space) to Side View SVG screen X pixel.
 * Left edge (pad) is zMin (near/camera), right edge (sizeW - pad) is zMax (far/background).
 */
export function sideZToScreenX(z: number, sizeW: number, pad: number, zMin: number, zMax: number): number {
  const span = zMax - zMin || 1
  return pad + ((z - zMin) / span) * (sizeW - pad * 2)
}

/**
 * Maps Side View SVG screen X pixel back to local Z coordinate (depth space).
 */
export function screenXToSideZ(px: number, sizeW: number, pad: number, zMin: number, zMax: number): number {
  const span = sizeW - pad * 2 || 1
  return zMin + ((px - pad) / span) * (zMax - zMin)
}

/**
 * Maps local Y coordinate (depth space height) to Side View SVG screen Y pixel.
 * Top edge (pad) is +yHalf (sky/up), bottom edge (sizeH - pad) is -yHalf (ground/down).
 */
export function sideYToScreenY(y: number, sizeH: number, pad: number, yHalf: number): number {
  const span = 2 * yHalf || 1
  return pad + ((yHalf - y) / span) * (sizeH - pad * 2)
}

/**
 * Maps Side View SVG screen Y pixel back to local Y coordinate (depth space height).
 */
export function screenYToSideY(py: number, sizeH: number, pad: number, yHalf: number): number {
  const span = sizeH - pad * 2 || 1
  return yHalf - ((py - pad) / span) * (2 * yHalf)
}

/**
 * Computes new camera position and parallel target offset in Side View (Z and Y).
 * Preserves horizontal position X.
 * If shiftKey is true, locks movement to either purely depth (Z) or purely height (Y).
 */
export function computeTranslatedCameraSide(
  initCam: Vec3,
  initTarget: Vec3,
  deltaZ: number,
  deltaY: number,
  shiftKey = false
): { camPos: Vec3; target: Vec3 } {
  let dz = deltaZ
  let dy = deltaY
  if (shiftKey) {
    if (Math.abs(dz) > Math.abs(dy)) {
      dy = 0
    } else {
      dz = 0
    }
  }
  return {
    camPos: [initCam[0], Math.round(initCam[1] + dy), Math.round(initCam[2] + dz)],
    target: [initTarget[0], Math.round(initTarget[1] + dy), Math.round(initTarget[2] + dz)]
  }
}

/**
 * Rotates the camera's viewing angle around its position in the side (Z-Y) plane
 * so that it tilts toward `lookPoint` [z, y]. Preserves target distance in Z-Y plane and position X.
 */
export function computeRotatedTargetSide(
  camPos: Vec3,
  initTarget: Vec3,
  lookPoint: [number, number]
): Vec3 {
  const initDz = initTarget[2] - camPos[2]
  const initDy = initTarget[1] - camPos[1]
  const dist = Math.hypot(initDz, initDy) || 1000
  const angle = Math.atan2(lookPoint[1] - camPos[1], lookPoint[0] - camPos[2])
  return [
    initTarget[0],
    Math.round(camPos[1] + Math.sin(angle) * dist),
    Math.round(camPos[2] + Math.cos(angle) * dist)
  ]
}

/**
 * Computes new layer position in side-view space (Z and Y).
 * Preserves horizontal position X.
 * If shiftKey is true, locks movement to either purely depth (Z) or purely height (Y).
 * If snapGrid > 0, rounds Z and Y to multiples of snapGrid.
 */
export function computeTranslatedLayerSide(
  initPos: Vec3,
  deltaZ: number,
  deltaY: number,
  shiftKey = false,
  snapGrid = 0
): Vec3 {
  let dz = deltaZ
  let dy = deltaY
  if (shiftKey) {
    if (Math.abs(dz) > Math.abs(dy)) {
      dy = 0
    } else {
      dz = 0
    }
  }
  let targetZ = initPos[2] + dz
  let targetY = initPos[1] + dy
  if (snapGrid > 0) {
    targetZ = Math.round(targetZ / snapGrid) * snapGrid
    targetY = Math.round(targetY / snapGrid) * snapGrid
  }
  return [initPos[0], Math.round(targetY), Math.round(targetZ)]
}

