import type { LayerBone } from '@shared/layerRig'

export function walkRoot(phase: number, unit: number) {
  return { rotation: 0, x: 2 * unit * Math.sin(phase), y: unit * (3 + 1.2 * Math.cos(phase * 2)) }
}

/** Ankle stays planted for 60% of the step. Swing stops smoothly at both contacts. */
export function walkFootLift(phase: number): number {
  const cycle = ((phase / (2 * Math.PI)) % 1 + 1) % 1
  return cycle <= 0.6 ? 0 : Math.sin(Math.PI * (cycle - 0.6) / 0.4) ** 2
}

/** Two-bone IK: solve the planted ankle after the body's weight shift. */
export function solveWalkLeg(thigh: LayerBone, shin: LayerBone, phase: number, offset: number, sign: number, unit: number) {
  const root = walkRoot(phase, unit)
  const upperLength = Math.hypot(shin.x - thigh.x, shin.y - thigh.y)
  const lowerLength = shin.length
  if (upperLength < 1 || lowerLength < 1) return { thigh: 0, shin: 0 }
  const shinAngle = shin.angle * Math.PI / 180
  const dx = shin.x + Math.cos(shinAngle) * lowerLength - thigh.x - root.x
  const dy = shin.y + Math.sin(shinAngle) * lowerLength - thigh.y - root.y
    - walkFootLift(phase + offset) * 12 * unit
  const distance = Math.max(Math.abs(upperLength - lowerLength) + 0.001,
    Math.min(upperLength + lowerLength - 0.001, Math.hypot(dx, dy)))
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))
  const opening = Math.acos(clamp((distance ** 2 + upperLength ** 2 - lowerLength ** 2) / (2 * distance * upperLength)))
  const upperAngle = Math.atan2(dy, dx) + sign * opening
  const bend = Math.PI - Math.acos(clamp((upperLength ** 2 + lowerLength ** 2 - distance ** 2) / (2 * upperLength * lowerLength)))
  const lowerAngle = upperAngle - sign * bend
  const restUpper = Math.atan2(shin.y - thigh.y, shin.x - thigh.x)
  const rotation = (upperAngle - restUpper) * 180 / Math.PI
  return { thigh: rotation, shin: lowerAngle * 180 / Math.PI - shin.angle - rotation }
}
