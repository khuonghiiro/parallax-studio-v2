import { getActiveLayerAssemblySession } from '../layerAssembly/layerAssemblyBridge'
import { inferFallbackBoneForStackedLayer } from '../layerAssembly/mohoRigHelpers'
import { getBoundLayersForBone } from '../layerAssembly/spineRigWorkflow'
import { analyzeCutoutParts } from '../layerAssembly/workshopCutoutRig'
import { getActiveAssemblySession } from '../assets/models3d/assemblyBridge'
import { useLoopAnimator } from '../loopAnimator/loopAnimatorState'
import { useView } from '../../store/view'

export interface Scanned25DPartInfo {
  id: string
  name: string
  orderIndex: number
  roleLabel: string
  roleIcon: string
  x: number
  y: number
  z: number
  scale: number
  rotation: number
  opacity: number
  boneId: string | null
  boneName: string | null
  bindingMode: 'rigid' | 'soft'
  isSelected: boolean
  assetPath: string
}

export interface Scanned25DBoneInfo {
  id: string
  name: string
  parentId: string | null
  parentName: string | null
  x: number
  y: number
  length: number
  angle: number
  pin: boolean
  isSelected: boolean
  boundLayerNames: string[]
}

export interface AiWorkshopContext {
  workshopType: 'layer_assembly_25d' | 'assembly_3d' | 'loop_animator' | 'photo_editor' | 'audio_studio' | 'general'
  workshopTitle: string
  modelName: string
  modelId: string
  canvasSize?: string
  primaryModeLabel?: string
  activeTabLabel?: string
  totalLayers?: number
  totalBones?: number
  selectedPart?: Scanned25DPartInfo | null
  selectedBone?: Scanned25DBoneInfo | null
  scannedParts: Scanned25DPartInfo[]
  scannedBones: Scanned25DBoneInfo[]
  extraSummaryLines?: string[]
}

const REGION_FRIENDLY_NAMES: Record<string, string> = {
  toolbar: 'Thanh công cụ trên cùng (Toolbar)',
  toolbar_left: 'Cụm Menu Tệp / Thêm Layer / Xưởng sáng tạo',
  toolbar_doc: 'Tiêu đề Dự án (Composition)',
  toolbar_actions: 'Cụm Tiện ích & Xuất Video',
  left_panel: 'Bảng Tài nguyên & Phân cảnh bên trái',
  assets: 'Kho Tài nguyên (Assets)',
  shots: 'Danh sách Phân cảnh (Shots)',
  viewer: 'Khung nhìn Sân khấu chính (Viewer 2.5D/3D)',
  viewer_stage2d: 'Sân khấu 2D tổng thể (Animate Camera Stage)',
  inspector: 'Bảng Thuộc tính bên phải (Inspector)',
  timeline: 'Khung Dòng thời gian (Timeline)',
  timeline_workflow: 'Bảng Sơ đồ Node (Workflow V2)',
  workflow_canvas: 'Sân khấu kéo thả Node (Workflow Canvas)',
  workflow_inspector: 'Cột Cấu hình Node Workflow',
  layer_assembly: 'Xưởng Lắp Ráp Layer & Rigging 2.5D',
  layer_assembly_workspace: 'Không gian làm việc Xưởng Lắp Ráp 2.5D',
  layer_assembly_sidebar: 'Cột Kho & Mẫu Xưởng Lắp Ráp 2.5D',
  layer_assembly_viewport_2d: 'Sân khấu 2D/2.5D (Xưởng Lắp Ráp Layer)',
  layer_assembly_viewport_3d: 'Sân khấu Không gian 3D (Xưởng Lắp Ráp Layer)',
  layer_assembly_cutout_stage: 'Sân khấu Gắn Xương Theo Bộ Phận 2.5D (Cutout Rig)',
  layer_assembly_cutout_hud: 'Thanh điều khiển Bộ phận 2.5D nổi (Cutout HUD)',
  layer_assembly_inspector: 'Cột Thuộc tính & Công cụ (Xưởng Lắp Ráp 2.5D)',
  layer_assembly_layers: 'Danh sách Lớp / Bộ phận 2.5D',
  layer_assembly_parts: 'Bảng Bộ phận & Biến thể 2.5D',
  layer_assembly_properties: 'Thuộc tính Тоạ độ & Chiều sâu 2.5D',
  layer_assembly_rig_panel: 'Bảng Tạo Xương & Ràng buộc 2.5D',
  layer_assembly_rig_tools: 'Thanh Công cụ Vẽ & Chỉnh Xương (Moho Rig)',
  layer_assembly_bone_tree: 'Cây Phân cấp Xương 2.5D',
  layer_assembly_bone_inspector: 'Chi tiết Khớp Xương đang chọn',
  layer_assembly_animation_panel: 'Bảng Hoạt ảnh Nhân vật 2.5D (Animation)',
  layer_assembly_dopesheet: 'Dòng thời gian Keyframe Xương (Dopesheet)',
  layer_assembly_cutter: 'Xưởng Cắt Tách Mảnh Ảnh (Sprite Cutter)',
  layer_assembly_mixamo_studio: 'Studio Dựng Dáng & Chuyển Động Mixamo 2.5D',
  assembly_3d: 'Xưởng Lắp Ráp Mô Hình 3D',
  assembly_viewport: 'Khung nhìn 3D (Xưởng Mô Hình 3D)',
  loop_animator: 'Xưởng Hoạt Ảnh Lặp (Loop Sprite Animator)',
  photo_editor: 'Xưởng Tách Nền & Chỉnh Sửa Ảnh (Photo Studio)',
  audio_studio: 'Phòng Thu Âm Thanh & Bàn Trộn Mixer',
  manifest_dialog: 'Quản Lý Manifest Tài Nguyên & Khôi Phục File',
  export: 'Hộp thoại Xuất Video MP4'
}

