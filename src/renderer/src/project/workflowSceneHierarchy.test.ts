import { describe, expect, it } from 'vitest'
import type { Project, WorkflowGraph } from '@shared/types'
import {
  formatLayerNodeLabel,
  getRootLayersForShot,
  getShotDuration,
  getWorkflowEffectiveDuration,
  spawnSceneWithChildLayers
} from './workflowSceneHierarchy'
import { ensureProjectWorkflow } from './workflowEngine'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  spawnLogicNodeIntoWorkflow
} from './workflowLogicNodes'

function createMockProject(): Project {
  return ({

    version: 2,
    comp: {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 16
    },
    shots: [
      {
        id: 'shot-1',
        name: 'Rừng Đom Đóm',
        color: '#38bdf8',
        visible: true,
        position: { value: [0, 0, 0] },
        rotation: { value: [0, 0, 0] }
      },
      {
        id: 'shot-2',
        name: 'Lâu Đài Cổ',
        color: '#a855f7',
        visible: true,
        position: { value: [0, 0, 0] },
        rotation: { value: [0, 0, 0] }
      }
    ],
    layers: [
      {
        id: 'layer-sky',
        name: 'Bầu trời đêm',
        type: 'image',
        shotId: 'shot-1',
        visible: true,
        locked: false,
        blendMode: 'normal',
        autoScale: false,
        transform: {
          position: { value: [0, 0, 3200] },
          rotation: { value: [0, 0, 0] },
          scale: { value: [1, 1, 1] },
          opacity: { value: 1 }
        },
        props: { assetId: 'sky.png' }
      },
      {
        id: 'layer-char-root',
        name: 'Nhân vật Hiệp sĩ',
        type: 'image',
        shotId: 'shot-1',
        visible: true,
        locked: false,
        blendMode: 'normal',
        autoScale: false,
        composite: {
          instanceId: 'comp-knight-inst',
          compositeId: 'comp-knight',
          compositeName: 'Hiệp sĩ 2.5D',
          isRoot: true,
          lockedGroup: true
        },
        transform: {
          position: { value: [0, 0, 200] },
          rotation: { value: [0, 0, 0] },
          scale: { value: [1, 1, 1] },
          opacity: { value: 1 }
        },
        props: { assetId: 'knight_body.png' }
      },
      {
        id: 'layer-char-head',
        name: 'Đầu hiệp sĩ',
        type: 'image',
        shotId: 'shot-1',
        visible: true,
        locked: false,
        blendMode: 'normal',
        autoScale: false,
        composite: {
          instanceId: 'comp-knight-inst',
          compositeId: 'comp-knight',
          compositeName: 'Hiệp sĩ 2.5D',
          isRoot: false,
          lockedGroup: true
        },
        transform: {
          position: { value: [0, 50, 200] },
          rotation: { value: [0, 0, 0] },
          scale: { value: [1, 1, 1] },
          opacity: { value: 1 }
        },
        props: { assetId: 'knight_head.png' }
      },
      {
        id: 'layer-fireflies',
        name: 'Đom đóm sáng',
        type: 'particles',
        shotId: 'shot-1',
        visible: true,
        locked: false,
        blendMode: 'screen',
        autoScale: false,
        transform: {
          position: { value: [0, 0, 50] },
          rotation: { value: [0, 0, 0] },
          scale: { value: [1, 1, 1] },
          opacity: { value: 1 }
        },
        props: { count: 40 }
      }
    ],
    audioTracks: []
  } as unknown as Project)
}

