import { afterAll, describe, expect, it } from 'vitest'
import { assetStore } from './assets'
import { buildDonghuaDemoProject } from './demo'
import { isTimeNode } from './workflowTiming'
import { isComposableLogicNode, resolveFxAtomicRole } from './workflowV2Engine'

afterAll(() => {
  assetStore.clear()
})

describe('donghuaDemoBuilder — Phim Mẫu 2 Quốc Phong 2.5D', () => {
  it('nạp thành công 14 ảnh thật từ đĩa và dựng đủ 3 cảnh 18s chuẩn Workflow V2 đơn nhiệm', async () => {
    const project = await buildDonghuaDemoProject()

    expect(project.comp.width).toBe(1920)
    expect(project.comp.height).toBe(1080)
    expect(project.comp.fps).toBe(30)
    expect(project.comp.duration).toBe(18)
    expect(project.shots).toHaveLength(3)

    // Toàn bộ 14 PNG mỹ thuật phải được assetStore nạp thật từ assets/scenes-donghua-v2/
    expect(project.assets).toHaveLength(14)
    for (const meta of project.assets) {
      expect(meta.path).toContain('scenes-donghua-v2/')
      const loaded = assetStore.get(meta.id)
      expect(loaded, `Missing loaded asset in assetStore: ${meta.id}`).toBeDefined()
      expect(loaded!.blob.size).toBeGreaterThan(1000)
    }

    const wf = project.workflow
    expect(wf).toBeDefined()
    const nodes = wf!.nodes

    // Có cụm composite 2.5D và cluster_lock mặc định thu gọn sub-layer
    const clusterLocks = nodes.filter((n) => n.params?.logicCategory === 'cluster_lock')
    expect(clusterLocks.length).toBeGreaterThanOrEqual(2)
    expect(clusterLocks.every((n) => n.params?.collapsedSubLayers === true)).toBe(true)

    // Cảnh 2 phải có biến thể đổi thần thái Kiếm Khách (Điềm tĩnh -> Khai phong kiếm ý)
    const fierceLayer = project.layers.find((l) => l.id === 'layer-dg-s2-fierce')
    expect(fierceLayer).toBeDefined()
    expect(
      nodes.some((n) => n.params?.isPartChild && n.params?.swapTargetLayerId === 'layer-dg-s2-fierce')
    ).toBe(true)
    expect(fierceLayer!.transform.opacity.keyframes.length).toBeGreaterThanOrEqual(2)

    // Có nhóm Time chung cho cao trào Trúc Lâm
    const timeNodes = nodes.filter((n) => isTimeNode(n))
    expect(timeNodes.length).toBeGreaterThanOrEqual(1)

    // Phải có ít nhất 3 chuỗi logic đa bước đạt bước B3 (pipelineStepIndex >= 3)
    const step3Nodes = nodes.filter(
      (n) => isComposableLogicNode(n) && (n.params?.pipelineStepIndex ?? 0) >= 3
    )
    expect(step3Nodes.length).toBeGreaterThanOrEqual(3)

    // Mọi Node FX đều đơn nhiệm 100% (chỉ giữ 1 vai trò fade / pulse / glow)
    const fxNodes = nodes.filter((n) => n.params?.logicCategory === 'fx')
    expect(fxNodes.length).toBeGreaterThanOrEqual(6)
    for (const fx of fxNodes) {
      expect(['fade', 'pulse', 'glow']).toContain(resolveFxAtomicRole(fx))
    }
  })
})