const DIALOG_FRIENDLY_NAMES: Record<string, string> = {
  layer_assembly: 'Xưởng Lắp Ráp Layer & Rigging 2.5D',
  create_3d: 'Xưởng Mô Hình 3D',
  loop_animator: 'Xưởng Hoạt Ảnh Lặp (Loop Animator)',
  photo_editor: 'Xưởng Tách Nền & Chỉnh Sửa Ảnh (Photo Studio)',
  audio: 'Phòng Thu Âm Thanh & Mixer',
  manifest: 'Quản Lý Manifest Tài Nguyên',
  export: 'Xuất Video MP4',
  mcp: 'Cấu Hình Kết Nối AI (MCP)',
  remote: 'Điều Khiển Qua Điện Thoại (QR Remote)',
  performance: 'Cấu Hình Hiệu Năng & GPU',
  path: 'Lộ Trình Camera 3D',
  sketch: 'Vẽ Đường Bay Camera'
}

const TAB_LABELS: Record<string, string> = {
  layers: 'Các lớp 2.5D (Layers & Bố cục)',
  bones: 'Tạo xương (Moho Rigging)',
  animation: 'Hoạt ảnh (Animate & Keyframe)',
  plant: 'Chuyển động Gió / Thực vật',
  loop: 'Hoạt ảnh lặp (Loop Sprite)'
}

export function formatFriendlyRegionLabel(region: string | null | undefined): string {
  if (!region || region === 'general_view') return 'Khung giao diện chung'
  return REGION_FRIENDLY_NAMES[region] || `Vùng giao diện (${region})`
}

export function formatFriendlyDialogLabel(dialog: string | null | undefined): string {
  if (!dialog) return 'Màn hình chính (Main Studio)'
  return DIALOG_FRIENDLY_NAMES[dialog] || dialog
}

