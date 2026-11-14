import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportProjectToJson } from './jsonFormat'
import { createFreshStoryWestProject } from './storyWestDemoBuilder'
import { listTimeGroups } from './workflowTimeGroups'

describe('storyWestDemoBuilder (Demo #5 — Tiểu Khô Lâu Tây Du)', () => {
  it('builds a complete 34s 5-shot 11-beat story-comic animation project and syncs JSON', async () => {
    const project = createFreshStoryWestProject()

    expect(project.comp.duration).toBe(34)
    expect(project.shots.length).toBe(5)
    expect(project.assets.length).toBe(12)

    // Kiểm tra có đủ các nền tâm lý đặc trưng (question_sky, speedlines_radial, spotlight_stage, anger_veins, hologram_panel)
    const solidPatterns = new Set(
      project.layers
        .filter((l): l is Extract<typeof l, { type: 'solid' }> => l.type === 'solid')
        .map((l) => l.props.pattern)
    )
    expect(solidPatterns.has('hologram_panel')).toBe(true)
    expect(solidPatterns.has('question_sky')).toBe(true)
    expect(solidPatterns.has('speedlines_radial')).toBe(true)
    expect(solidPatterns.has('spotlight_stage')).toBe(true)
    expect(solidPatterns.has('anger_veins')).toBe(true)

    // Kiểm tra có đủ 11 phụ đề dẫn truyện viền đôi theo nhịp câu thoại
    const subtitles = project.layers.filter((l) => l.type === 'text' && l.name.startsWith('Phụ đề:'))
    expect(subtitles.length).toBe(11)

    // Kiểm tra Workflow V2 và nhóm Time chung
    expect(project.workflow).toBeDefined()
    expect(project.workflow!.nodes.length).toBeGreaterThan(40)
    expect(listTimeGroups(project).length).toBeGreaterThanOrEqual(1)

    // Kiểm tra Lộ trình Camera 3D đa nhịp (Jump Cut + Punch Zoom + Low Angle + Three Plane + Foreground Slam)
    expect(project.camera.position.keyframes.length).toBeGreaterThanOrEqual(20)

    // Ghi xuất file JSON mẫu tĩnh để nạp tức thì từ menu Mẫu 5
    const outPath = resolve(__dirname, '../../../../projects/demo-5-tieu-kho-lau-tay-du.json')
    writeFileSync(outPath, await exportProjectToJson(project), 'utf8')
  })
})
