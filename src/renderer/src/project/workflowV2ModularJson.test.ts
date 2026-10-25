import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from './factory'
import {
  applyMainWorkflowJson,
  applyModularWorkflowJson,
  applyShotWorkflowJson,
  attachLogicNodeToLayerV2,
  buildMainWorkflowJson,
  buildModularWorkflowBundle,
  buildShotWorkflowJson,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from './workflowV2Engine'

function makeTwoShotProject() {
  const project = createProject({ name: 'Phim Thử Nghiệm', duration: 10 })
  const shot1 = createShot('Cảnh 1 — Rừng Sương', [0, 0, 0], 0)
  const shot2 = createShot('Cảnh 2 — Hang Đá', [2000, 0, 0], 1)
  project.shots.push(shot1, shot2)

  const mk = (id: string, name: string, z: number, shotId: string) =>
    createImageLayer({ id: `asset-${id}`, name, kind: 'image', mime: 'image/png', width: 640, height: 480 }, project.comp, z, shotId)

  const l1 = mk('knight', 'Hiệp Sĩ', 0, shot1.id)
  l1.inPoint = 0
  l1.outPoint = 5
  const l2 = mk('tree', 'Cây Cổ Thụ', -150, shot1.id)
  l2.inPoint = 0
  l2.outPoint = 5
  const l3 = mk('torch', 'Ngọn Đuốc', 20, shot2.id)
  l3.inPoint = 5
  l3.outPoint = 10
  project.layers.push(l1, l2, l3)

  let wf = syncWorkflowV2Graph(project)
  const attached1 = attachLogicNodeToLayerV2(wf, v2LayerNodeId(l1.id), 'action', 'v2:action:sway')
  wf = attached1.workflow
  const node1 = wf.nodes.find((n) => n.id === attached1.createdNodeId)!
  syncWorkflowV2NodeToProject(project, node1)

  const attached2 = attachLogicNodeToLayerV2(wf, v2LayerNodeId(l3.id), 'light', 'v2:light:candle')
  wf = attached2.workflow
  const node2 = wf.nodes.find((n) => n.id === attached2.createdNodeId)!
  syncWorkflowV2NodeToProject(project, node2)

  project.workflow = syncWorkflowV2Graph(project, wf)
  return { project, shot1, shot2, l1, l2, l3 }
}

describe('Workflow V2 Modular JSON (main.json + shots/shot-N.json)', () => {
  it('tạo main.json kết nối lộ trình Camera và danh sách các file shot-N.json độc lập', () => {
    const { project, shot1, shot2 } = makeTwoShotProject()
    const main = buildMainWorkflowJson(project)

    expect(main.kind).toBe('parallax-workflow-main')
    expect(main.route).toHaveLength(2)
    expect(main.route[0]).toMatchObject({
      shotId: shot1.id,
      index: 1,
      name: 'Cảnh 1 — Rừng Sương',
      file: 'shots/shot-1.json',
      layerCount: 2,
      logicCount: 1
    })
    expect(main.route[1]).toMatchObject({
      shotId: shot2.id,
      index: 2,
      name: 'Cảnh 2 — Hang Đá',
      file: 'shots/shot-2.json',
      layerCount: 1,
      logicCount: 1
    })
    expect(main.connections).toHaveLength(1)
    expect(main.connections[0]).toMatchObject({
      edgeId: `e-camchain-${shot1.id}-${shot2.id}`,
      fromShotId: shot1.id,
      fromFile: 'shots/shot-1.json',
      toShotId: shot2.id,
      toFile: 'shots/shot-2.json'
    })
  })

  it('mỗi cảnh có một shot-N.json đơn lẻ chỉ chứa Layer, Camera, Logic và đồ thị của riêng cảnh đó', () => {
    const { project, shot1, shot2 } = makeTwoShotProject()
    const s1Json = buildShotWorkflowJson(project, shot1.id)
    const s2Json = buildShotWorkflowJson(project, shot2.id)

    expect(s1Json.kind).toBe('parallax-workflow-shot')
    expect(s1Json.file).toBe('shots/shot-1.json')
    expect(s1Json.mainFile).toBe('main.json')
    expect(s1Json.links.nextShotId).toBe(shot2.id)
    expect(s1Json.links.nextShotFile).toBe('shots/shot-2.json')
    expect(s1Json.layers.map((l) => l.name)).toEqual(['Hiệp Sĩ', 'Cây Cổ Thụ'])
    expect(s1Json.camera.waypoints?.length).toBeGreaterThanOrEqual(1)
    expect(s1Json.camera.waypoints?.[0].nodeId).toBe(`v2-cam-wp-${shot1.id}-0`)
    expect(s1Json.logic).toHaveLength(1)
    expect(s1Json.logic[0]).toMatchObject({
      category: 'action',
      presetId: 'v2:action:sway',
      targetLayerNames: ['Hiệp Sĩ']
    })
    expect(s1Json.graph.nodes.every((n) => !n.params?.shotId || n.params.shotId === shot1.id)).toBe(true)

    expect(s2Json.file).toBe('shots/shot-2.json')
    expect(s2Json.links.prevShotId).toBe(shot1.id)
    expect(s2Json.layers.map((l) => l.name)).toEqual(['Ngọn Đuốc'])
    expect(s2Json.logic).toHaveLength(1)
    expect(s2Json.logic[0]).toMatchObject({
      category: 'light',
      presetId: 'v2:light:candle',
      targetLayerNames: ['Ngọn Đuốc']
    })
  })

  it('chỉnh sửa shot-1.json (thêm logic bằng tên layer, sửa layer, xoá logic cũ) chỉ cập nhật Cảnh 1 và giữ nguyên Cảnh 2', () => {
    const { project, shot1, shot2, l1, l2, l3 } = makeTwoShotProject()
    const s1Json = buildShotWorkflowJson(project, shot1.id)

    // Sửa JSON của Cảnh 1: đổi tên cảnh, đổi thời gian Hiệp Sĩ, gỡ logic sway cũ và gắn logic mới cho Cây Cổ Thụ bằng tên
    s1Json.shot.name = 'Cảnh 1 — Bình Minh'
    s1Json.layers[0].timeStart = 0.5
    s1Json.layers[0].timeEnd = 4.2
    if (s1Json.camera.waypoints?.[0]) {
      s1Json.camera.waypoints[0].zoomPct = 150
      s1Json.camera.waypoints[0].yaw = 10
    }
    s1Json.logic = [
      {
        id: 'v2-material-tree',
        category: 'material',
        presetId: 'v2:material:wood_plank',
        title: 'Vật liệu: Ván gỗ',
        enabled: true,
        timeStart: 0,
        timeEnd: 5,
        targetLayerIds: [],
        targetLayerNames: ['Cây Cổ Thụ'],
        params: { materialTag: 'wood_plank', materialStiffness: 0.7 }
      }
    ]

    const res = applyShotWorkflowJson(project, s1Json)
    expect(res.kind).toBe('shot')
    expect(res.targetShotId).toBe(shot1.id)
    expect(project.shots[0].name).toBe('Cảnh 1 — Bình Minh')
    expect(l1.inPoint).toBe(0.5)
    expect(l1.outPoint).toBe(4.2)
    // Logic sway cũ của l1 đã được gỡ hẳn, không bị hồi sinh
    expect(l1.motion?.enabled).toBe(false)
    // Logic vật liệu mới đã áp vào Cây Cổ Thụ (l2)
    expect(l2.physics?.enabled).toBe(true)
    expect(l2.physics?.material).toBe('wood_plank')
    const s1After = buildShotWorkflowJson(project, shot1.id)
    expect(s1After.camera.waypoints?.[0].zoomPct).toBeCloseTo(150, -1)
    expect(s1After.camera.waypoints?.[0].yaw).toBeCloseTo(10, 0)

    // Cảnh 2 hoàn toàn không bị ảnh hưởng
    expect(project.shots[1].name).toBe('Cảnh 2 — Hang Đá')
    expect(l3.virtualLight?.enabled).toBe(true)
    const s2After = buildShotWorkflowJson(project, shot2.id)
    expect(s2After.logic).toHaveLength(1)
    expect(s2After.logic[0].presetId).toBe('v2:light:candle')
  })

  it('áp dụng main.json và bundle.json cập nhật toàn dự án đồng bộ', () => {
    const { project } = makeTwoShotProject()
    const bundle = buildModularWorkflowBundle(project)
    expect(Object.keys(bundle.files)).toEqual(['main.json', 'shots/shot-1.json', 'shots/shot-2.json'])

    bundle.main.name = 'Thung Lũng Mới'
    bundle.main.composition.duration = 12
    bundle.main.route[0].cameraPreset = 'orbitRight'

    const res = applyModularWorkflowJson(project, JSON.stringify(bundle))
    expect(res.kind).toBe('bundle')
    expect(project.comp.name).toBe('Thung Lũng Mới')
    expect(project.comp.duration).toBe(12)

    const mainAfter = buildMainWorkflowJson(project)
    expect(mainAfter.route[0].cameraPreset).toBe('orbitRight')

    // Kiểm thử applyMainWorkflowJson thêm cảnh thứ 3 từ main.json
    mainAfter.route.push({
      shotId: 'shot-3-custom',
      index: 3,
      name: 'Cảnh 3 — Đỉnh Núi',
      file: 'shots/shot-3.json',
      color: '#a855f7',
      visible: true,
      position: [4000, 0, 0],
      timeStart: 8,
      timeEnd: 12,
      cameraPreset: 'dollyIn',
      layerCount: 0,
      logicCount: 0
    })
    applyMainWorkflowJson(project, mainAfter)
    expect(project.shots).toHaveLength(3)
    expect(project.shots[2].name).toBe('Cảnh 3 — Đỉnh Núi')
  })
})
