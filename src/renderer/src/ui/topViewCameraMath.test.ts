import { describe, expect, it } from 'vitest'
import {
  computeRotatedTarget,
  computeRotatedTargetSide,
  computeTranslatedCamera,
  computeTranslatedCameraSide,
  computeTranslatedLayer,
  computeTranslatedLayerSide,
  localToScreenX,
  localToScreenZ,
  screenToLocalX,
  screenToLocalZ,
  screenXToSideZ,
  screenYToSideY,
  sideYToScreenY,
  sideZToScreenX
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

  it('translates layer X and Z position while preserving height Y', () => {
    const initPos: [number, number, number] = [100, 50, 400]
    const translated = computeTranslatedLayer(initPos, -30, 80, false, 0)
    expect(translated).toEqual([70, 50, 480])
  })

  it('locks layer translation to single axis when shift is held', () => {
    const initPos: [number, number, number] = [0, 20, 500]
    // Dominant X
    const resX = computeTranslatedLayer(initPos, 200, 40, true, 0)
    expect(resX).toEqual([200, 20, 500])

    // Dominant Z
    const resZ = computeTranslatedLayer(initPos, 30, 180, true, 0)
    expect(resZ).toEqual([0, 20, 680])
  })

  it('snaps layer translation to grid when snapGrid > 0', () => {
    const initPos: [number, number, number] = [0, 0, 0]
    const snapped = computeTranslatedLayer(initPos, 137, 264, false, 50)
    expect(snapped).toEqual([150, 0, 250])
  })

  describe('Side View Math (Z - Y)', () => {
    it('converts Side View Z (depth) to screen X and back accurately', () => {
      const sizeW = 400
      const pad = 16
      const zMin = -1500
      const zMax = 2500
      const testValues = [zMin, 0, 500, 1800, zMax]

      for (const z of testValues) {
        const px = sideZToScreenX(z, sizeW, pad, zMin, zMax)
        const reverted = screenXToSideZ(px, sizeW, pad, zMin, zMax)
        expect(Math.abs(reverted - z)).toBeLessThan(1e-4)
      }
    })

    it('converts Side View Y (height) to screen Y and back accurately', () => {
      const sizeH = 300
      const pad = 16
      const yHalf = 800
      const testValues = [yHalf, 0, -300, -yHalf, 400]

      for (const y of testValues) {
        const py = sideYToScreenY(y, sizeH, pad, yHalf)
        const reverted = screenYToSideY(py, sizeH, pad, yHalf)
        expect(Math.abs(reverted - y)).toBeLessThan(1e-4)
      }
    })

    it('translates camera position and target in Side View', () => {
      const initCam: [number, number, number] = [15, 50, -1000]
      const initTarget: [number, number, number] = [15, 0, 200]

      const res = computeTranslatedCameraSide(initCam, initTarget, 150, -30, false)
      expect(res.camPos).toEqual([15, 20, -850])
      expect(res.target).toEqual([15, -30, 350])
    })

    it('locks Side View camera translation to dominant axis on shift', () => {
      const initCam: [number, number, number] = [0, 0, 0]
      const initTarget: [number, number, number] = [0, 0, 500]

      // Dominant Z
      const resZ = computeTranslatedCameraSide(initCam, initTarget, 200, 30, true)
      expect(resZ.camPos).toEqual([0, 0, 200])

      // Dominant Y
      const resY = computeTranslatedCameraSide(initCam, initTarget, 40, 250, true)
      expect(resY.camPos).toEqual([0, 250, 0])
    })

    it('translates layer Z and Y in Side View while preserving X', () => {
      const initPos: [number, number, number] = [120, 50, 400]
      const res = computeTranslatedLayerSide(initPos, 80, -30, false, 0)
      expect(res).toEqual([120, 20, 480])
    })

    it('snaps layer translation in Side View when snapGrid > 0', () => {
      const initPos: [number, number, number] = [50, 12, 115]
      const snapped = computeTranslatedLayerSide(initPos, 42, 73, false, 50)
      // targetZ = 115 + 42 = 157 -> 150. targetY = 12 + 73 = 85 -> 100.
      expect(snapped).toEqual([50, 100, 150])
    })
  })
})

