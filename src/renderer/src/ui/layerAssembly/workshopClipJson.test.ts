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
    expect(jsonStr).toContain('"depthOrderRule"')
    expect(jsonStr).toContain('"meshDeformation"')
    expect(jsonStr).toContain('"groundContactImpact"')
    expect(jsonStr).toContain('"wind"')

    const parsed = JSON.parse(jsonStr)
    expect(parsed.duration).toBe(1.5)
    expect(parsed.bones.length).toBe(3)
    expect(parsed.bones[1].name).toBe('Thân / Ngực')
    expect(parsed.bones[2].directionGuide).toContain('GIƠ TAY PHẢI MỞ RA NGOÀI & LÊN CAO')
    expect(parsed.rigConventions.depthOrderRule).toContain('Z càng CAO (dương) thì bộ phận CÀNG Ở PHÍA TRƯỚC')
    expect(parsed.characterOrientation).toBeDefined()
    expect(parsed.characterOrientation.angleDeg).toBe(0)
    expect(parsed.characterOrientation.facing).toContain('Chính diện 0°')
    expect(parsed.characterOrientation.motionRules.length).toBeGreaterThanOrEqual(4)
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
    expect(prompt).toContain('GÓC ĐỘ & HƯỚNG NHÌN NHÂN VẬT')
    expect(prompt).toContain('QUY ƯỚC CHIỀU SÂU Z-INDEX 2.5D')
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

  it('exports JSON with namingConvention and perspectiveWalkDepthRule for screen space and walk depth cues', () => {
    const jsonStr = exportAnimationClipToJson(sampleClip, sampleBones, true)
    const parsed = JSON.parse(jsonStr)
    expect(parsed.rigConventions.namingConvention).toBeDefined()
    expect(parsed.rigConventions.namingConvention.rule).toBe('SCREEN_SPACE_NAMING')
    expect(parsed.rigConventions.namingConvention.screenLeft).toContain('BÊN TRÁI MÀN HÌNH')
    expect(parsed.rigConventions.namingConvention.contralateralCoordination).toContain('PHỐI HỢP TAY - CHÂN NGHỊCH PHA')

    expect(parsed.rigConventions.perspectiveWalkDepthRule).toBeDefined()
    expect(parsed.rigConventions.perspectiveWalkDepthRule.forwardFoot.depthOrder).toContain('BẮT BUỘC ĐÈ LÊN')
    expect(parsed.rigConventions.perspectiveWalkDepthRule.forwardFoot.scale).toContain('1.05')
  })

  it('parses flexible keys (t, rot, scale, zIndex) and auto-fixes 2.5D walk depth perspective with contralateral limb coordination', () => {
    const humanoidBones = createHumanoidBones()
    const walkJson = JSON.stringify({
      format: 'parallax-motion-v1',
      name: 'Bước đi mẫu từ AI',
      duration: 1.6,
      tracks: {
        'bone-foot-l': [
          { t: 0.0, y: 0, scale: 1 },
          { t: 0.4, y: 8, scale: 1.02 },
          { t: 0.8, y: 0, scale: 1 },
          { t: 1.2, y: -6, scale: 0.98 },
          { t: 1.6, y: 0, scale: 1 }
        ],
        'bone-foot-r': [
          { t: 0.0, y: 0, scale: 1 },
          { t: 0.4, y: -6, scale: 0.98 },
          { t: 0.8, y: 0, scale: 1 },
          { t: 1.2, y: 8, scale: 1.02 },
          { t: 1.6, y: 0, scale: 1 }
        ],
        'bone-arm-l': [
          { t: 0.0, rot: 0 },
          { t: 0.4, rot: -20 },
          { t: 0.8, rot: 0 },
          { t: 1.2, rot: 25 },
          { t: 1.6, rot: 0 }
        ],
        'bone-arm-r': [
          { t: 0.0, rot: 0 },
          { t: 0.4, rot: 25 },
          { t: 0.8, rot: 0 },
          { t: 1.2, rot: -20 },
          { t: 1.6, rot: 0 }
        ]
      }
    })

    const res = parseAnimationClipFromJson(walkJson, humanoidBones, { autoFixBiomechanics: true })
    expect(res.success).toBe(true)
    expect(res.clip).toBeDefined()

    const footLAt04 = res.clip?.tracks['bone-foot-l'].find((k) => k.time === 0.4)
    const footRAt04 = res.clip?.tracks['bone-foot-r'].find((k) => k.time === 0.4)
    expect(footLAt04?.zOrder).toBe(15)
    expect(footRAt04?.zOrder).toBe(-15)
    expect(footLAt04?.scaleX).toBeGreaterThanOrEqual(1.05)
    expect(footRAt04?.scaleX).toBeLessThanOrEqual(0.96)

    const armLAt04 = res.clip?.tracks['bone-arm-l'].find((k) => k.time === 0.4)
    const armRAt04 = res.clip?.tracks['bone-arm-r'].find((k) => k.time === 0.4)
    expect(armRAt04?.zOrder).toBe(50)
    expect(armLAt04?.zOrder).toBe(-50)
  })

  it('deduplicates hierarchical child zOrder, normalizes walk shin vertical y, and skips redundant wind on bone-driven layers', () => {
    const humanoidBones = createHumanoidBones()
    const cutoutComposite: LayerComposite = {
      id: 'comp-character-cutout-demo-20261011',
      name: 'Nhân Vật Anime 2.5D — Nam Sinh Kính Cận',
      category: 'characters',
      width: 750,
      height: 1050,
      layers: [
        {
          id: 'demo-head',
          name: 'head',
          assetPath: '',
          x: 0,
          y: -315,
          z: 20,
          scale: 1,
          rotation: 0,
          opacity: 1,
          locked: false,
          boneId: 'bone-head',
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
        },
        {
          id: 'demo-glasses',
          name: 'glasses',
          assetPath: '',
          x: 2,
          y: -292,
          z: 42,
          scale: 1,
          rotation: 0,
          opacity: 1,
          locked: false,
          boneId: 'bone-head',
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
        },
        {
          id: 'demo-torso',
          name: 'torso',
          assetPath: '',
          x: 0,
          y: -50,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          locked: false,
          boneId: 'bone-torso',
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
        }
      ]
    }

    const userAiWalkJson = JSON.stringify({
      format: 'parallax-motion-v1',
      name: 'Bước đi tiến về camera',
      duration: 1.6,
      loop: true,
      fps: 30,
      viewAngle: 'front',
      tracks: {
        'bone-torso': [
          { time: 0.0, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' },
          { time: 0.8, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' }
        ],
        'bone-head': [
          { time: 0.0, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' },
          { time: 0.8, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' }
        ],
        'bone-arm-r': [
          { time: 0.0, rotation: 16, scaleX: 1.05, scaleY: 1.05, zOrder: 50, easing: 'smooth' },
          { time: 0.8, rotation: -12, scaleX: 0.96, scaleY: 0.96, zOrder: -50, easing: 'smooth' }
        ],
        'bone-forearm-r': [
          { time: 0.0, rotation: 14, scaleX: 1.05, scaleY: 1.05, zOrder: 52, easing: 'smooth' },
          { time: 0.8, rotation: -6, scaleX: 0.96, scaleY: 0.96, zOrder: -48, easing: 'smooth' }
        ],
        'bone-thigh-l': [
          { time: 0.0, rotation: 10, y: 4, scaleX: 1.08, scaleY: 1.06, zOrder: 16, easing: 'smooth' },
          { time: 0.8, rotation: 6, y: -3, scaleX: 0.94, scaleY: 0.91, zOrder: -16, easing: 'smooth' }
        ],
        'bone-shin-l': [
          { time: 0.0, rotation: -8, y: -5, scaleX: 1.08, scaleY: 1.04, zOrder: 15, easing: 'smooth' },
          { time: 0.8, rotation: -12, y: 0, scaleX: 0.94, scaleY: 0.89, zOrder: -15, easing: 'smooth' }
        ],
        'bone-foot-l': [
          { time: 0.0, x: 0, y: 10, rotation: 3, scaleX: 1.14, scaleY: 0.9, zOrder: 18, easing: 'smooth' },
          { time: 0.8, x: 0, y: -8, rotation: -4, scaleX: 0.93, scaleY: 0.95, zOrder: -18, easing: 'smooth' }
        ]
      },
      wind: {
        enabled: true,
        weatherPreset: 'breeze',
        lean: 3,
        plantSpines: [
          {
            name: 'Gió nhẹ mái tóc',
            layerIds: ['demo-head'],
            direction: 'down',
            amplitude: 5,
            speed: 0.75
          },
          {
            name: 'Nhịp tà áo khi bước',
            layerIds: ['demo-torso'],
            direction: 'down',
            amplitude: 4,
            speed: 0.75
          }
        ]
      }
    })

    const res = parseAnimationClipFromJson(userAiWalkJson, humanoidBones, cutoutComposite)
    expect(res.success).toBe(true)

    // 1. Hierarchical child zOrder on forearm-r & shin-l is deduplicated so it does not double-stack with parent
    expect(res.clip?.tracks['bone-forearm-r'][0].zOrder).toBe(2)
    expect(res.clip?.tracks['bone-shin-l'][0].zOrder).toBe(-1)

    // 2. Shin-l vertical y is normalized (+5 at forward step t=0.0, negative at backward lift t=0.8)
    expect(res.clip?.tracks['bone-shin-l'][0].y).toBeGreaterThan(0)
    expect(res.clip?.tracks['bone-shin-l'][1].y).toBeLessThan(0)

    // 3. Redundant wind plantSpines on bone-driven head & torso are stripped
    expect(res.wind?.plantSpines.length).toBe(0)
    expect(res.wind?.enabled).toBe(false)

    // 4. Exported JSON and AI Prompt include wind configurationGuide and disable wind when all parts have bone logic
    const exported = JSON.parse(exportAnimationClipToJson(res.clip!, humanoidBones, true, cutoutComposite))
    expect(exported.wind.enabled).toBe(false)
    expect(exported.wind.configurationGuide.skipWindIfBoneAnimatedRule).toContain('TUYỆT ĐỐI KHÔNG tự ý gắn thêm trục gió')
    expect(exported.wind.configurationGuide.parameterGuide.length).toBeGreaterThanOrEqual(8)
    expect(exported.rigConventions.perspectiveWalkDepthRule.hierarchicalZOrder).toContain('QUY TẮC KẾ THỪA Z-ORDER CHA -> CON')

    const prompt = generateAiMotionPrompt(res.clip!, humanoidBones, 'Bước đi về phía camera', cutoutComposite)
    expect(prompt).toContain('ĐÃ CÓ LOGIC XƯƠNG THÌ KHÔNG CẦN BỔ SUNG GIÓ')
    expect(prompt).toContain('"enabled": false')
  })
})
