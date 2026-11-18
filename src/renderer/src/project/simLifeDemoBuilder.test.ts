import { describe, expect, it } from 'vitest'
import { buildSimLifeEp1GateProject, buildSimLifeEp1TwistProject } from './simLifeDemoBuilder'
import { validateAndRepairDialogueContinuity } from './subtitleAndDialogueSync'

describe('simLifeDemoBuilder — 2 mẫu thử hoạt ảnh 2.5D Mô Phỏng Nhân Sinh', () => {
  it('Mẫu 4 (sim_life_ep1_gate): dựng đủ 3 cảnh, 9 nhịp thoại đơn nhiệm, camera phẳng roll=0 và không đứt nhịp thoại', async () => {
    const project = await buildSimLifeEp1GateProject()
    expect(project.shots).toHaveLength(3)
    expect(project.comp.duration).toBe(32)
    expect(project.assets.length).toBeGreaterThanOrEqual(8)

    const wfNodes = project.workflow?.nodes ?? []
    const subtitleNodes = wfNodes.filter((n) => n.params?.logicCategory === 'subtitle')
    const actionNodes = wfNodes.filter((n) => n.params?.logicCategory === 'action')
    const fxNodes = wfNodes.filter((n) => n.params?.logicCategory === 'fx')

    expect(subtitleNodes.length).toBe(9)
    expect(actionNodes.length).toBeGreaterThanOrEqual(5)
    expect(fxNodes.length).toBeGreaterThanOrEqual(5)

    // Có đủ các kiểu phụ đề / bóng thoại từ 2 video tham khảo
    const styles = new Set(subtitleNodes.map((n) => n.params?.subtitleStylePreset))
    expect(styles.has('lugia_cyan')).toBe(true)
    expect(styles.has('comic_bubble')).toBe(true)
    expect(styles.has('dino_white_pill')).toBe(true)
    expect(styles.has('system_hologram')).toBe(true)

    // Camera giữ roll = 0 xuyên suốt
    expect(project.camera.roll?.keyframes.every((k) => k.value === 0)).toBe(true)

    const continuity = validateAndRepairDialogueContinuity(project, false)
    expect(continuity.issues).toHaveLength(0)
  })

  it('Mẫu 5 (sim_life_ep1_twist): dựng đủ 3 cảnh, cú twist phồng má Shadiao, bóng thoại có mũi nhọn và chuỗi FX đơn nhiệm', async () => {
    const project = await buildSimLifeEp1TwistProject()
    expect(project.shots).toHaveLength(3)
    expect(project.comp.duration).toBe(33)

    const wfNodes = project.workflow?.nodes ?? []
    const subtitleNodes = wfNodes.filter((n) => n.params?.logicCategory === 'subtitle')
    const fxNodes = wfNodes.filter((n) => n.params?.logicCategory === 'fx')
    const actionNodes = wfNodes.filter((n) => n.params?.logicCategory === 'action')

    expect(subtitleNodes.length).toBe(9)
    expect(fxNodes.length).toBeGreaterThanOrEqual(4)
    expect(actionNodes.length).toBeGreaterThanOrEqual(4)

    // Có câu thoại cao trào khoanh tay phồng má Shadiao + viền sticker trắng
    const shoutNode = subtitleNodes.find((n) => n.params?.subtitleStylePreset === 'comic_shout')
    expect((shoutNode?.params?.subtitleText ?? '').replace(/\s+/g, ' ')).toContain(
      'Hệ thống này có vấn đề gì vậy'
    )
    const whiteStickerFx = fxNodes.find(
      (n) => n.params?.animFxPreset === 'neonSolid' && n.params?.animFxColor === '#ffffff'
    )
    expect(whiteStickerFx).toBeDefined()

    const continuity = validateAndRepairDialogueContinuity(project, false)
    expect(continuity.issues).toHaveLength(0)
  })
})
