import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { autoScaleFactor } from '../animation/math'
import { exportProjectToJson } from './jsonFormat'
import { createFreshStoryWestProject } from './storyWestDemoBuilder'
import { listTimeGroups } from './workflowTimeGroups'

describe('storyWestDemoBuilder (Demo #5 — Tiểu Khô Lâu Tây Du)', () => {
  it('builds a complete 34s 5-shot 11-beat story-comic animation project with zero half-cut characters and syncs JSON', async () => {
    const project = createFreshStoryWestProject()

    expect(project.comp.duration).toBe(34)
    expect(project.shots.length).toBe(5)
    expect(project.assets.length).toBe(18)

    // Kiểm tra có đủ các nền tâm lý đặc trưng (question_sky, speedlines_radial, horror_bw_speedlines, spotlight_stage, anger_veins)
    const solidPatterns = new Set(
      project.layers
        .filter((l): l is Extract<typeof l, { type: 'solid' }> => l.type === 'solid')
        .map((l) => l.props.pattern)
    )
    expect(solidPatterns.has('question_sky')).toBe(true)
    expect(solidPatterns.has('speedlines_radial')).toBe(true)
    expect(solidPatterns.has('horror_bw_speedlines')).toBe(true)
    expect(solidPatterns.has('spotlight_stage')).toBe(true)
    expect(solidPatterns.has('anger_veins')).toBe(true)

    // Kiểm tra có đủ 11 phụ đề dẫn truyện viền đôi theo nhịp câu thoại, liền mạch 0ms gap
    const subtitles = project.layers.filter((l) => l.type === 'text' && l.name.startsWith('Phụ đề:'))
    expect(subtitles.length).toBe(11)

    // Kiểm tra mọi layer nhân vật bán thân đều được neo đáy sâu dưới mép dưới màn hình (không lộ vết cắt ngang bụng)
    const bustIds = [
      's5-s1-skel-confused',
      's5-s1-skel-ots',
      's5-s2-skel-q',
      's5-s2-crew',
      's5-s2-skel-cower',
      's5-s3-skel-pity',
      's5-s3-wukong-rage',
      's5-s4-wukong-point',
      's5-s4-maiden-fear',
      's5-s5-fg-observer'
    ]
    for (const id of bustIds) {
      const layer = project.layers.find((l) => l.id === id)
      expect(layer && layer.type === 'image').toBe(true)
      if (layer && layer.type === 'image') {
        const pos = layer.transform.position.value
        const scY = layer.transform.scale.value[1]
        const perspK = layer.autoScale ? 1 : autoScaleFactor(pos[2], project.comp)
        const screenBottomY = (pos[1] - (layer.props.height * scY) * 0.5) / perspK
        expect(screenBottomY).toBeLessThanOrEqual(-580)
      }
    }

    // Kiểm tra Camera 2D chuẩn hoạt ảnh (roll = 0 trên mọi mốc, không nghiêng lệch méo hình)
    expect(project.camera.position.keyframes.length).toBeGreaterThanOrEqual(22)
    for (const rkf of project.camera.roll?.keyframes ?? []) {
      expect(rkf.value).toBe(0)
    }

    // Kiểm tra Workflow V2 và 2 nhóm Time chung ở Cảnh 5
    expect(project.workflow).toBeDefined()
    expect(project.workflow!.nodes.length).toBeGreaterThan(40)
    expect(listTimeGroups(project).length).toBe(2)

    // Ghi xuất file JSON mẫu tĩnh để nạp tức thì từ menu Mẫu 5
    const outPath = resolve(__dirname, '../../../../projects/demo-5-tieu-kho-lau-tay-du.json')
    writeFileSync(outPath, await exportProjectToJson(project), 'utf8')
  })
})
