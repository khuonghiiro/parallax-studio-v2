import { describe, expect, it } from 'vitest'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import {
  exportAnimationClipToJson,
  generateAiMotionPrompt,
  parseAnimationClipFromJson,
  extractJsonFromText
} from './workshopClipJson'
import { createHumanoidBones } from './workshopRigPresets'
import { applyRigAction } from './workshopRig'

describe('workshopClipJson', () => {
  const sampleBones: LayerBone[] = [
    { id: 'bone-pelvis', name: 'Hông (Root)', x: 0, y: 50, length: 80, angle: -90 },
    { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: 0, y: -30, length: 120, angle: -90 },
    { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: 80, y: -30, length: 100, angle: 80 }
  ]

  const sampleClip: AnimationClip = {
    id: 'clip-wave-1',
    name: 'Vẫy tay chào',
    duration: 1.5,
    loop: true,
    fps: 30,
    viewAngle: 'front',
    tracks: {
      'bone-arm-r': [
        { time: 0, rotation: 0, x: 0, y: 0, easing: 'smooth' },
        { time: 0.75, rotation: -35, x: 0, y: 0, easing: 'smooth' },
        { time: 1.5, rotation: 0, x: 0, y: 0, easing: 'smooth' }
      ]
    }
  }

  it('exports AnimationClip to JSON with bones biomechanical guide, rigConventions, meshDeformation, and wind', () => {
    const sampleComposite: LayerComposite = {
      id: 'comp-test',
      name: 'Nhân vật Test',
      category: 'characters',
      width: 600,
      height: 900,
      layers: [
        {
          id: 'layer-hair',
          name: 'Mái tóc',
          assetPath: '',
          x: 0,
          y: -200,
          z: 10,
          scale: 1,
          rotation: 0,
          opacity: 1,
          locked: false,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' },
          boneId: 'bone-torso'
        }
      ],
      plantSpines: [
        {
          id: 'spine-hair',
          name: 'Dây gió Tóc',
          layerIds: ['layer-hair'],
          amplitude: 16,
          speed: 1.4,
          stiffness: 0.3,
          flexibility: 0.5,
          turbulence: 0.35,
          phaseOffset: 0.2,
          points: [
            { x: 0, y: -240 },
            { x: 0, y: -150 }
          ]
        }
      ]
    }

    const jsonStr = exportAnimationClipToJson(sampleClip, sampleBones, true, {
      composite: sampleComposite,
      includeWind: true
    })
    expect(jsonStr).toContain('"format": "parallax-motion-v1"')
    expect(jsonStr).toContain('"name": "Vẫy tay chào"')
    expect(jsonStr).toContain('"bone-arm-r"')
    expect(jsonStr).toContain('"rigConventions"')
    expect(jsonStr).toContain('"meshDeformation"')
    expect(jsonStr).toContain('"groundContactImpact"')
    expect(jsonStr).toContain('"wind"')

    const parsed = JSON.parse(jsonStr)
    expect(parsed.duration).toBe(1.5)
    expect(parsed.bones.length).toBe(3)
    expect(parsed.bones[1].name).toBe('Thân / Ngực')
    expect(parsed.bones[2].directionGuide).toContain('GIƠ TAY PHẢI MỞ RA NGOÀI & LÊN CAO')
    expect(parsed.meshDeformation.enabled).toBe(true)
    expect(parsed.meshDeformation.boneEnvelopes.length).toBe(3)
    expect(parsed.meshDeformation.layerBindings.length).toBe(1)
    expect(parsed.wind.plantSpines.length).toBe(1)
    expect(parsed.wind.plantSpines[0].name).toBe('Dây gió Tóc')
  })

  it('generates rich AI motion prompt with bone biomechanical direction guide, mesh impact, and wind section', () => {
    const prompt = generateAiMotionPrompt(sampleClip, sampleBones, 'Nhân vật cúi chào trang trọng')
    expect(prompt).toContain('Parallax Studio')
    expect(prompt).toContain('Nhân vật cúi chào trang trọng')
    expect(prompt).toContain('bone-torso')
    expect(prompt).toContain('Thân / Ngực')
    expect(prompt).toContain('QUY TẮC KEYFRAME & GIẢI PHẪU 2.5D')
    expect(prompt).toContain('Biến dạng Lưới Mesh Chịu Tác Lực Tiếp Đất')
    expect(prompt).toContain('meshDeformation')
    expect(prompt).toContain('Hiệu ứng Gió uốn mềm ("wind")')
  })

  it('extracts JSON from markdown code block or surrounded text', () => {
    const md = 'Chào bạn! Đây là file JSON:\n```json\n{"name":"Test","tracks":{"bone-arm-r":[{"time":0,"rotation":10}]}}\n```\nChúc bạn thành công!'
    const extracted = extractJsonFromText(md)
    expect(extracted).toContain('"name":"Test"')
    expect(extracted).not.toContain('```')
  })

  it('parses valid JSON into AnimationClip', () => {
    const rawJson = JSON.stringify({
      format: 'parallax-motion-v1',
      name: 'Vỗ tay vui mừng',
      duration: 2.0,
      loop: true,
      fps: 30,
      tracks: {
        'bone-arm-r': [
          { time: 0, rotation: 0, easing: 'smooth' },
          { time: 1.0, rotation: -40, easing: 'ease-in-out' },
          { time: 2.0, rotation: 0, easing: 'smooth' }
        ]
      }
    })

    const res = parseAnimationClipFromJson(rawJson, sampleBones)
    expect(res.success).toBe(true)
    expect(res.clip).toBeDefined()
    expect(res.clip?.name).toBe('Vỗ tay vui mừng')
    expect(res.clip?.duration).toBe(2.0)
    expect(res.clip?.tracks['bone-arm-r'].length).toBe(3)
    expect(res.clip?.tracks['bone-arm-r'][1].rotation).toBe(-40)
  })

  it('auto-fixes broken AI biomechanics, generates ground-contact foot mesh impact, and renames "Động tác 6" on import', () => {
    const humanoidBones = createHumanoidBones()
    const brokenAiJson = JSON.stringify({
      format: 'parallax-motion-v1',
      name: 'Động tác 6',
      duration: 2.0,
      loop: true,
      fps: 30,
      tracks: {
        'bone-pelvis': [
          { time: 0.0, x: 0, y: 0, rotation: 0, easing: 'ease-in-out' },
          { time: 0.45, x: 0, y: 40, rotation: 0, easing: 'ease-in-out' },
          { time: 0.6, x: 0, y: -20, rotation: 0, easing: 'ease-out' },
          { time: 0.95, x: 0, y: -130, rotation: 0, easing: 'smooth' },
          { time: 1.3, x: 0, y: 20, rotation: 0, easing: 'ease-out' },
          { time: 1.4, x: 0, y: 45, rotation: 0, easing: 'ease-in-out' },
          { time: 1.7, x: 0, y: 8, rotation: 0, easing: 'ease-in-out' },
          { time: 2.0, x: 0, y: 0, rotation: 0, easing: 'ease-in-out' }
        ],
        'bone-arm-l': [
          { time: 0.0, rotation: 0, easing: 'ease-in-out' },
          { time: 0.45, rotation: 15, easing: 'ease-in-out' },
          { time: 0.95, rotation: -75, easing: 'smooth' },
          { time: 1.4, rotation: 18, easing: 'ease-in-out' },
          { time: 2.0, rotation: 0, easing: 'ease-in-out' }
        ],
        'bone-arm-r': [
          { time: 0.0, rotation: 0, easing: 'ease-in-out' },
          { time: 0.45, rotation: -15, easing: 'ease-in-out' },
          { time: 0.95, rotation: 75, easing: 'smooth' },
          { time: 1.4, rotation: -18, easing: 'ease-in-out' },
          { time: 2.0, rotation: 0, easing: 'ease-in-out' }
        ],
        'bone-thigh-l': [
          { time: 0.0, rotation: 0, easing: 'ease-in-out' },
          { time: 0.45, rotation: -25, easing: 'ease-in-out' },
          { time: 0.95, rotation: 8, easing: 'smooth' },
          { time: 1.4, rotation: -30, easing: 'ease-in-out' },
          { time: 2.0, rotation: 0, easing: 'ease-in-out' }
        ],
        'bone-shin-l': [
          { time: 0.0, rotation: 0, easing: 'ease-in-out' },
          { time: 0.45, rotation: 35, easing: 'ease-in-out' },
          { time: 0.95, rotation: -5, easing: 'smooth' },
          { time: 1.4, rotation: 42, easing: 'ease-in-out' },
          { time: 2.0, rotation: 0, easing: 'ease-in-out' }
        ],
        'bone-thigh-r': [
          { time: 0.0, rotation: 0, easing: 'ease-in-out' },
          { time: 0.45, rotation: 25, easing: 'ease-in-out' },
          { time: 0.95, rotation: -8, easing: 'smooth' },
          { time: 1.4, rotation: 30, easing: 'ease-in-out' },
          { time: 2.0, rotation: 0, easing: 'ease-in-out' }
        ],
        'bone-shin-r': [
          { time: 0.0, rotation: 0, easing: 'ease-in-out' },
          { time: 0.45, rotation: -35, easing: 'ease-in-out' },
          { time: 0.95, rotation: 5, easing: 'smooth' },
          { time: 1.4, rotation: -42, easing: 'ease-in-out' },
          { time: 2.0, rotation: 0, easing: 'ease-in-out' }
        ]
      },
      wind: {
        enabled: true,
        plantSpines: [
          {
            id: 'wind-1',
            name: 'Gió thổi tóc & áo',
            amplitude: 15,
            speed: 1.3,
            turbulence: 0.35
          }
        ]
      }
    })

    const res = parseAnimationClipFromJson(brokenAiJson, humanoidBones)
    expect(res.success).toBe(true)
    expect(res.clip).toBeDefined()
    // Generic "Động tác 6" is automatically renamed to descriptive action name + Gió
    expect(res.clip?.name).toContain('Nhún nhảy vươn tay (Jump)')
    expect(res.fixesApplied?.length).toBeGreaterThanOrEqual(2)

    // Left arm at peak jump (t=0.95) is flipped from -75 (crossed belly) to +75 (raised outward/upward)
    const armLPeak = res.clip?.tracks['bone-arm-l'].find((k) => k.time === 0.95)
    const armRPeak = res.clip?.tracks['bone-arm-r'].find((k) => k.time === 0.95)
    expect(armLPeak?.rotation).toBeGreaterThan(0)
    expect(armRPeak?.rotation).toBeLessThan(0)

    // Front-view squat legs at t=0.45 have outward knee symmetry + 2.5D foreshortening scaleY < 1
    const thighLSquat = res.clip?.tracks['bone-thigh-l'].find((k) => k.time === 0.45)
    const thighRSquat = res.clip?.tracks['bone-thigh-r'].find((k) => k.time === 0.45)
    expect(thighLSquat?.rotation).toBeGreaterThan(0)
    expect(thighRSquat?.rotation).toBeLessThan(0)
    expect(thighLSquat?.scaleY).toBeLessThan(1)

    // Foot ground-contact mesh impact is automatically generated at t=0.45 (squat) and t=0.95 (airborne)
    const footLSquat = res.clip?.tracks['bone-foot-l']?.find((k) => k.time === 0.45)
    const footLAir = res.clip?.tracks['bone-foot-l']?.find((k) => k.time === 0.95)
    expect(footLSquat?.scaleX).toBeGreaterThan(1.1)
    expect(footLSquat?.scaleY).toBeLessThan(0.9)
    expect(footLAir?.scaleX).toBeLessThan(1)
    expect(footLAir?.scaleY).toBeGreaterThan(1)

    // Pelvis vertical displacement is clamped to natural 2.5D limits
    const pelvisJump = res.clip?.tracks['bone-pelvis'].find((k) => k.time === 0.95)
    const pelvisLand = res.clip?.tracks['bone-pelvis'].find((k) => k.time === 1.4)
    expect(pelvisJump?.y).toBeGreaterThanOrEqual(-48)
    expect(pelvisLand?.y).toBeLessThanOrEqual(22)

    // Wind data is parsed and auto-populated with spine points
    expect(res.wind?.plantSpines?.length).toBe(1)
    expect(res.wind?.plantSpines?.[0].points.length).toBeGreaterThanOrEqual(2)
  })

  it('auto-names generic clip and applies imported wind when running applyRigAction', () => {
    const humanoidBones = createHumanoidBones()
    const baseComposite: LayerComposite = {
      id: 'comp-rig-test',
      name: 'Test Rig',
      category: 'characters',
      width: 600,
      height: 900,
      layers: [],
      rig: {
        bones: humanoidBones,
        duration: 2,
        loop: true,
        tracks: {},
        clips: [
          {
            id: 'clip-6',
            name: 'Động tác 6',
            duration: 2,
            loop: true,
            tracks: {}
          }
        ],
        activeClipId: 'clip-6'
      }
    }

    // Editing a keyframe on "Động tác 6" automatically gives it a descriptive name
    const afterKey = applyRigAction(baseComposite, {
      action: 'set-key',
      boneId: 'bone-arm-r',
      key: { time: 0.5, x: 0, y: 0, rotation: -65, easing: 'smooth' }
    })
    const updatedClip = afterKey.rig?.clips?.find((c) => c.id === 'clip-6')
    expect(updatedClip?.name).not.toBe('Động tác 6')
    expect(updatedClip?.name).toContain('Vẫy tay')
  })

  it('maps bone name in Vietnamese to actual bone ID', () => {
    const rawJson = JSON.stringify({
      name: 'Chuyển động test alias',
      tracks: {
        'Bắp tay phải': [
          { time: 0, rotation: 0 },
          { time: 1.0, rotation: -25 }
        ]
      }
    })

    const res = parseAnimationClipFromJson(rawJson, sampleBones)
    expect(res.success).toBe(true)
    expect(res.clip?.tracks['bone-arm-r']).toBeDefined()
    expect(res.clip?.tracks['bone-arm-r'].length).toBe(2)
  })

  it('returns failure on malformed json or missing tracks', () => {
    const badJson = 'Hello world, not a json'
    const res = parseAnimationClipFromJson(badJson)
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()

    const missingTracks = JSON.stringify({ name: 'No tracks' })
    const res2 = parseAnimationClipFromJson(missingTracks)
    expect(res2.success).toBe(false)
    expect(res2.error).toContain('tracks')
  })
})
