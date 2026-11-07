import { describe, expect, it } from 'vitest'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import {
  exportAnimationClipToJson,
  generateAiMotionPrompt,
  parseAnimationClipFromJson,
  extractJsonFromText
} from './workshopClipJson'

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

  it('exports AnimationClip to JSON with bones metadata and tracks', () => {
    const jsonStr = exportAnimationClipToJson(sampleClip, sampleBones, true)
    expect(jsonStr).toContain('"format": "parallax-motion-v1"')
    expect(jsonStr).toContain('"name": "Vẫy tay chào"')
    expect(jsonStr).toContain('"bone-arm-r"')

    const parsed = JSON.parse(jsonStr)
    expect(parsed.duration).toBe(1.5)
    expect(parsed.bones.length).toBe(3)
    expect(parsed.bones[1].name).toBe('Thân / Ngực')
  })

  it('generates rich AI motion prompt with bone tree', () => {
    const prompt = generateAiMotionPrompt(sampleClip, sampleBones, 'Nhân vật cúi chào trang trọng')
    expect(prompt).toContain('Parallax Studio')
    expect(prompt).toContain('Nhân vật cúi chào trang trọng')
    expect(prompt).toContain('bone-torso')
    expect(prompt).toContain('Thân / Ngực')
    expect(prompt.toLowerCase()).toContain('quy tắc keyframe')
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
          { time: 1.0, rotation: 40, easing: 'ease-in-out' },
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
    expect(res.clip?.tracks['bone-arm-r'][1].rotation).toBe(40)
  })

  it('maps bone name in Vietnamese to actual bone ID', () => {
    const rawJson = JSON.stringify({
      name: 'Chuyển động test alias',
      tracks: {
        'Bắp tay phải': [
          { time: 0, rotation: 0 },
          { time: 1.0, rotation: 25 }
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
