import { describe, it, expect, vi } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import {
  normalizeAngle,
  distance2D,
  computeTargetGrayBone,
  findClosestRigBone,
  buildMotionSketchKeyframes,
  applySketchToComposite,
  type MotionSketchState
} from './workshopMotionSketch'

describe('workshopMotionSketch', () => {
  it('normalizes angles within [-180, 180]', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(180)).toBe(-180)
    expect(normalizeAngle(270)).toBe(-90)
    expect(normalizeAngle(-270)).toBe(90)
    expect(normalizeAngle(360)).toBe(0)
  })

  it('computes Euclidean distance in 2D space accurately', () => {
    expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(distance2D({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0)
  })

  it('computes target gray bone matching red bone length', () => {
    const root = { x: 0, y: 0 }
    const redLength = 100
    const strokeEnd = { x: 150, y: 0 } // Ngang sang phải (0 độ)
    const gray = computeTargetGrayBone(root, redLength, strokeEnd)

    expect(gray.root).toEqual(root)
    expect(gray.length).toBe(100)
    expect(gray.angle).toBeCloseTo(0)
    expect(gray.tip.x).toBeCloseTo(100)
    expect(gray.tip.y).toBeCloseTo(0)
  })

  it('finds closest bone in rig matching drawn red line', () => {
    const rig: LayerRig = {
      bones: [
        { id: 'bone-torso', name: 'Thân', x: 0, y: -50, length: 100, angle: -90 },
        { id: 'bone-leg-r', name: 'Chân phải', x: 20, y: 50, length: 120, angle: 90 }
      ],
      tracks: {},
      duration: 2.0,
      loop: false
    }

    // Vẽ dọc theo chân phải (x: 20, y từ 50 xuống 170)
    const match = findClosestRigBone(rig, { x: 20, y: 50 }, { x: 20, y: 170 })
    expect(match).not.toBeNull()
    expect(match?.bone.id).toBe('bone-leg-r')
    expect(match?.bone.name).toBe('Chân phải')
  })

  it('generates smooth rotation keyframes from blue motion stroke', () => {
    const rig: LayerRig = {
      bones: [{ id: 'b1', name: 'Xương', x: 0, y: 0, length: 100, angle: 0 }],
      tracks: { b1: [{ time: 0, rotation: 0, easing: 'smooth' }] },
      duration: 3.0,
      loop: false
    }

    const keys = buildMotionSketchKeyframes(
      rig,
      'b1',
      0.5, // startTime
      0.6, // duration
      0,   // redAngle (0 deg)
      [{ x: 100, y: 0 }, { x: 70, y: 70 }, { x: 0, y: 100 }], // blueStroke
      90,  // grayAngle (90 deg)
      false // loopBack
    )

    expect(keys.length).toBeGreaterThanOrEqual(2)
    expect(keys[0].time).toBe(0.5)
    expect(keys[0].rotation).toBeCloseTo(0)
    expect(keys[keys.length - 1].time).toBe(1.1)
    expect(keys[keys.length - 1].rotation).toBeCloseTo(90)
  })

  it('generates yo-yo loop-back keyframe when requested', () => {
    const rig: LayerRig = {
      bones: [{ id: 'b1', name: 'Xương', x: 0, y: 0, length: 100, angle: 0 }],
      tracks: {},
      duration: 3.0,
      loop: false
    }

    const keys = buildMotionSketchKeyframes(
      rig,
      'b1',
      0,
      0.5,
      0,
      [{ x: 100, y: 0 }, { x: 0, y: 100 }],
      90,
      true // loopBack
    )

    expect(keys[keys.length - 1].time).toBe(1.0) // 0 + 0.5 * 2
    expect(keys[keys.length - 1].rotation).toBeCloseTo(0) // Trở về góc gốc
  })

  it('applies sketch to composite setting keys, soft mesh binding, and plant spine', () => {
    const composite: LayerComposite = {
      id: 'comp-1',
      name: 'Test',
      width: 500,
      height: 500,
      assets: {},
      layers: [
        {
          id: 'layer-leg',
          name: 'Leg',
          asset: 'leg.png',
          x: 0,
          y: 0,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          boneId: 'bone-1',
          bindingMode: 'rigid',
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        }
      ],
      rig: {
        bones: [{ id: 'bone-1', name: 'Cẳng chân', x: 0, y: 0, length: 100, angle: 90 }],
        tracks: {},
        duration: 2.0,
        loop: false
      }
    }

    const sketch: MotionSketchState = {
      redBone: {
        root: { x: 0, y: 0 },
        tip: { x: 0, y: 100 },
        length: 100,
        angle: 90,
        matchedBoneId: 'bone-1',
        matchedBoneName: 'Cẳng chân'
      },
      blueStroke: [{ x: 0, y: 100 }, { x: 70, y: 70 }],
      grayBone: {
        root: { x: 0, y: 0 },
        tip: { x: 70, y: 70 },
        length: 100,
        angle: 45
      },
      deltaAngle: -45,
      duration: 0.5,
      enableMeshBend: true,
      loopBack: false
    }

    const runRigAction = vi.fn()
    const runPlantAction = vi.fn()

    applySketchToComposite(composite, sketch, 0.2, runRigAction, runPlantAction)

    // Kiểm tra set-key đã được gọi
    expect(runRigAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'set-key', boneId: 'bone-1' })
    )

    // Kiểm tra đã bind chế độ soft mesh cho layer
    expect(runRigAction).toHaveBeenCalledWith({
      action: 'bind',
      boneId: 'bone-1',
      layerIds: ['layer-leg'],
      mode: 'soft'
    })

    // Kiểm tra đã tạo xương thực vật uốn mềm theo nét vẽ
    expect(runPlantAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'add',
        spine: expect.objectContaining({
          id: 'motion-spine-bone-1',
          layerIds: ['layer-leg']
        })
      })
    )
  })
})