describe('workflowSceneHierarchy', () => {
  it('tính thời lượng hiệu dụng chính xác: 0s khi trống, chia theo phân cảnh khi chọn cảnh', () => {
    const project = createMockProject()
    const emptyWf: WorkflowGraph = {
      version: 1,
      id: 'wf-empty',
      name: 'Bản vẽ trống',
      description: '',
      nodes: [],
      edges: []
    }

    // 1. Khi bản vẽ trống (0 nodes), thời lượng luôn là 0s
    expect(getWorkflowEffectiveDuration(emptyWf, project)).toBe(0)
    expect(getWorkflowEffectiveDuration(emptyWf, project, 'shot-1')).toBe(0)

    // 2. Tính thời lượng mỗi cảnh
    expect(getShotDuration(project, 'shot-1')).toBe(8) // 16s / 2 shots = 8s

    // 3. Khi có node và chọn phân cảnh
    const wfWithNodes: WorkflowGraph = {
      ...emptyWf,
      nodes: [
        {
          id: 'wf-cam',
          type: 'camera_director',
          title: 'Lộ trình Camera',
          enabled: true,
          position: { x: 0, y: 0 },
          preset: 'cinematic_fly_push',
          aiAgentRole: 'CameraDirectorAgent',
          aiDirective: ''
        }
      ]
    }
    expect(getWorkflowEffectiveDuration(wfWithNodes, project, 'shot-1')).toBe(8)
    expect(getWorkflowEffectiveDuration(wfWithNodes, project, 'all')).toBe(16)
  })

  it('không tự ý tạo lại default workflow khi người dùng đã chủ động xoá trắng (nodes: [])', () => {
    const project = createMockProject()
    project.workflow = {
      version: 1,
      id: 'wf-cleared',
      name: 'Workflow đã xóa trắng',
      description: '',
      nodes: [],
      edges: []
    }

    const ensured = ensureProjectWorkflow(project)
    expect(ensured.nodes).toHaveLength(0)
    expect(ensured.edges).toHaveLength(0)
  })

  it('lọc danh sách layer gốc của phân cảnh và gộp các part của composite 2.5D', () => {
    const project = createMockProject()
    const rootLayers = getRootLayersForShot(project, 'shot-1')

    // Phân cảnh 1 có: sky, char (gồm root + head -> chỉ lấy 1 root), fireflies -> tổng cộng 3 root layers
    expect(rootLayers).toHaveLength(3)
    expect(rootLayers.map((l) => l.name)).toEqual(['Bầu trời đêm', 'Nhân vật Hiệp sĩ', 'Đom đóm sáng'])

    // Nhãn 2.5D composite chứa thông tin 2 bộ phận
    const charRoot = rootLayers.find((l) => l.name === 'Nhân vật Hiệp sĩ')!
    const meta = formatLayerNodeLabel(charRoot, project)
    expect(meta.icon).toBe('🧩')
    expect(meta.badgeLabel).toContain('2 bộ phận')
    expect(meta.partNames).toEqual(['Nhân vật Hiệp sĩ', 'Đầu hiệp sĩ'])
  })

  it('bung Cảnh thành 1 Node Cảnh trung tâm kèm toàn bộ Node Layer con và nối sẵn dây scene_ctx', () => {
    const project = createMockProject()
    const emptyWf: WorkflowGraph = {
      version: 1,
      id: 'wf-empty',
      name: 'Bản vẽ trống',
      description: '',
      nodes: [],
      edges: []
    }

    const { workflow: result, sceneNode, childNodes } = spawnSceneWithChildLayers(
      project,
      emptyWf,
      'shot-1'
    )

    // Node Cảnh
    expect(sceneNode.type).toBe('scene_shot')
    expect(sceneNode.title).toContain('Rừng Đom Đóm')
    expect(sceneNode.params?.shotId).toBe('shot-1')

    // 3 Node Layer con
    expect(childNodes).toHaveLength(3)
    expect(childNodes[0].type).toBe('layer_assembly')
    expect(childNodes[0].title).toContain('Bầu trời đêm')
    expect(childNodes[1].title).toContain('Hiệp sĩ 2.5D')
    expect(childNodes[2].title).toContain('Đom đóm sáng')

    // Tổng số node trên bản vẽ là 4
    expect(result.nodes).toHaveLength(4)

    // Đã tự động tạo 3 đường nối scene_ctx từ Node Cảnh tới từng Node Layer con
    expect(result.edges).toHaveLength(3)
    for (const e of result.edges) {
      expect(e.fromNode).toBe(sceneNode.id)
      expect(e.fromPort).toBe('scene_ctx')
      expect(e.toPort).toBe('scene_ctx')
      expect(childNodes.some((cn) => cn.id === e.toNode)).toBe(true)
    }
  })

  it('kho Node Logic chứa đầy đủ các nhóm Lộ trình, Audio, Vật lý, Ánh sáng, Chuyển động', () => {
    const categories = WORKFLOW_LOGIC_NODE_CATEGORIES.map((c) => c.id)
    expect(categories).toContain('camera')
    expect(categories).toContain('audio')
    expect(categories).toContain('physics')
    expect(categories).toContain('light_fx')
    expect(categories).toContain('motion')
    expect(categories).toContain('scene')
    expect(categories).toContain('assembly')
    expect(categories).toContain('look')

    // Kiểm tra các node đại diện
    const camFly = WORKFLOW_LOGIC_NODE_CATALOG.find((n) => n.id === 'logic-cam-fly')
    expect(camFly?.category).toBe('camera')
    expect(camFly?.nodeType).toBe('camera_director')

    const audioLip = WORKFLOW_LOGIC_NODE_CATALOG.find((n) => n.id === 'logic-audio-lipsync')
    expect(audioLip?.category).toBe('audio')
    expect(audioLip?.nodeType).toBe('audio_lipsync')

    const physWind = WORKFLOW_LOGIC_NODE_CATALOG.find((n) => n.id === 'logic-physics-wind')
    expect(physWind?.category).toBe('physics')
    expect(physWind?.nodeType).toBe('physics_fx')

    const lightCandle = WORKFLOW_LOGIC_NODE_CATALOG.find((n) => n.id === 'logic-fx-candle')
    expect(lightCandle?.category).toBe('light_fx')
    expect(lightCandle?.nodeType).toBe('physics_fx')
  })

  it('thả Node Lộ trình hoặc Vật lý tự động nối dây vào Layer con hoặc Cảnh trên bản vẽ', () => {
    const project = createMockProject()
    const { workflow: seededWf, childNodes } = spawnSceneWithChildLayers(
      project,
      {
        version: 1,
        id: 'wf-empty',
        name: 'Bản vẽ trống',
        description: '',
        nodes: [],
        edges: []
      },
      'shot-1'
    )

    // Thả 1 Node Vật lý Gió lay cây
    const { workflow: wfAfterPhys, spawnedNode: physNode } = spawnLogicNodeIntoWorkflow(
      seededWf,
      'logic-physics-wind',
      'shot-1'
    )

    // Node Vật lý nhận actors_rig từ Layer con
    const edgeToPhys = wfAfterPhys.edges.find((e) => e.toNode === physNode.id)
    expect(edgeToPhys).toBeDefined()
    expect(edgeToPhys?.toPort).toBe('actors_rig')
    expect(childNodes.some((cn) => cn.id === edgeToPhys?.fromNode)).toBe(true)

    // Thả 1 Node Lộ trình Camera
    const { workflow: wfAfterCam, spawnedNode: camNode } = spawnLogicNodeIntoWorkflow(
      wfAfterPhys,
      'logic-cam-fly',
      'shot-1'
    )

    // Node Lộ trình nhận scene_ctx từ Cảnh
    const edgeToCam = wfAfterCam.edges.find((e) => e.toNode === camNode.id)
    expect(edgeToCam).toBeDefined()
    expect(edgeToCam?.toPort).toBe('scene_ctx')
  })
})
