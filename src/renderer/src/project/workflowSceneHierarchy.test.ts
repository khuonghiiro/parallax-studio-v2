import { describe, expect, it } from 'vitest'
import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import {
  consolidateCompositeWorkflowNodes,
  createClearedWorkflowWithSceneRoots,
  formatLayerNodeLabel,
  getRootLayersForShot,
  getShotDuration,
  getWorkflowEffectiveDuration,
  spawnSceneWithChildLayers,
  syncMissingLayersToWorkflow
} from './workflowSceneHierarchy'
import {
  relaxOverlappingPositions,
  solveSpaciousWorkflowLayout
} from '../ui/workflow/workflowLayoutAndFlow'
import {
  applyWorkflowToProject,
  createDefaultWorkflow,
  ensureProjectWorkflow,
  resolveConnectedWorkflowNodes
} from './workflowEngine'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  spawnLogicNodeIntoWorkflow
} from './workflowLogicNodes'

function createMockNode(base: Partial<WorkflowNode> & { id: string; type: any; title: string }): WorkflowNode {
  return {
    enabled: true,
    preset: 'default',
    aiAgentRole: 'SceneLayoutAgent',
    aiDirective: 'test',
    position: { x: 0, y: 0 },
    ...base
  }
}

function createMockProject(): Project {
  return ({
    version: 2,
    comp: {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 16,
      background: '#090a10'
    },
    camera: {
      position: { value: [0, 0, 1200], keyframes: [] },
      target: { value: [0, 0, 0], keyframes: [] },
      fov: { value: 45, keyframes: [] },
      focusDistance: { value: 1200, keyframes: [] },
      aperture: { value: 0.02, keyframes: [] },
      fade: { value: 0, keyframes: [] },
      dofEnabled: false,
      shakeAmount: 0,
      shakeFreq: 2.5
    },
    look: {
      exposure: 0,
      contrast: 1,
      saturation: 1,
      vignette: 0,
      grain: 0,
      fogEnabled: false,
      fogColor: '#1e293b',
      fogNear: 500,
      fogFar: 4000
    },
    shots: [
      {
        id: 'shot-1',
        name: 'Rừng Đom Đóm',
        color: '#38bdf8',
        visible: true,
        position: { value: [0, 0, 0], keyframes: [] },
        rotation: { value: [0, 0, 0], keyframes: [] }
      },
      {
        id: 'shot-2',
        name: 'Lâu Đài Cổ',
        color: '#a855f7',
        visible: true,
        position: { value: [0, 0, 0], keyframes: [] },
        rotation: { value: [0, 0, 0], keyframes: [] }
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
        inPoint: 0,
        outPoint: 16,
        transform: {
          position: { value: [0, 0, 3200], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
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
        inPoint: 0,
        outPoint: 16,
        composite: {
          instanceId: 'comp-knight-inst',
          compositeId: 'comp-knight',
          compositeName: 'Hiệp sĩ 2.5D',
          isRoot: true,
          lockedGroup: true
        },
        transform: {
          position: { value: [0, 0, 200], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
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
        inPoint: 0,
        outPoint: 16,
        composite: {
          instanceId: 'comp-knight-inst',
          compositeId: 'comp-knight',
          compositeName: 'Hiệp sĩ 2.5D',
          isRoot: false,
          lockedGroup: true
        },
        transform: {
          position: { value: [0, 50, 200], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
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
        inPoint: 0,
        outPoint: 16,
        transform: {
          position: { value: [0, 0, 50], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
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

    expect(getWorkflowEffectiveDuration(emptyWf, project)).toBe(0)
    expect(getWorkflowEffectiveDuration(emptyWf, project, 'shot-1')).toBe(0)
    expect(getShotDuration(project, 'shot-1')).toBe(8)

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

    expect(rootLayers).toHaveLength(3)
    expect(rootLayers.map((l) => l.name)).toEqual(['Bầu trời đêm', 'Nhân vật Hiệp sĩ', 'Đom đóm sáng'])

    const charRoot = rootLayers.find((l) => l.name === 'Nhân vật Hiệp sĩ')!
    const meta = formatLayerNodeLabel(charRoot, project)
    expect(meta.icon).toBe('🧩')
    expect(meta.badgeLabel).toContain('2 layer con')
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

    expect(sceneNode.type).toBe('scene_shot')
    expect(sceneNode.title).toContain('Rừng Đom Đóm')
    expect(sceneNode.params?.shotId).toBe('shot-1')

    expect(childNodes).toHaveLength(3)
    expect(childNodes[0].type).toBe('layer_assembly')
    expect(childNodes[0].title).toContain('Bầu trời đêm')
    expect(childNodes[1].title).toContain('Hiệp sĩ 2.5D')
    expect(childNodes[2].title).toContain('Đom đóm sáng')

    expect(result.nodes).toHaveLength(8)
    expect(result.edges).toHaveLength(7)

    // Kiểm tra liên kết từ Node Cảnh tới Camera Director bên phải
    const camEdge = result.edges.find((e) => e.fromPort === 'scene_ctx' && e.toPort === 'scene_ctx')
    expect(camEdge).toBeDefined()
    expect(camEdge?.fromNode).toBe(sceneNode.id)

    // Kiểm tra liên kết phân cấp tầng cây Layer (layers_tree)
    const layerTreeEdges = result.edges.filter((e) => e.fromPort === 'layers_tree' && e.toPort === 'layers_tree')
    expect(layerTreeEdges).toHaveLength(3)
    for (const e of layerTreeEdges) {
      expect(e.fromNode).toBe(sceneNode.id)
      expect(childNodes.some((cn) => cn.id === e.toNode)).toBe(true)
    }

    // Kiểm tra liên kết điều khiển Tọa độ Transform vĩnh viễn (transform_link)
    const transformEdges = result.edges.filter((e) => e.fromPort === 'transform_link' && e.toPort === 'transform_link')
    expect(transformEdges).toHaveLength(3)
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

    const { workflow: wfAfterPhys, spawnedNode: physNode } = spawnLogicNodeIntoWorkflow(
      seededWf,
      'logic-physics-wind',
      'shot-1'
    )

    const edgeToPhys = wfAfterPhys.edges.find((e) => e.toNode === physNode.id)
    expect(edgeToPhys).toBeDefined()
    expect(edgeToPhys?.toPort).toBe('actors_rig')
    expect(childNodes.some((cn) => cn.id === edgeToPhys?.fromNode)).toBe(true)

    const { workflow: wfAfterCam, spawnedNode: camNode } = spawnLogicNodeIntoWorkflow(
      wfAfterPhys,
      'logic-cam-fly',
      'shot-1'
    )

    const edgeToCam = wfAfterCam.edges.find((e) => e.toNode === camNode.id)
    expect(edgeToCam).toBeDefined()
    expect(edgeToCam?.toPort).toBe('scene_ctx')
  })

  it('chống nhân đôi (Idempotency): bấm Bung Cảnh nhiều lần không tạo thêm Cảnh trùng lặp', () => {
    const project = createMockProject()
    const emptyWf: WorkflowGraph = {
      version: 1,
      id: 'wf-empty',
      name: 'Bản vẽ trống',
      description: '',
      nodes: [],
      edges: []
    }

    const { workflow: wf1 } = spawnSceneWithChildLayers(project, emptyWf, 'shot-1')
    expect(wf1.nodes.filter((n) => n.type === 'scene_shot')).toHaveLength(1)
    expect(wf1.nodes.filter((n) => n.type === 'camera_director')).toHaveLength(1)
    expect(wf1.nodes.filter((n) => n.type === 'layer_assembly')).toHaveLength(3)
    expect(wf1.nodes.filter((n) => n.type === 'layer_transform')).toHaveLength(3)
    expect(wf1.nodes).toHaveLength(8)

    const { workflow: wf2 } = spawnSceneWithChildLayers(project, wf1, 'shot-1')
    expect(wf2.nodes.filter((n) => n.type === 'scene_shot')).toHaveLength(1)
    expect(wf2.nodes.filter((n) => n.type === 'camera_director')).toHaveLength(1)
    expect(wf2.nodes.filter((n) => n.type === 'layer_assembly')).toHaveLength(3)
    expect(wf2.nodes.filter((n) => n.type === 'layer_transform')).toHaveLength(3)
    expect(wf2.nodes).toHaveLength(8)

    const { workflow: wf3 } = spawnSceneWithChildLayers(project, wf2, 'shot-1')
    expect(wf3.nodes.filter((n) => n.type === 'scene_shot')).toHaveLength(1)
    expect(wf3.nodes.filter((n) => n.type === 'camera_director')).toHaveLength(1)
    expect(wf3.nodes.filter((n) => n.type === 'layer_assembly')).toHaveLength(3)
    expect(wf3.nodes.filter((n) => n.type === 'layer_transform')).toHaveLength(3)
    expect(wf3.nodes).toHaveLength(8)
  })

  it('tắt Node Layer con (OFF) tự động ẩn Layer tương ứng trên Cảnh (visible = false) và chuyển dây actors_rig sang Layer đang bật', () => {
    const project = createMockProject()
    const baseWf = createDefaultWorkflow()
    const { workflow: wf, childNodes } = spawnSceneWithChildLayers(project, baseWf, 'shot-1')

    const skyNodeId = childNodes[0].id
    const knightNodeId = childNodes[1].id
    const disabledWf: WorkflowGraph = {
      ...wf,
      nodes: wf.nodes.map((n) =>
        n.id === skyNodeId || n.id === knightNodeId ? { ...n, enabled: false } : n
      )
    }

    applyWorkflowToProject(project, disabledWf)

    expect(project.layers.find((l) => l.id === 'layer-sky')?.visible).toBe(false)
    expect(project.layers.find((l) => l.id === 'layer-char-root')?.visible).toBe(false)
    expect(project.layers.find((l) => l.id === 'layer-char-head')?.visible).toBe(false)
    expect(project.layers.find((l) => l.id === 'layer-fireflies')?.visible).toBe(true)

    const reEnabledWf: WorkflowGraph = {
      ...disabledWf,
      nodes: disabledWf.nodes.map((n) =>
        n.id === skyNodeId ? { ...n, enabled: true } : n
      )
    }
    applyWorkflowToProject(project, reEnabledWf)
    expect(project.layers.find((l) => l.id === 'layer-sky')?.visible).toBe(true)
    const synced = ensureProjectWorkflow({ ...project, workflow: reEnabledWf })
    const { activeNodes } = resolveConnectedWorkflowNodes(synced)
    expect(activeNodes.some((n) => n.type === 'motion_choreography')).toBe(true)
  })

  it('thả Node từ thư viện với autoConnect=false tạo node độc lập không bị tự động nối dây', () => {
    const baseWf = createDefaultWorkflow()
    const edgeCountBefore = baseWf.edges.length
    const { workflow: nextWf, spawnedNode } = spawnLogicNodeIntoWorkflow(
      baseWf,
      'logic-cam-dolly',
      'shot-1',
      { autoConnect: false }
    )
    expect(nextWf.nodes.some((n) => n.id === spawnedNode.id)).toBe(true)
    // Sợi dây không bị tự động thêm vào
    expect(nextWf.edges.length).toBe(edgeCountBefore)
  })

  it('kết nối Node Camera DOF và Shake phản ánh chính xác lên camera mà không ghi đè lộ trình', () => {
    const project = createMockProject()
    const baseWf = createDefaultWorkflow()
    const { workflow: wfWithLayers, childNodes } = spawnSceneWithChildLayers(project, baseWf, 'shot-1')
    const charNode = childNodes[1] // layer-char-root, Z: 0

    // 1. Thêm Node DOF và nối vào layer nhân vật
    const { workflow: wfDof, spawnedNode: dofNode } = spawnLogicNodeIntoWorkflow(
      wfWithLayers,
      'logic-cam-dof',
      'shot-1',
      { autoConnect: false }
    )
    const connectedWf: WorkflowGraph = {
      ...wfDof,
      edges: [
        ...wfDof.edges,
        {
          id: 'edge-char-dof',
          fromNode: charNode.id,
          fromPort: 'actors_rig',
          toNode: dofNode.id,
          toPort: 'actors_rig'
        }
      ]
    }

    applyWorkflowToProject(project, connectedWf)
    expect(project.camera.dofEnabled).toBe(true)
    // Camera Z = -1484 (từ camera director pan_and_dolly), Character Z = 200 -> focus distance = 1684
    expect(project.camera.focusDistance.value).toBe(1684)

    // 2. Thêm Node Shake và kiểm tra rung lắc được áp dụng mà không làm mất DOF
    const { workflow: wfShake, spawnedNode: shakeNode } = spawnLogicNodeIntoWorkflow(
      connectedWf,
      'logic-cam-shake',
      'shot-1',
      { autoConnect: false }
    )
    const connectedShakeWf: WorkflowGraph = {
      ...wfShake,
      edges: [
        ...wfShake.edges,
        {
          id: 'edge-dof-shake',
          fromNode: dofNode.id,
          fromPort: 'camera_cut',
          toNode: shakeNode.id,
          toPort: 'camera_cut'
        }
      ]
    }
    applyWorkflowToProject(project, connectedShakeWf)
    expect(project.camera.dofEnabled).toBe(true)
    expect(project.camera.shakeAmount).toBeGreaterThan(0)
  })

  it('gom cụm composite 2.5D: consolidateCompositeWorkflowNodes gom các node con về 1 node duy nhất', () => {
    const project = createMockProject()
    // Giả lập workflow có 2 node layer tách rời cho 2 bộ phận của Hiệp sĩ 2.5D
    const fragmentedWf: WorkflowGraph = {
      version: 1,
      id: 'wf-frag',
      name: 'Fragmented',
      description: '',
      nodes: [
        createMockNode({
          id: 'wf-scene-shot-1',
          type: 'scene_shot',
          title: '🎬 Cảnh: Rừng Đom Đóm',
          position: { x: 80, y: 40 },
          params: { shotId: 'shot-1' }
        }),
        createMockNode({
          id: 'wf-layer-shot-1-layer-char-root',
          type: 'layer_assembly',
          title: 'Hiệp sĩ thân',
          position: { x: 80, y: 340 },
          params: { targetLayerIds: ['layer-char-root'], shotId: 'shot-1' }
        }),
        createMockNode({
          id: 'wf-trans-shot-1-layer-char-root',
          type: 'layer_transform',
          title: 'Tọa độ thân',
          position: { x: 80, y: 580 },
          params: { targetLayerIds: ['layer-char-root'], shotId: 'shot-1' }
        }),
        createMockNode({
          id: 'wf-layer-shot-1-layer-char-head',
          type: 'layer_assembly',
          title: 'Hiệp sĩ đầu',
          position: { x: 400, y: 340 },
          params: { targetLayerIds: ['layer-char-head'], shotId: 'shot-1' }
        }),
        createMockNode({
          id: 'wf-trans-shot-1-layer-char-head',
          type: 'layer_transform',
          title: 'Tọa độ đầu',
          position: { x: 400, y: 580 },
          params: { targetLayerIds: ['layer-char-head'], shotId: 'shot-1' }
        })
      ],
      edges: [
        {
          id: 'edge-sc-root',
          fromNode: 'wf-scene-shot-1',
          fromPort: 'layers_tree',
          toNode: 'wf-layer-shot-1-layer-char-root',
          toPort: 'layers_tree'
        },
        {
          id: 'edge-root-trans',
          fromNode: 'wf-layer-shot-1-layer-char-root',
          fromPort: 'transform_link',
          toNode: 'wf-trans-shot-1-layer-char-root',
          toPort: 'transform_link'
        },
        {
          id: 'edge-sc-head',
          fromNode: 'wf-scene-shot-1',
          fromPort: 'layers_tree',
          toNode: 'wf-layer-shot-1-layer-char-head',
          toPort: 'layers_tree'
        },
        {
          id: 'edge-head-trans',
          fromNode: 'wf-layer-shot-1-layer-char-head',
          fromPort: 'transform_link',
          toNode: 'wf-trans-shot-1-layer-char-head',
          toPort: 'transform_link'
        }
      ]
    }

    const { workflow: consolidatedWf, consolidatedCount } = consolidateCompositeWorkflowNodes(
      fragmentedWf,
      project
    )

    expect(consolidatedCount).toBe(1)
    const layerNodes = consolidatedWf.nodes.filter((n) => n.type === 'layer_assembly')
    expect(layerNodes.length).toBe(1)
    expect(layerNodes[0].params?.targetLayerIds).toEqual(['layer-char-root', 'layer-char-head'])
    expect(layerNodes[0].params?.isAssemblyRoot).toBe(true)
    expect(layerNodes[0].params?.assemblyKind).toBe('composite')
    expect(layerNodes[0].title).toContain('🧩 Cụm Lắp Ráp 2.5D: Hiệp sĩ 2.5D')

    const transNodes = consolidatedWf.nodes.filter((n) => n.type === 'layer_transform')
    expect(transNodes.length).toBe(1)
    expect(transNodes[0].params?.targetLayerIds).toEqual(['layer-char-root', 'layer-char-head'])
    expect(transNodes[0].params?.isAssemblyRoot).toBe(true)

    // Dây nối scene sang head bị loại bỏ, chỉ còn 1 dây scene sang root node
    const sceneEdges = consolidatedWf.edges.filter((e) => e.fromNode === 'wf-scene-shot-1')
    expect(sceneEdges.length).toBe(1)
  })

  it('syncMissingLayersToWorkflow: tự động gom cụm khi thêm cả cụm composite mới vào cảnh', () => {
    const project = createMockProject()
    // Bổ sung cụm Cây gồm 3 bộ phận vào project
    project.layers.push(
      {
        id: 'tree-part-1',
        name: '[Cây Đại Thụ] 1. Thân cây',
        type: 'image',
        shotId: 'shot-1',
        visible: true,
        locked: false,
        blendMode: 'normal',
        autoScale: false,
        inPoint: 0,
        outPoint: 16,
        composite: {
          instanceId: 'comp-tree-inst',
          compositeId: 'comp-tree',
          compositeName: 'Cây Đại Thụ',
          isRoot: true,
          lockedGroup: true
        },
        transform: {
          position: { value: [0, 0, 100], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
        },
        props: { assetId: 'trunk.png' }
      } as any,
      {
        id: 'tree-part-2',
        name: '[Cây Đại Thụ] 2. Tán lá',
        type: 'image',
        shotId: 'shot-1',
        visible: true,
        locked: false,
        blendMode: 'normal',
        autoScale: false,
        inPoint: 0,
        outPoint: 16,
        composite: {
          instanceId: 'comp-tree-inst',
          compositeId: 'comp-tree',
          compositeName: 'Cây Đại Thụ',
          isRoot: false,
          lockedGroup: true
        },
        transform: {
          position: { value: [0, 50, 120], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
        },
        props: { assetId: 'foliage.png' }
      } as any
    )

    const baseWf: WorkflowGraph = {
      version: 1,
      id: 'wf-base',
      name: 'Base',
      description: '',
      nodes: [
        createMockNode({
          id: 'wf-scene-shot-1',
          type: 'scene_shot',
          title: '🎬 Cảnh: Rừng Đom Đóm',
          position: { x: 80, y: 40 },
          params: { shotId: 'shot-1' }
        }),
        createMockNode({
          id: 'wf-layer-shot-1-sky',
          type: 'layer_assembly',
          title: 'Bầu trời',
          position: { x: 80, y: 340 },
          params: { targetLayerIds: ['layer-sky'], shotId: 'shot-1' }
        })
      ],
      edges: []
    }

    const res = syncMissingLayersToWorkflow(baseWf, project, 'shot-1')
    expect(res).not.toBeNull()
    if (!res) return

    // Cây có 2 parts nhưng chỉ sinh ĐÚNG 1 node layer_assembly đại diện cho cả cụm!
    const treeLayerNodes = res.workflow.nodes.filter(
      (n) => n.type === 'layer_assembly' && n.title.includes('Cây Đại Thụ')
    )
    expect(treeLayerNodes.length).toBe(1)
    expect(treeLayerNodes[0].params?.targetLayerIds).toEqual(['tree-part-1', 'tree-part-2'])
    expect(treeLayerNodes[0].params?.isAssemblyRoot).toBe(true)
    expect(treeLayerNodes[0].title).toBe('🧩 Cụm Lắp Ráp 2.5D: Cây Đại Thụ')

    // Chỉ có đúng 1 companion transform plate cho cụm cây
    const treeTransNodes = res.workflow.nodes.filter(
      (n) => n.type === 'layer_transform' && n.title.includes('Cây Đại Thụ')
    )
    expect(treeTransNodes.length).toBe(1)
  })

  it('hỗ trợ cụm Lắp ráp Mô hình 3D Modular: gom nhiều mặt/khối về 1 Node Root đại diện duy nhất', () => {
    const project = createMockProject()
    // Thêm 3 layer đại diện cho 3 mặt của cùng 1 mô hình nhà 3D (Tudor House)
    const houseFront: Layer = {
      id: 'house-front',
      name: '[Nhà Cổ] Mặt trước',
      type: 'image',
      visible: true,
      locked: false,
      shotId: 'shot-1',
      transform: {
        position: { value: [0, 0, 400] },
        rotation: { value: [0, 0, 0] },
        scale: { value: [1, 1, 1] },
        opacity: { value: 1 }
      },
      props: { assetId: 'wall-front-asset' },
      model3d: {
        instanceId: 'house-instance-1',
        modelId: 'tudor-house',
        modelName: 'Nhà Cổ Châu Âu',
        faceId: 'front'
      }
    }
    const houseSide: Layer = {
      id: 'house-side',
      name: '[Nhà Cổ] Mặt bên',
      type: 'image',
      visible: true,
      locked: false,
      shotId: 'shot-1',
      transform: {
        position: { value: [150, 0, 400] },
        rotation: { value: [0, 90, 0] },
        scale: { value: [1, 1, 1] },
        opacity: { value: 1 }
      },
      props: { assetId: 'wall-side-asset' },
      model3d: {
        instanceId: 'house-instance-1',
        modelId: 'tudor-house',
        modelName: 'Nhà Cổ Châu Âu',
        faceId: 'side'
      }
    }
    const houseRoof: Layer = {
      id: 'house-roof',
      name: '[Nhà Cổ] Mái ngói',
      type: 'image',
      visible: true,
      locked: false,
      shotId: 'shot-1',
      transform: {
        position: { value: [0, -180, 400] },
        rotation: { value: [45, 0, 0] },
        scale: { value: [1, 1, 1] },
        opacity: { value: 1 }
      },
      props: { assetId: 'roof-asset' },
      model3d: {
        instanceId: 'house-instance-1',
        modelId: 'tudor-house',
        modelName: 'Nhà Cổ Châu Âu',
        faceId: 'roof'
      }
    }
    project.layers.push(houseFront, houseSide, houseRoof)

    const rootLayers = getRootLayersForShot(project, 'shot-1')
    // rootLayers phải chỉ chứa đúng 1 đại diện cho mô hình nhà 3D
    const houseRoots = rootLayers.filter((l) => l.model3d?.instanceId === 'house-instance-1')
    expect(houseRoots).toHaveLength(1)

    const meta = formatLayerNodeLabel(houseRoots[0], project)
    expect(meta.icon).toBe('🏛️')
    expect(meta.title).toContain('🏛️ Cụm Lắp Ráp 3D: Nhà Cổ Châu Âu')
    expect(meta.badgeLabel).toContain('3D (3 mặt/khối con)')

    // Bung cảnh: chỉ sinh đúng 1 node Root đại diện cho cả 3 mặt của ngôi nhà
    const { workflow: spawnedWf, childNodes } = spawnSceneWithChildLayers(
      project,
      {
        version: 1,
        id: 'wf-test',
        name: 'Test',
        description: '',
        nodes: [],
        edges: []
      },
      'shot-1'
    )

    const houseNodes = childNodes.filter((n) => n.title.includes('Nhà Cổ Châu Âu'))
    expect(houseNodes).toHaveLength(1)
    expect(houseNodes[0].params?.isAssemblyRoot).toBe(true)
    expect(houseNodes[0].params?.assemblyKind).toBe('model3d')
    expect(houseNodes[0].params?.targetLayerIds).toEqual(['house-front', 'house-side', 'house-roof'])

    // Chỉ có đúng 1 companion transform plate cho cả mô hình nhà 3D
    const houseTrans = spawnedWf.nodes.filter(
      (n) => n.type === 'layer_transform' && n.title.includes('Nhà Cổ Châu Âu')
    )
    expect(houseTrans).toHaveLength(1)
    expect(houseTrans[0].params?.targetLayerIds).toEqual(['house-front', 'house-side', 'house-roof'])
  })

  it('relaxOverlappingPositions: triệt tiêu 100% hiện tượng chồng đè node', () => {
    const nodes = [
      {
        id: 'node-A',
        type: 'layer_assembly',
        title: 'Node A',
        enabled: true,
        position: { x: 100, y: 100 }
      },
      {
        id: 'node-B',
        type: 'layer_assembly',
        title: 'Node B',
        enabled: true,
        position: { x: 100, y: 120 } // Bị đè trực tiếp lên Node A
      }
    ] as any

    const initialPos = {
      'node-A': { x: 100, y: 100 },
      'node-B': { x: 100, y: 120 }
    }

    const relaxed = relaxOverlappingPositions(initialPos, nodes)
    const posA = relaxed['node-A']
    const posB = relaxed['node-B']

    // Node B phải bị đẩy xuống cách xa Node A tối thiểu chiều cao Node A + padding
    expect(posB.y).toBeGreaterThanOrEqual(posA.y + 200)
  })

  it('createClearedWorkflowWithSceneRoots: giữ lại node root Cảnh khi xóa sơ đồ', () => {
    const project = createMockProject()
    const populatedWf: WorkflowGraph = {
      version: 1,
      id: 'wf-demo',
      name: 'Luồng thử nghiệm',
      description: 'Test',
      nodes: [
        createMockNode({ id: 'wf-scene-shot-1', type: 'scene_shot', title: '🎬 Cảnh 1' }),
        createMockNode({ id: 'wf-cam-shot-1', type: 'camera_director', title: '🎥 Camera' }),
        createMockNode({ id: 'wf-layer-1', type: 'layer_assembly', title: 'Layer 1' })
      ],
      edges: [
        { id: 'edge-1', fromNode: 'wf-scene-shot-1', fromPort: 'scene_ctx', toNode: 'wf-cam-shot-1', toPort: 'scene_ctx' }
      ]
    }

    const cleared = createClearedWorkflowWithSceneRoots(populatedWf, project, 'shot-1')
    expect(cleared.edges).toHaveLength(0)
    expect(cleared.nodes).toHaveLength(1)
    expect(cleared.nodes[0].id).toBe('wf-scene-shot-1')
    expect(cleared.nodes[0].type).toBe('scene_shot')
    expect(cleared.nodes[0].position).toEqual({ x: 80, y: 40 })

    // Khi sơ đồ hoàn toàn trống, tự sinh node root Cảnh theo shot hiện tại
    const emptyWf: WorkflowGraph = {
      version: 1,
      id: 'wf-empty',
      name: 'Trống',
      description: '',
      nodes: [],
      edges: []
    }
    const recreated = createClearedWorkflowWithSceneRoots(emptyWf, project, 'shot-1')
    expect(recreated.nodes).toHaveLength(1)
    expect(recreated.nodes[0].type).toBe('scene_shot')
    expect(recreated.nodes[0].id).toBe('wf-scene-shot-1')
    expect(recreated.edges).toHaveLength(0)
  })
})

