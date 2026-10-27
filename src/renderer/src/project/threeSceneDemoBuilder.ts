import type { AssetMeta, ImageLayer, Project } from '@shared/types'
import { addKeyframe } from '../animation/keyframes'
import { createImageLayer, createProject, createShot, shotSpacing } from './factory'
import {
  attachExternalLayerToClusterV2,
  attachLogicNodeToLayerV2,
  saveClusterCustomAction,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  updateClusterMemberOffsetV2,
  v2ClusterLockId,
  v2LayerNodeId
} from './workflowV2Engine'

export interface DemoSceneAssetInput {
  id: string
  file: string
  name: string
  width: number
  height: number
  dataUrl?: string
}

function addSceneImageLayer(
  project: Project,
  assetMap: Map<string, AssetMeta>,
  assetId: string,
  shotId: string,
  opts: {
    id: string
    name?: string
    x: number
    y: number
    z: number
    scale?: number
    inPoint: number
    outPoint: number
    opacity?: number
  }
): ImageLayer {
  const meta = assetMap.get(assetId)
  if (!meta) throw new Error(`Missing demo asset: ${assetId}`)
  const layer = createImageLayer(meta, project.comp, opts.z, shotId)
  layer.id = opts.id
  if (opts.name) layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  const sc = opts.scale ?? 1
  layer.transform.scale.value = [sc, sc, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
  project.layers.push(layer)
  return layer
}

/**
 * Xây dựng Dự án Mẫu 3 Cảnh chuẩn Workflow V2:
 * - Cảnh 1 (0.0s – 5.0s): Cánh Đồng Gió Mùa (Khung cảnh Cánh đồng)
 * - Cảnh 2 (5.0s – 10.0s): Phòng Khách Ấm Áp (Khung cảnh Trong nhà)
 * - Cảnh 3 (10.0s – 15.0s): Phố Đêm Đèn Đường (Khung cảnh Ngoài đường)
 */
export function buildThreeSceneWorkflowV2Project(assetInputs: DemoSceneAssetInput[]): Project {
  const project = createProject({
    name: 'Hành Trình 3 Khung Cảnh — Workflow V2',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 15,
    background: '#0b1020'
  })

  const assetMap = new Map<string, AssetMeta>()
  for (const item of assetInputs) {
    const meta: AssetMeta = {
      id: item.id,
      name: item.name,
      kind: 'image',
      mime: 'image/svg+xml',
      width: item.width,
      height: item.height,
      path: `assets/scenes-v2/${item.file}`,
      assetPath: `scenes-v2/${item.file}`,
      ...(item.dataUrl ? { dataUrl: item.dataUrl } : {})
    }
    project.assets.push(meta)
    assetMap.set(item.id, meta)
  }

  const spacing = shotSpacing(project.comp)
  const shot1 = { ...createShot('Cánh Đồng Gió Mùa', [0, 0, 0], 0), id: 'shot-1' }
  const shot2 = { ...createShot('Phòng Khách Ấm Áp', [spacing, 0, 0], 1), id: 'shot-2' }
  const shot3 = { ...createShot('Phố Đêm Đèn Đường', [spacing * 2, 0, 0], 2), id: 'shot-3' }
  project.shots.push(shot1, shot2, shot3)

  // Lộ trình Camera 3 cảnh (0s-5s, 5s-10s, 10s-15s) với chuyển động mượt
  const refD = 1483.64
  addKeyframe(project.camera.position, 0.0, [0, 0, -refD], 'easeInOut')
  addKeyframe(project.camera.target, 0.0, [0, 0, 0], 'easeInOut')
  addKeyframe(project.camera.position, 4.7, [60, -15, -refD * 0.88], 'easeInOut')
  addKeyframe(project.camera.target, 4.7, [60, -15, 0], 'easeInOut')

  addKeyframe(project.camera.position, 5.0, [spacing, 0, -refD], 'easeInOut')
  addKeyframe(project.camera.target, 5.0, [spacing, 0, 0], 'easeInOut')
  addKeyframe(project.camera.position, 9.7, [spacing + 75, -20, -refD * 0.88], 'easeInOut')
  addKeyframe(project.camera.target, 9.7, [spacing + 75, -20, 0], 'easeInOut')

  addKeyframe(project.camera.position, 10.0, [spacing * 2, 0, -refD], 'easeInOut')
  addKeyframe(project.camera.target, 10.0, [spacing * 2, 0, 0], 'easeInOut')
  addKeyframe(project.camera.position, 15.0, [spacing * 2 + 90, -25, -refD * 0.86], 'easeInOut')
  addKeyframe(project.camera.target, 15.0, [spacing * 2 + 90, -25, 0], 'easeInOut')

  // ==========================================================================
  // CẢNH 1 (0.0s – 5.0s): CÁNH ĐỒNG GIÓ MÙA
  // ==========================================================================
  addSceneImageLayer(project, assetMap, 'asset-s1-sky', shot1.id, {
    id: 'layer-s1-sky',
    name: 'Bầu Trời Hoàng Hôn',
    x: 0,
    y: 0,
    z: 1200,
    scale: 1.92,
    inPoint: 0,
    outPoint: 5
  })
  addSceneImageLayer(project, assetMap, 'asset-s1-hills', shot1.id, {
    id: 'layer-s1-hills',
    name: 'Đồi Xa & Cối Xay Gió',
    x: 0,
    y: -115,
    z: 720,
    scale: 1.56,
    inPoint: 0,
    outPoint: 5
  })
  addSceneImageLayer(project, assetMap, 'asset-s1-field', shot1.id, {
    id: 'layer-s1-field',
    name: 'Cánh Đồng Lúa Vàng',
    x: 0,
    y: -215,
    z: 420,
    scale: 1.36,
    inPoint: 0,
    outPoint: 5
  })
  const oakTree = addSceneImageLayer(project, assetMap, 'asset-s1-oaktree', shot1.id, {
    id: 'layer-s1-oaktree',
    name: 'Cây Sồi Cổ Thụ',
    x: 35,
    y: -25,
    z: 240,
    scale: 0.95,
    inPoint: 0,
    outPoint: 5
  })

  // Cụm 2.5D: Cậu Bé Du Hành (Có 2 biến thể Khuôn mặt & 2 biến thể Tay phải)
  const instBoy = 'cluster-boy-s1'
  const boyStartX = -380
  const boyStartY = -95
  const boyStartZ = 320 // Z-Index = 680 (< 760 của Cây Sồi lúc xuất phát)
  const boyBody = addSceneImageLayer(project, assetMap, 'asset-s1-boy-body', shot1.id, {
    id: 'layer-s1-boy-body',
    name: 'Cậu Bé Du Hành — Thân & Áo Choàng',
    x: boyStartX,
    y: boyStartY,
    z: boyStartZ,
    scale: 0.88,
    inPoint: 0,
    outPoint: 5
  })
  boyBody.composite = {
    compositeId: 'comp-boy-s1',
    instanceId: instBoy,
    compositeName: 'Cậu Bé Du Hành',
    partGroupId: 'part-torso',
    slot: 'torso',
    variant: 'Thân & Áo Choàng',
    isRoot: true,
    lockedGroup: true,
    rootOffset: [0, 0, 0]
  }

  const boyFaceSmile = addSceneImageLayer(project, assetMap, 'asset-s1-boy-face-smile', shot1.id, {
    id: 'layer-s1-boy-face-smile',
    name: 'Khuôn Mặt — Tươi Cười',
    x: boyStartX,
    y: boyStartY + 108,
    z: boyStartZ - 4,
    scale: 0.88,
    inPoint: 0,
    outPoint: 5,
    opacity: 1
  })
  boyFaceSmile.composite = {
    compositeId: 'comp-boy-s1',
    instanceId: instBoy,
    compositeName: 'Cậu Bé Du Hành',
    partGroupId: 'part-head',
    slot: 'face',
    variant: 'Tươi cười',
    lockedGroup: true,
    rootOffset: [0, 108, -4]
  }

  const boyFaceWow = addSceneImageLayer(project, assetMap, 'asset-s1-boy-face-wow', shot1.id, {
    id: 'layer-s1-boy-face-wow',
    name: 'Khuôn Mặt — Hào Hứng',
    x: boyStartX,
    y: boyStartY + 108,
    z: boyStartZ - 4,
    scale: 0.88,
    inPoint: 0,
    outPoint: 5,
    opacity: 0
  })
  boyFaceWow.composite = {
    compositeId: 'comp-boy-s1',
    instanceId: instBoy,
    compositeName: 'Cậu Bé Du Hành',
    partGroupId: 'part-head',
    slot: 'face',
    variant: 'Hào hứng',
    lockedGroup: true,
    rootOffset: [0, 108, -4]
  }

  const boyArmWave = addSceneImageLayer(project, assetMap, 'asset-s1-boy-arm-wave', shot1.id, {
    id: 'layer-s1-boy-arm-wave',
    name: 'Tay Phải — Vẫy Chào',
    x: boyStartX + 58,
    y: boyStartY + 28,
    z: boyStartZ - 6,
    scale: 0.88,
    inPoint: 0,
    outPoint: 5,
    opacity: 1
  })
  boyArmWave.composite = {
    compositeId: 'comp-boy-s1',
    instanceId: instBoy,
    compositeName: 'Cậu Bé Du Hành',
    partGroupId: 'part-arm-right',
    slot: 'arm_r',
    variant: 'Vẫy chào',
    lockedGroup: true,
    rootOffset: [58, 28, -6]
  }

  const boyArmPoint = addSceneImageLayer(project, assetMap, 'asset-s1-boy-arm-point', shot1.id, {
    id: 'layer-s1-boy-arm-point',
    name: 'Tay Phải — Cầm Chong Chóng',
    x: boyStartX + 58,
    y: boyStartY + 28,
    z: boyStartZ - 6,
    scale: 0.88,
    inPoint: 0,
    outPoint: 5,
    opacity: 0
  })
  boyArmPoint.composite = {
    compositeId: 'comp-boy-s1',
    instanceId: instBoy,
    compositeName: 'Cậu Bé Du Hành',
    partGroupId: 'part-arm-right',
    slot: 'arm_r',
    variant: 'Cầm Chong Chóng',
    lockedGroup: true,
    rootOffset: [58, 28, -6]
  }

  const fgFlowers = addSceneImageLayer(project, assetMap, 'asset-s1-fg-flowers', shot1.id, {
    id: 'layer-s1-fg-flowers',
    name: 'Hoa Bồ Công Anh Tiền Cảnh',
    x: 0,
    y: -385,
    z: -80,
    scale: 1.04,
    inPoint: 0,
    outPoint: 5
  })

  // ==========================================================================
  // CẢNH 2 (5.0s – 10.0s): PHÒNG KHÁCH ẤM ÁP
  // ==========================================================================
  addSceneImageLayer(project, assetMap, 'asset-s2-room-wall', shot2.id, {
    id: 'layer-s2-wall',
    name: 'Tường Gỗ & Cửa Sổ Đêm Trăng',
    x: 0,
    y: 0,
    z: 950,
    scale: 1.74,
    inPoint: 5,
    outPoint: 10
  })
  addSceneImageLayer(project, assetMap, 'asset-s2-bookshelf', shot2.id, {
    id: 'layer-s2-bookshelf',
    name: 'Kệ Sách Gỗ & Ghế Sofa',
    x: -40,
    y: -65,
    z: 480,
    scale: 0.96,
    inPoint: 5,
    outPoint: 10
  })
  const teaLampTable = addSceneImageLayer(project, assetMap, 'asset-s2-lamp-table', shot2.id, {
    id: 'layer-s2-lamp-table',
    name: 'Bàn Trà & Đèn Bàn Ấm Áp',
    x: 220,
    y: -115,
    z: 220,
    scale: 0.92,
    inPoint: 5,
    outPoint: 10
  })

  // Cụm 2.5D: Mèo Máy Quản Gia + Đạo cụ Khay Trà Nóng kết nối vào cụm
  const instRobo = 'cluster-robo-s2'
  const roboStartX = -350
  const roboStartY = -115
  const roboStartZ = 160
  const roboBody = addSceneImageLayer(project, assetMap, 'asset-s2-robo-body', shot2.id, {
    id: 'layer-s2-robo-body',
    name: 'Mèo Máy Quản Gia — Thân Máy',
    x: roboStartX,
    y: roboStartY,
    z: roboStartZ,
    scale: 0.9,
    inPoint: 5,
    outPoint: 10
  })
  roboBody.composite = {
    compositeId: 'comp-robo-s2',
    instanceId: instRobo,
    compositeName: 'Mèo Máy Quản Gia',
    partGroupId: 'part-torso',
    slot: 'torso',
    variant: 'Thân Máy',
    isRoot: true,
    lockedGroup: true,
    rootOffset: [0, 0, 0]
  }

  const roboFaceHappy = addSceneImageLayer(project, assetMap, 'asset-s2-robo-face-happy', shot2.id, {
    id: 'layer-s2-robo-face-happy',
    name: 'Màn Hình Mặt — Mắt Cười',
    x: roboStartX,
    y: roboStartY + 102,
    z: roboStartZ - 4,
    scale: 0.9,
    inPoint: 5,
    outPoint: 10,
    opacity: 1
  })
  roboFaceHappy.composite = {
    compositeId: 'comp-robo-s2',
    instanceId: instRobo,
    compositeName: 'Mèo Máy Quản Gia',
    partGroupId: 'part-head',
    slot: 'face',
    variant: 'Mắt cười',
    lockedGroup: true,
    rootOffset: [0, 102, -4]
  }

  const roboFaceTalk = addSceneImageLayer(project, assetMap, 'asset-s2-robo-face-talk', shot2.id, {
    id: 'layer-s2-robo-face-talk',
    name: 'Màn Hình Mặt — Đang Nói',
    x: roboStartX,
    y: roboStartY + 102,
    z: roboStartZ - 4,
    scale: 0.9,
    inPoint: 5,
    outPoint: 10,
    opacity: 0
  })
  roboFaceTalk.composite = {
    compositeId: 'comp-robo-s2',
    instanceId: instRobo,
    compositeName: 'Mèo Máy Quản Gia',
    partGroupId: 'part-head',
    slot: 'face',
    variant: 'Đang nói',
    lockedGroup: true,
    rootOffset: [0, 102, -4]
  }

  const teaTrayProp = addSceneImageLayer(project, assetMap, 'asset-s2-tea-tray', shot2.id, {
    id: 'layer-s2-tea-tray',
    name: 'Khay Trà Nóng (Đạo Cụ)',
    x: roboStartX + 88,
    y: roboStartY + 12,
    z: roboStartZ - 8,
    scale: 0.85,
    inPoint: 5,
    outPoint: 10
  })

  // ==========================================================================
  // CẢNH 3 (10.0s – 15.0s): PHỐ ĐÊM ĐÈN ĐƯỜNG
  // ==========================================================================
  addSceneImageLayer(project, assetMap, 'asset-s3-city-sky', shot3.id, {
    id: 'layer-s3-city-sky',
    name: 'Bầu Trời Phố Đêm & Tòa Nhà Xa',
    x: 0,
    y: 0,
    z: 1150,
    scale: 1.88,
    inPoint: 10,
    outPoint: 15
  })
  addSceneImageLayer(project, assetMap, 'asset-s3-street-road', shot3.id, {
    id: 'layer-s3-street-road',
    name: 'Mặt Đường Nhựa & Vỉa Hè',
    x: 0,
    y: -185,
    z: 520,
    scale: 1.42,
    inPoint: 10,
    outPoint: 15
  })
  const streetLampTree = addSceneImageLayer(project, assetMap, 'asset-s3-lamp-tree', shot3.id, {
    id: 'layer-s3-lamp-tree',
    name: 'Cột Đèn Đường Neon & Cây Vỉa Hè',
    x: -45,
    y: -15,
    z: 250,
    scale: 0.94,
    inPoint: 10,
    outPoint: 15
  })
  const streetCrate = addSceneImageLayer(project, assetMap, 'asset-s3-crate', shot3.id, {
    id: 'layer-s3-crate',
    name: 'Thùng Hàng & Biển Báo Vỉa Hè',
    x: 110,
    y: -145,
    z: 170,
    scale: 0.92,
    inPoint: 10,
    outPoint: 15
  })
  const scooterRider = addSceneImageLayer(project, assetMap, 'asset-s3-scooter', shot3.id, {
    id: 'layer-s3-scooter',
    name: 'Tay Đua Scooter Điện',
    x: -380,
    y: -135,
    z: 310,
    scale: 0.9,
    inPoint: 10,
    outPoint: 15
  })

  // ==========================================================================
  // ĐỒNG BỘ ĐỒ THỊ WORKFLOW V2 & GẮN ĐẦY ĐỦ CÁC NODE LOGIC CHO 3 CẢNH
  // ==========================================================================
  project.workflow = syncWorkflowV2Graph(project)

  // --- CẢNH 1 LOGIC ---
  const boyClusterLockId = v2ClusterLockId(instBoy)

  // 1.1. Gắn Node Bộ phận chính (isPartHub) vào Cụm Cậu Bé Du Hành -> tự sinh 2 Node con Bộ phận: Khuôn mặt (2) & Tay phải (2)
  const boyPartHubRes = attachLogicNodeToLayerV2(
    project.workflow,
    boyClusterLockId,
    'part_swap',
    'v2:part_swap:part_group'
  )
  project.workflow = syncWorkflowV2Graph(project, boyPartHubRes.workflow)

  // Cấu hình Node con Bộ phận Khuôn mặt (Cậu Bé Du Hành): Đổi từ Tươi cười -> Hào hứng lúc 1.6s - 4.4s
  const boyFaceChildNode = project.workflow.nodes.find(
    (n) =>
      n.params?.isPartChild &&
      n.params?.instanceId === instBoy &&
      (n.params?.partGroupId === 'slot:face' || n.params?.partGroupId === 'part-head')
  )
  if (boyFaceChildNode) {
    boyFaceChildNode.title = 'Bộ phận: Khuôn mặt (2) — Đổi Hào hứng'
    syncWorkflowV2NodeToProject(project, boyFaceChildNode, {
      partActionMode: 'variant',
      swapSlot: 'face',
      swapTargetLayerId: boyFaceWow.id,
      swapVariant: boyFaceWow.id,
      timeStart: 1.6,
      timeEnd: 4.4
    })
  }

  // 1.2. Cấu hình Node con Bộ phận Tay phải (Cậu Bé Du Hành): Đổi từ Vẫy chào -> Cầm Chong Chóng lúc 2.0s - 4.6s
  const boyArmChildNode = project.workflow.nodes.find(
    (n) =>
      n.params?.isPartChild &&
      n.params?.instanceId === instBoy &&
      (n.params?.partGroupId === 'slot:arm_r' || n.params?.partGroupId === 'part-arm-right')
  )
  if (boyArmChildNode) {
    boyArmChildNode.title = 'Bộ phận: Tay phải (2) — Cầm Chong Chóng'
    syncWorkflowV2NodeToProject(project, boyArmChildNode, {
      partActionMode: 'variant',
      swapSlot: 'arm_r',
      swapTargetLayerId: boyArmPoint.id,
      swapVariant: boyArmPoint.id,
      timeStart: 2.0,
      timeEnd: 4.6
    })
  }

  // 1.3. Node Motion BBox #1 -> #2 cho Cụm Cậu Bé Du Hành:
  //      Đi theo đường ngắn nhất từ (-380, -95) sang (350, -60), phóng to dần 100% -> 145%,
  //      bật Chiều sâu Z-Index ('in_front' qua trước Cây Sồi Cổ Thụ: Z-Index 680 -> 820 > 760)
  const s1MotionRes = attachLogicNodeToLayerV2(
    project.workflow,
    boyClusterLockId,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 350,
      bboxTargetY: -60,
      bboxTargetScalePct: 145,
      depthMode: 'depth_z',
      depthRefLayerId: oakTree.id,
      depthRelation: 'in_front',
      bboxStartZ: 320,
      bboxTargetZ: 180,
      timeStart: 0.2,
      timeEnd: 4.6
    },
    'Motion: BBox #1 → #2 (To dần 145% · Qua trước Cây Sồi)'
  )
  project.workflow = s1MotionRes.workflow
  const s1MotionNode = project.workflow.nodes.find((n) => n.id === s1MotionRes.createdNodeId)
  if (s1MotionNode) {
    syncWorkflowV2NodeToProject(project, s1MotionNode)
  }

  // 1.4. Node Animation cho Cụm Cậu Bé Du Hành: Bước đi hào hứng
  saveClusterCustomAction(project, instBoy, {
    id: 'act-boy-happy-walk',
    name: 'Bước Đi Hào Hứng Trên Đồng',
    kind: 'rig_clip',
    layerIds: [boyBody.id, boyFaceWow.id, boyArmPoint.id],
    rigClipId: 'walk',
    speedHz: 1.4,
    duration: 4.4,
    loop: true
  })
  const s1AnimRes = attachLogicNodeToLayerV2(
    project.workflow,
    boyClusterLockId,
    'anim_fx',
    'v2:anim_fx:rig_walk',
    {
      customActionId: 'act-boy-happy-walk',
      customActionName: 'Bước Đi Hào Hứng Trên Đồng',
      rigActionPreset: 'walk',
      animFxPreset: 'pulse',
      intensity: 1.0,
      animFxSpeed: 1.3,
      customActionSpeedHz: 1.4,
      timeStart: 0.2,
      timeEnd: 4.6
    },
    'Animation: Bước Đi Hào Hứng Trên Đồng'
  )
  project.workflow = s1AnimRes.workflow
  const s1AnimNode = project.workflow.nodes.find((n) => n.id === s1AnimRes.createdNodeId)
  if (s1AnimNode) {
    syncWorkflowV2NodeToProject(project, s1AnimNode)
  }

  // 1.5. Node Vật liệu cho Cây Sồi Cổ Thụ & Hoa Tiền Cảnh
  const s1TreeMatRes = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(oakTree.id),
    'material',
    'v2:material:wood_tree'
  )
  project.workflow = s1TreeMatRes.workflow
  const s1TreeMatNode = project.workflow.nodes.find((n) => n.id === s1TreeMatRes.createdNodeId)
  if (s1TreeMatNode) syncWorkflowV2NodeToProject(project, s1TreeMatNode)

  const s1FlowerMatRes = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(fgFlowers.id),
    'material',
    'v2:material:foliage_leaf'
  )
  project.workflow = s1FlowerMatRes.workflow
  const s1FlowerMatNode = project.workflow.nodes.find((n) => n.id === s1FlowerMatRes.createdNodeId)
  if (s1FlowerMatNode) syncWorkflowV2NodeToProject(project, s1FlowerMatNode)

  // --- CẢNH 2 LOGIC ---
  const roboClusterLockId = v2ClusterLockId(instRobo)

  // 2.1. Kết nối Layer đạo cụ `Khay Trà Nóng` vào Cụm 2.5D `Mèo Máy Quản Gia`
  const roboLockNode = project.workflow.nodes.find((n) => n.id === roboClusterLockId)
  if (roboLockNode) {
    attachExternalLayerToClusterV2(project, [teaTrayProp.id], roboLockNode)
    updateClusterMemberOffsetV2(project, instRobo, teaTrayProp.id, {
      offsetX: 88,
      offsetY: 12,
      scalePct: 95,
      rotDeg: 0
    })
  }
  project.workflow = syncWorkflowV2Graph(project, project.workflow)

  // 2.2. Gắn Node Bộ phận chính vào Cụm Mèo Máy Quản Gia -> sinh Node con Bộ phận Khuôn mặt (2): Đổi Mắt cười -> Đang nói lúc 6.2s - 9.2s
  const roboPartHubRes = attachLogicNodeToLayerV2(
    project.workflow,
    roboClusterLockId,
    'part_swap',
    'v2:part_swap:part_group'
  )
  project.workflow = syncWorkflowV2Graph(project, roboPartHubRes.workflow)

  const roboFaceChildNode = project.workflow.nodes.find(
    (n) =>
      n.params?.isPartChild &&
      n.params?.instanceId === instRobo &&
      (n.params?.partGroupId === 'slot:face' || n.params?.partGroupId === 'part-head')
  )
  if (roboFaceChildNode) {
    roboFaceChildNode.title = 'Bộ phận: Khuôn mặt (2) — Đổi Đang nói'
    syncWorkflowV2NodeToProject(project, roboFaceChildNode, {
      partActionMode: 'variant',
      swapSlot: 'face',
      swapTargetLayerId: roboFaceTalk.id,
      swapVariant: roboFaceTalk.id,
      timeStart: 6.2,
      timeEnd: 9.2
    })
  }

  // 2.3. Node Motion BBox #1 -> #2 (Dạng 2: Đặt BBox #2 rồi Vẽ đường cong di chuyển)
  const s2MotionRes = attachLogicNodeToLayerV2(
    project.workflow,
    roboClusterLockId,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'custom_curve',
      customMotionPath: [
        [0.14, 0.66],
        [0.38, 0.34],
        [0.64, 0.72],
        [0.86, 0.52]
      ],
      bboxTargetX: 25,
      bboxTargetY: -98,
      bboxTargetScalePct: 92,
      depthMode: 'flat_2d',
      bboxStartZ: 160,
      bboxTargetZ: 160,
      timeStart: 5.3,
      timeEnd: 9.5
    },
    'Motion: BBox #1 ↝ #2 (Vẽ đường đi tới Bàn Trà)'
  )
  project.workflow = s2MotionRes.workflow
  const s2MotionNode = project.workflow.nodes.find((n) => n.id === s2MotionRes.createdNodeId)
  if (s2MotionNode) syncWorkflowV2NodeToProject(project, s2MotionNode)

  // 2.4. Node Ánh sáng 2.5D cho Bàn Trà & Đèn Bàn Ấm Áp
  const s2LightRes = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(teaLampTable.id),
    'light',
    'v2:light:candle',
    {
      lightMode: 'candle',
      lightColor: '#fbbf24',
      intensity: 1.35,
      timeStart: 5.0,
      timeEnd: 10.0
    },
    'Ánh sáng: Đèn Bàn Toả Sáng Ấm'
  )
  project.workflow = s2LightRes.workflow
  const s2LightNode = project.workflow.nodes.find((n) => n.id === s2LightRes.createdNodeId)
  if (s2LightNode) syncWorkflowV2NodeToProject(project, s2LightNode)

  // --- CẢNH 3 LOGIC ---
  // 3.1. Node Ánh sáng 2.5D cho Cột Đèn Đường Neon
  const s3LightRes = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(streetLampTree.id),
    'light',
    'v2:light:spot',
    {
      lightMode: 'spot',
      lightColor: '#38bdf8',
      intensity: 1.4,
      timeStart: 10.0,
      timeEnd: 15.0
    },
    'Ánh sáng: Đèn Đường Neon Xanh'
  )
  project.workflow = s3LightRes.workflow
  const s3LightNode = project.workflow.nodes.find((n) => n.id === s3LightRes.createdNodeId)
  if (s3LightNode) syncWorkflowV2NodeToProject(project, s3LightNode)

  // 3.2. Node Vật liệu cho Thùng Hàng & Biển Báo Vỉa Hè
  const s3CrateMatRes = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(streetCrate.id),
    'material',
    'v2:material:wood_tree'
  )
  project.workflow = s3CrateMatRes.workflow
  const s3CrateMatNode = project.workflow.nodes.find((n) => n.id === s3CrateMatRes.createdNodeId)
  if (s3CrateMatNode) syncWorkflowV2NodeToProject(project, s3CrateMatNode)

  // 3.3. Node Motion BBox #1 -> #2 cho Tay Đua Scooter Điện:
  //      Đi từ (-420, -135) tới (245, -140), phóng to dần 100% -> 135%,
  //      đi theo chiều sâu Z-Index vượt qua trước Cột Đèn & Cây Vỉa Hè,
  //      và va chạm đẩy lùi Thùng Hàng Vỉa Hè!
  const s3MotionRes = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(scooterRider.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 280,
      bboxTargetY: -135,
      bboxTargetScalePct: 135,
      depthMode: 'depth_z',
      depthRefLayerId: streetLampTree.id,
      depthRelation: 'in_front',
      bboxStartZ: 310,
      bboxTargetZ: 165,
      collisionOnPathEnabled: true,
      collisionTargetLayerId: streetCrate.id,
      collisionResponse: 'push',
      timeStart: 10.2,
      timeEnd: 14.5
    },
    'Motion: BBox #1 → #2 (To dần 135% · Đụng Thùng Hàng)'
  )
  project.workflow = s3MotionRes.workflow
  const s3MotionNode = project.workflow.nodes.find((n) => n.id === s3MotionRes.createdNodeId)
  if (s3MotionNode) syncWorkflowV2NodeToProject(project, s3MotionNode)

  // 3.4. Node Va chạm Vật lý chuyên biệt nối Tay Đua Scooter 💥 Thùng Hàng Vỉa Hè
  const s3ColRes = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(scooterRider.id),
    'collision',
    'v2:collision:elastic_bounce',
    {
      strikerLayerId: scooterRider.id,
      targetColliderLayerId: streetCrate.id,
      targetLayerIds: [scooterRider.id, streetCrate.id],
      collisionMode: 'heavy_punch',
      collisionForce: 1.25,
      deformIntensity: 0.72,
      timeStart: 13.6,
      timeEnd: 14.6
    },
    'Va chạm: Scooter 💥 Thùng Hàng Vỉa Hè'
  )
  project.workflow = s3ColRes.workflow
  const crateLayerNodeId = v2LayerNodeId(streetCrate.id)
  if (!project.workflow.edges.some((e) => e.fromNode === crateLayerNodeId && e.toNode === s3ColRes.createdNodeId)) {
    project.workflow.edges.push({
      id: `e-${crateLayerNodeId}-${s3ColRes.createdNodeId}`,
      fromNode: crateLayerNodeId,
      fromPort: 'layers_tree',
      toNode: s3ColRes.createdNodeId,
      toPort: 'layers_tree'
    })
  }
  const s3ColNode = project.workflow.nodes.find((n) => n.id === s3ColRes.createdNodeId)
  if (s3ColNode) syncWorkflowV2NodeToProject(project, s3ColNode)

  // Đồng bộ bố cục sơ đồ lần cuối
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}