export function buildScanned25DPartInfo(layerId: string): Scanned25DPartInfo | null {
  const session = getActiveLayerAssemblySession()
  if (!session) return null
  const composite = session.getComposite()
  if (!composite?.layers?.length) return null

  const idx = composite.layers.findIndex((l) => l.id === layerId)
  if (idx < 0) return null
  const layer = composite.layers[idx]

  const cutoutParts = analyzeCutoutParts(composite.layers)
  const partMeta = cutoutParts.find((p) => p.layer.id === layerId)
  const bones = composite.rig?.bones || []
  const effectiveBoneId =
    layer.boneId ||
    (composite.layers.length > 1 && bones.length > 0
      ? inferFallbackBoneForStackedLayer(layer, composite.layers, bones, 64)
      : undefined)
  const boundBone = effectiveBoneId ? bones.find((b) => b.id === effectiveBoneId) || null : null
  const selectedIds = session.getSelectedLayerIds?.() || []
  const isSelected = session.getSelectedLayerId() === layer.id || selectedIds.includes(layer.id)

  return {
    id: layer.id,
    name: layer.name || `Bộ phận #${idx + 1}`,
    orderIndex: idx + 1,
    roleLabel: partMeta?.roleLabel || 'Bộ phận 2.5D',
    roleIcon: partMeta?.roleIcon || '🧩',
    x: Math.round(layer.x || 0),
    y: Math.round(layer.y || 0),
    z: Math.round(layer.z || 0),
    scale: Number((layer.scale ?? 1).toFixed(2)),
    rotation: Math.round(layer.rotation || 0),
    opacity: Number((layer.opacity ?? 1).toFixed(2)),
    boneId: effectiveBoneId || null,
    boneName: boundBone?.name || null,
    bindingMode: layer.bindingMode === 'soft' || (layer.extraBoneIds?.length ?? 0) > 0 ? 'soft' : 'rigid',
    isSelected,
    assetPath: layer.asset || layer.assetPath || (layer.imageUrl ? 'Ảnh cắt trực tiếp (Data URL)' : 'Chưa gắn ảnh')
  }
}

export function buildScanned25DBoneInfo(boneId: string): Scanned25DBoneInfo | null {
  const session = getActiveLayerAssemblySession()
  if (!session) return null
  const composite = session.getComposite()
  const bones = composite?.rig?.bones || []
  const bone = bones.find((b) => b.id === boneId)
  if (!bone) return null

  const parentBone = bone.parentId ? bones.find((b) => b.id === bone.parentId) || null : null
  const boundEntries = getBoundLayersForBone(bone.id, composite.layers || [], bones)

  return {
    id: bone.id,
    name: bone.name || bone.id,
    parentId: bone.parentId || null,
    parentName: parentBone?.name || null,
    x: Math.round(bone.x || 0),
    y: Math.round(bone.y || 0),
    length: Math.round(bone.length || 0),
    angle: Math.round(bone.angle || 0),
    pin: Boolean(bone.pin),
    isSelected: session.getSelectedBoneId?.() === bone.id,
    boundLayerNames: boundEntries.map((entry) => entry.layer.name)
  }
}

/**
 * Thu thập ngữ cảnh chuyên sâu của Xưởng đang mở (đặc biệt là Xưởng Lắp Ráp 2.5D và các bộ phận trên sân khấu 2D/3D).
 */
