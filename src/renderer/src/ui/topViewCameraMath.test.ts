import { describe, expect, it } from 'vitest'
import {
  computeRotatedTarget,
  computeTranslatedCamera,
  localToScreenX,
  localToScreenZ,
  screenToLocalX,
  screenToLocalZ
} from './topViewCameraMath'

describe('topViewCameraMath', () => {
  it('converts X coordinate to screen and back accurately', () => {
    const sizeW = 300
    const pad = 14
    const xHalf = 1920 * 1.3
    const testValues = [0, 500, -800, xHalf, -xHalf]

    for (const x of testValues) {
      const px = localToScreenX(x, sizeW, pad, xHalf)
      const reverted = screenToLocalX(px, sizeW, pad, xHalf)
      expect(Math.abs(reverted - x)).toBeLessThan(1e-4)
    }
  })

  it('converts Z coordinate to screen and back accurately', () => {
    const sizeH = 240
    const pad = 14
    const zMin = -2000
    const zMax = 1000
    const testValues = [0, -1500, 500, zMin, zMax]

    for (const z of testValues) {
      const py = localToScreenZ(z, sizeH, pad, zMin, zMax)
      const reverted = screenToLocalZ(py, sizeH, pad, zMin, zMax)
      expect(Math.abs(reverted - z)).toBeLessThan(1e-4)
    }
  })

  it('translates camera position and target in parallel', () => {
    const initCam: [number, number, number] = [0, 10, -1400]
    const initTarget: [number, number, number] = [0, 10, 0]

    const result = computeTranslatedCamera(initCam, initTarget, 100, 200, false)
    expect(result.camPos).toEqual([100, 10, -1200])
    expect(result.target).toEqual([100, 10, 200])
  })

  it('locks movement to dominant axis when shift is held', () => {
    const initCam: [number, number, number] = [0, 0, -1000]
    const initTarget: [number, number, number] = [0, 0, 0]

    // Dominant X
    const resX = computeTranslatedCamera(initCam, initTarget, 300, 50, true)
    expect(resX.camPos[0]).toBe(300)
    expect(resX.camPos[2]).toBe(-1000)

    // Dominant Z
    const resZ = computeTranslatedCamera(initCam, initTarget, 40, 250, true)
    expect(resZ.camPos[0]).toBe(0)
    expect(resZ.camPos[2]).toBe(-750)
  })

  it('rotates camera target around camera position towards look point', () => {
    const camPos: [number, number, number] = [0, 0, 0]
    const initTarget: [number, number, number] = [0, 0, 1000] // looking +Z (dist = 1000)

    // Look to the right (+X)
    const right = computeRotatedTarget(camPos, initTarget, [500, 0])
    expect(right[0]).toBe(1000)
    expect(right[2]).toBe(0)

    // Look to the left (-X)
    const left = computeRotatedTarget(camPos, initTarget, [-500, 0])
    expect(left[0]).toBe(-1000)
    expect(left[2]).toBe(0)

    // Look forward (+Z)
    const forward = computeRotatedTarget(camPos, initTarget, [0, 800])
    expect(forward[0]).toBe(0)
    expect(forward[2]).toBe(1000)
  })
})
