import { describe, it, expect } from 'vitest'
import {
  computeDepthProfileZ,
  computeProceduralMotionOffset,
  createLuminanceSampler
} from './meshEffectsAE'

describe('meshEffectsAE', () => {
  describe('computeDepthProfileZ', () => {
    it('returns 0 for none profile or 0 intensity', () => {
      expect(
        computeDepthProfileZ({
          u: 0.5,
          v: 0.5,
          width: 200,
          height: 200,
          profile: 'none',
          intensity: 50
        })
      ).toBe(0)

      expect(
        computeDepthProfileZ({
          u: 0.5,
          v: 0.5,
          width: 200,
          height: 200,
          profile: 'sphere',
          intensity: 0
        })
      ).toBe(0)
    })

    it('computes spherical dome extrusion with peak at center', () => {
      const centerZ = computeDepthProfileZ({
        u: 0.5,
        v: 0.5,
        width: 100,
        height: 100,
        profile: 'sphere',
        intensity: 50
      })
      const edgeZ = computeDepthProfileZ({
        u: 0.0,
        v: 0.5,
        width: 100,
        height: 100,
        profile: 'sphere',
        intensity: 50
      })
      expect(centerZ).toBeGreaterThan(0)
      expect(edgeZ).toBe(0)
      expect(centerZ).toBeGreaterThan(edgeZ)
    })

    it('computes cylinder tunnel extrusion with peak at horizontal mid', () => {
      const midZ = computeDepthProfileZ({
        u: 0.5,
        v: 0.2,
        width: 100,
        height: 100,
        profile: 'cylinder',
        intensity: 100
      })
      const edgeZ = computeDepthProfileZ({
        u: 0.0,
        v: 0.2,
        width: 100,
        height: 100,
        profile: 'cylinder',
        intensity: 100
      })
      expect(midZ).toBeCloseTo(40, 1)
      expect(edgeZ).toBeCloseTo(0, 1)
    })

    it('computes slope extrusion ramp from bottom to top', () => {
      const bottomZ = computeDepthProfileZ({
        u: 0.5,
        v: 0.0,
        width: 100,
        height: 100,
        profile: 'slope',
        intensity: 100
      })
      const topZ = computeDepthProfileZ({
        u: 0.5,
        v: 1.0,
        width: 100,
        height: 100,
        profile: 'slope',
        intensity: 100
      })
      expect(bottomZ).toBeCloseTo(40, 1)
      expect(topZ).toBeCloseTo(0, 1)
    })

    it('computes luminance-based extrusion', () => {
      const sampler = (u: number, _v: number) => u // 0 at left, 1 at right
      const whiteZ = computeDepthProfileZ({
        u: 1.0,
        v: 0.5,
        width: 100,
        height: 100,
        profile: 'luminance',
        intensity: 100,
        luminanceSampler: sampler
      })
      const blackZ = computeDepthProfileZ({
        u: 0.0,
        v: 0.5,
        width: 100,
        height: 100,
        profile: 'luminance',
        intensity: 100,
        luminanceSampler: sampler
      })
      expect(whiteZ).toBeGreaterThan(0)
      expect(blackZ).toBeLessThan(0)
    })

    it('inverts depth when invert is true', () => {
      const normalZ = computeDepthProfileZ({
        u: 0.5,
        v: 0.5,
        width: 100,
        height: 100,
        profile: 'sphere',
        intensity: 50,
        invert: false
      })
      const invertedZ = computeDepthProfileZ({
        u: 0.5,
        v: 0.5,
        width: 100,
        height: 100,
        profile: 'sphere',
        intensity: 50,
        invert: true
      })
      expect(invertedZ).toBe(-normalZ)
    })
  })

  describe('computeProceduralMotionOffset', () => {
    it('returns [0,0,0] for motionType none or amplitude 0 or isPinned', () => {
      expect(
        computeProceduralMotionOffset({
          u: 0.5,
          v: 0.8,
          width: 100,
          height: 100,
          time: 1.5,
          motionType: 'none',
          amplitude: 50
        })
      ).toEqual([0, 0, 0])

      expect(
        computeProceduralMotionOffset({
          u: 0.5,
          v: 0.8,
          width: 100,
          height: 100,
          time: 1.5,
          motionType: 'wind',
          amplitude: 0
        })
      ).toEqual([0, 0, 0])

      expect(
        computeProceduralMotionOffset({
          u: 0.5,
          v: 0.8,
          width: 100,
          height: 100,
          time: 1.5,
          motionType: 'wind',
          amplitude: 50,
          isPinned: true
        })
      ).toEqual([0, 0, 0])
    })

    it('anchors bottom with zero movement at v=0 for wind sway', () => {
      const bottomOffset = computeProceduralMotionOffset({
        u: 0.5,
        v: 0.0,
        width: 100,
        height: 100,
        time: 1.0,
        motionType: 'wind',
        amplitude: 50,
        anchor: 'bottom'
      })
      const topOffset = computeProceduralMotionOffset({
        u: 0.5,
        v: 1.0,
        width: 100,
        height: 100,
        time: 1.0,
        motionType: 'wind',
        amplitude: 50,
        anchor: 'bottom'
      })
      expect(bottomOffset[0]).toBe(0)
      expect(bottomOffset[1]).toBe(0)
      expect(Math.abs(topOffset[0])).toBeGreaterThan(0)
    })

    it('respects direction filtering', () => {
      const horiz = computeProceduralMotionOffset({
        u: 0.5,
        v: 0.8,
        width: 100,
        height: 100,
        time: 1.0,
        motionType: 'wave',
        amplitude: 50,
        direction: 'horizontal'
      })
      expect(horiz[1]).toBe(0)
      expect(horiz[2]).toBe(0)

      const depth = computeProceduralMotionOffset({
        u: 0.5,
        v: 0.8,
        width: 100,
        height: 100,
        time: 1.0,
        motionType: 'wave',
        amplitude: 50,
        direction: 'depthZ'
      })
      expect(depth[0]).toBe(0)
      expect(depth[1]).toBe(0)
    })
  })
})