export function extractActiveWorkshopContext(
  box: { left: number; top: number; width: number; height: number },
  matchedElements: Element[]
): AiWorkshopContext | null {
  // 1. Kiểm tra Xưởng Lắp Ráp Layer & Rigging 2.5D
  const laSession = getActiveLayerAssemblySession()
  if (laSession) {
    const composite = laSession.getComposite()
    const primaryMode = laSession.getPrimaryMode?.() || 'assembly'
    const tab = laSession.getTab?.() || 'layers'
    const selectedLayerId = laSession.getSelectedLayerId()
    const selectedBoneId = laSession.getSelectedBoneId?.() || null

    const partIds = new Set<string>()
    const boneIds = new Set<string>()

    // a) Lấy các bộ phận & xương từ các phần tử DOM đã quét trúng
    for (const el of matchedElements) {
      const layerEl = el.closest?.('[data-layer-id]') || (el.hasAttribute?.('data-layer-id') ? el : null)
      const lid = layerEl?.getAttribute?.('data-layer-id')
      if (lid) partIds.add(lid)

      const boneEl = el.closest?.('[data-bone-id]') || (el.hasAttribute?.('data-bone-id') ? el : null)
      const bid = boneEl?.getAttribute?.('data-bone-id')
      if (bid) boneIds.add(bid)
    }

    // b) Nếu quét trên Sân khấu 3D (.layer-workshop-3d-viewport), gọi hàm chiếu 3D sang 2D Screen Box
    if ( typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
      const viewports3D = Array.from(document.querySelectorAll('.layer-workshop-3d-viewport'))
      for (const vp of viewports3D) {
        const vpRect = vp.getBoundingClientRect()
        if (vpRect.width <= 0 || vpRect.height <= 0) continue
        const boxRight = box.left + Math.max(4, box.width)
        const boxBottom = box.top + Math.max(4, box.height)
        const intersectsVp = !(
          vpRect.right < box.left ||
          vpRect.left > boxRight ||
          vpRect.bottom < box.top ||
          vpRect.top > boxBottom
        )
        if (intersectsVp && typeof (vp as any).__pxsQuery3DLayersInBox === 'function') {
          try {
            const hits3D = (vp as any).__pxsQuery3DLayersInBox(box) as Array<{ layer: { id: string } }>
            for (const h of hits3D.slice(0, 8)) {
              if (h?.layer?.id) partIds.add(h.layer.id)
            }
          } catch {
            /* ignore projection error */
          }
        }
      }
    }

    // c) Nếu quét vào vùng Sân khấu 2D/3D mà chưa trúng riêng phần tử con nào, bổ sung bộ phận đang chọn hoặc top bộ phận hiển thị
    if (partIds.size === 0 && selectedLayerId) {
      partIds.add(selectedLayerId)
    }

    const scannedParts: Scanned25DPartInfo[] = []
    for (const pid of partIds) {
      const info = buildScanned25DPartInfo(pid)
      if (info) {
        scannedParts.push(info)
        if (info.boneId) boneIds.add(info.boneId)
      }
    }

    if (boneIds.size === 0 && selectedBoneId) {
      boneIds.add(selectedBoneId)
    }

    const scannedBones: Scanned25DBoneInfo[] = []
    for (const bid of boneIds) {
      const bInfo = buildScanned25DBoneInfo(bid)
      if (bInfo) scannedBones.push(bInfo)
    }

    const selectedPart = selectedLayerId ? buildScanned25DPartInfo(selectedLayerId) : null
    const selectedBone = selectedBoneId ? buildScanned25DBoneInfo(selectedBoneId) : null

    return {
      workshopType: 'layer_assembly_25d',
      workshopTitle: 'Xưởng Lắp Ráp Layer & Rigging 2.5D',
      modelName: composite.name || 'Mẫu 2.5D chưa đặt tên',
      modelId: composite.id,
      canvasSize: `${composite.width || 600} × ${composite.height || 600} px`,
      primaryModeLabel: primaryMode === 'cutter' ? 'Cắt tách Sprite (Cutter)' : 'Lắp ráp & Rigging 2.5D',
      activeTabLabel: TAB_LABELS[tab] || tab,
      totalLayers: composite.layers.length,
      totalBones: composite.rig?.bones?.length || 0,
      selectedPart,
      selectedBone,
      scannedParts,
      scannedBones
    }
  }

  // 2. Kiểm tra Xưởng Mô Hình 3D
  const asm3d = getActiveAssemblySession()
  if (asm3d) {
    const model = asm3d.getModel()
    const selFaceId = asm3d.getSelectedFaceId()
    const selFace = model.faces.find((f) => f.id === selFaceId) || null
    const extra: string[] = [
      `Tổng số mặt 3D: ${model.faces.length} mặt · Tỷ lệ: ${model.scale ?? 1}`
    ]
    if (selFace) {
      extra.push(
        `Mặt 3D đang chọn: "${selFace.name}" (${selFace.id}) · Kích thước: ${selFace.width}×${selFace.height}`
      )
    }
    return {
      workshopType: 'assembly_3d',
      workshopTitle: 'Xưởng Lắp Ráp Mô Hình 3D',
      modelName: model.name,
      modelId: model.id,
      scannedParts: [],
      scannedBones: [],
      extraSummaryLines: extra
    }
  }

  // 3. Kiểm tra Xưởng Hoạt Ảnh Lặp (Loop Animator)
  const viewState = useView.getState()
  if (viewState.dialog === 'loop_animator') {
    const loopState = useLoopAnimator.getState()
    return {
      workshopType: 'loop_animator',
      workshopTitle: 'Xưởng Hoạt Ảnh Lặp (Loop Sprite Animator)',
      modelName: loopState.layerName || 'Hoạt ảnh Loop',
      modelId: loopState.activePresetId || 'custom_loop',
      scannedParts: [],
      scannedBones: [],
      extraSummaryLines: [
        `Chủ đề: ${loopState.category} · Chế độ cắt: ${loopState.slicerMode}`,
        `Số khung hình (Frames): ${loopState.frames.length} frames · Tốc độ: ${loopState.playback.fps} FPS (${loopState.playback.loopMode})`
      ]
    }
  }

  return null
}
