import { getActiveLayerAssemblySession } from '../layerAssembly/layerAssemblyBridge'
import { inferFallbackBoneForStackedLayer } from '../layerAssembly/mohoRigHelpers'
import { getBoundLayersForBone } from '../layerAssembly/spineRigWorkflow'
import { analyzeCutoutParts } from '../layerAssembly/workshopCutoutRig'
import { getActiveAssemblySession } from '../assets/models3d/assemblyBridge'
import { useLoopAnimator } from '../loopAnimator/loopAnimatorState'
import { useView } from '../../store/view'
import {
  detectNestedLayerAssemblySubModal,
  extractOtherDialogOrWorkshopContext
} from './aiUiInspectorDialogContext'

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
  screenBounds?: { left: number; top: number; width: number; height: number } | null
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
  workshopType:
    | 'layer_assembly_25d'
    | 'assembly_3d'
    | 'loop_animator'
    | 'photo_editor'
    | 'audio_studio'
    | 'general'
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
  relatedFiles?: string[]
  extraSummaryLines?: string[]
}

const REGION_FRIENDLY_NAMES: Record<string, string> = {
  toolbar: 'Thanh công cụ trên cùng (Toolbar)',
  toolbar_left: 'Cụm Menu Tệp / Thêm Layer / Xưởng sáng tạo',
  toolbar_doc: 'Tiêu đề Dự án (Composition)',
  toolbar_actions: 'Cụm Tiện ích & Xuất Video',
  mcp_chip: 'Nút Trạng thái Kết nối AI (MCP Chip)',
  remote_chip: 'Nút Điều khiển Điện thoại QR (Mobile Remote Chip)',
  manifest_chip: 'Nút Quản lý Manifest Tài nguyên',
  left_panel: 'Bảng Tài nguyên & Phân cảnh bên trái',
  left_tabs: 'Dải Tab Cột Trái (Phân cảnh / Tài nguyên / Sơ đồ 2.5D)',
  assets: 'Kho Tài nguyên (Assets)',
  asset_subtabs: 'Dải Sub-Tab Kho Tài nguyên',
  asset_grid: 'Lưới Thẻ Tài nguyên (Asset Grid)',
  asset_bar: 'Thanh Chủ đề Tài nguyên',
  assets_loop: 'Kho Tài nguyên Hoạt ảnh Lặp (Loop Assets)',
  music: 'Kho Âm nhạc & Nhạc nền',
  shots: 'Danh sách Phân cảnh (Shots)',
  topview: 'Sơ đồ Chiều sâu 2.5D (Top / Side View)',
  viewer: 'Khung nhìn Sân khấu chính (Viewer 2.5D/3D)',
  viewer_canvas: 'Canvas 3D WebGL chính',
  viewer_hud: 'HUD Thông số Khung nhìn 3D',
  viewer_tools: 'Thanh công cụ Khung nhìn 3D',
  viewer_3d_presets: 'Cụm Góc nhìn 3D nhanh',
  viewer_stage2d: 'Sân khấu 2D tổng thể (Animate Camera Stage)',
  inspector: 'Bảng Thuộc tính bên phải (Inspector)',
  inspector_tabs: 'Dải Tab Thuộc tính (Inspector Tabs)',
  inspector_body: 'Nội dung Thuộc tính (Inspector Body)',
  inspector_composite: 'Cấu hình Nhóm Lắp Ráp 2.5D (Composite)',
  inspector_physics: 'Cấu hình Vật lý & Va chạm 2.5D',
  inspector_virtual_light: 'Cấu hình Ánh sáng Ảo 2.5D',
  inspector_loop_logic: 'Cấu hình Logic Hoạt ảnh Lặp (Loop Logic)',
  timeline: 'Khung Dòng thời gian (Timeline)',
  timeline_tabs: 'Chuyển chế độ Timeline / Workflow V2',
  timeline_toolbar: 'Thanh công cụ Timeline',
  timeline_tracks: 'Danh sách Rãnh Layer trên Timeline',
  timeline_workflow: 'Bảng Sơ đồ Node (Workflow V2)',
  workflow_toolbar: 'Thanh công cụ Workflow V2',
  workflow_palette: 'Bảng Thêm Node Workflow V2',
  workflow_canvas: 'Sân khấu kéo thả Node (Workflow Canvas)',
  workflow_canvas_hud: 'Cụm điều khiển nổi trên Workflow Canvas',
  workflow_inspector: 'Cột Cấu hình Node Workflow',
  workflow_node_config: 'Hộp thoại Cấu hình Node Workflow V2',
  layer_assembly: 'Xưởng Lắp Ráp Layer & Rigging 2.5D',
  layer_assembly_workspace: 'Không gian làm việc Xưởng Lắp Ráp 2.5D',
  layer_assembly_sidebar: 'Cột Kho & Mẫu Xưởng Lắp Ráp 2.5D',
  layer_assembly_toolbar: 'Thanh công cụ Xưởng Lắp Ráp 2.5D',
  layer_assembly_viewport_2d: 'Sân khấu 2D/2.5D (Xưởng Lắp Ráp Layer)',
  layer_assembly_viewport_3d: 'Sân khấu Không gian 3D (Xưởng Lắp Ráp Layer)',
  layer_assembly_cutout_stage: 'Sân khấu Gắn Xương Theo Bộ Phận 2.5D (Cutout Rig)',
  layer_assembly_cutout_hud: 'Thanh điều khiển Bộ phận 2.5D nổi (Cutout HUD)',
  layer_assembly_inspector: 'Cột Thuộc tính & Công cụ (Xưởng Lắp Ráp 2.5D)',
  layer_assembly_layers: 'Danh sách Lớp / Bộ phận 2.5D',
  layer_assembly_parts: 'Bảng Bộ phận & Biến thể 2.5D',
  layer_assembly_properties: 'Thuộc tính Toạ độ & Chiều sâu 2.5D',
  layer_assembly_rig_panel: 'Bảng Tạo Xương & Ràng buộc 2.5D',
  layer_assembly_rig_tools: 'Thanh Công cụ Vẽ & Chỉnh Xương (Moho Rig)',
  layer_assembly_bone_tree: 'Cây Phân cấp Xương 2.5D',
  layer_assembly_bone_inspector: 'Chi tiết Khớp Xương đang chọn',
  layer_assembly_animation_panel: 'Bảng Hoạt ảnh Nhân vật 2.5D (Animation)',
  layer_assembly_dopesheet: 'Dòng thời gian Keyframe Xương (Dopesheet)',
  layer_assembly_cutter: 'Xưởng Cắt Tách Mảnh Ảnh (Sprite Cutter)',
  layer_assembly_mixamo_studio: 'Studio Dựng Dáng & Chuyển Động Mixamo 2.5D',
  layer_assembly_clip_json: 'Hộp thoại Trao đổi JSON Hoạt ảnh Clip & Gió 2.5D',
  layer_assembly_swap: 'Hộp thoại Thay thế Bộ phận 2.5D (Part Swap)',
  layer_assembly_retarget: 'Hộp thoại Retarget Chuyển động 2.5D',
  layer_assembly_create: 'Hộp thoại Tạo Mẫu Lắp Ráp 2.5D mới',
  assembly_3d: 'Xưởng Lắp Ráp Mô Hình 3D',
  assembly_sidebar: 'Cột Mẫu & Tài nguyên 3D',
  assembly_viewport: 'Khung nhìn 3D (Xưởng Mô Hình 3D)',
  assembly_inspector: 'Cột Thuộc tính Mặt 3D (Face Inspector)',
  loop_animator: 'Xưởng Hoạt Ảnh Lặp (Loop Sprite Animator)',
  loop_animator_header: 'Thanh Tiêu đề Xưởng Hoạt Ảnh Lặp',
  loop_animator_source: 'Khung Ảnh Gốc & Lưới Cắt (Loop Source Pane)',
  loop_animator_player: 'Khung Phát Thử Hoạt Ảnh Lặp (Loop Player Pane)',
  loop_animator_stage: 'Sân khấu Xem trước Loop Animator',
  loop_animator_settings: 'Bảng Thông số Cắt & Tốc độ Loop',
  loop_animator_chroma: 'Thanh Tách nền Chroma Key (Loop Animator)',
  loop_animator_frames: 'Dải Khung hình Đã cắt (Loop Frame Strip)',
  loop_animator_align_studio: 'Studio Căn chỉnh Tâm Khung hình Loop',
  photo_editor: 'Xưởng Tách Nền & Chỉnh Sửa Ảnh (Photo Studio)',
  photo_editor_toolbar: 'Thanh công cụ Photo Studio',
  photo_editor_canvas: 'Khung vẽ Chỉnh sửa Ảnh (Photo Studio Canvas)',
  photo_editor_left_rail: 'Cột Công cụ Tách nền Trái (Photo Studio Left Rail)',
  photo_editor_right_rail: 'Cột Thông số & Chỉnh màu Phải (Photo Studio Right Rail)',
  photo_editor_save_modal: 'Hộp thoại Lưu Ảnh Tách Nền (Photo Studio Save)',
  audio_studio: 'Phòng Thu Âm Thanh & Bàn Trộn Mixer',
  audio_studio_sidebar: 'Danh sách Rãnh Âm thanh (Audio Track List)',
  audio_studio_waveform: 'Khung Sóng âm & Cắt nhạc (Audio Waveform)',
  audio_studio_tone: 'Bảng Chỉnh Âm sắc EQ (Audio Tone)',
  audio_studio_mixer: 'Bàn Trộn Âm lượng Đa kênh (Audio Mixer)',
  manifest_dialog: 'Quản Lý Manifest Tài Nguyên & Khôi Phục File',
  manifest_sidebar: 'Cột Phân hệ Manifest JSON',
  manifest_categories: 'Bảng Quản lý Chủ đề Manifest',
  manifest_assets: 'Bảng Quản lý Mục Tài nguyên Manifest',
  manifest_trash: 'Kho Tạm Khôi Phục File Đã Xoá (_temp_deleted)',
  manifest_json_editor: 'Trình Sửa Mã JSON Manifest Trực Tiếp',
  remote_dialog: 'Hộp thoại Điều khiển qua Điện thoại (Mobile QR Remote)',
  remote_qr_card: 'Thẻ Mã QR & Địa chỉ Wi-Fi LAN',
  remote_touchpad_card: 'Bàn di Cảm ứng 3D Trực tiếp (Live Touchpad)',
  remote_devices_list: 'Danh sách Thiết bị Điện thoại Đang kết nối',
  mcp_dialog: 'Hộp thoại Cấu hình Kết nối AI (MCP Server)',
  perf_dialog: 'Hộp thoại Cấu hình Hiệu năng & GPU',
  camera_path: 'Hộp thoại Lộ trình Camera 3D',
  camera_sketch: 'Hộp thoại Vẽ Đường Bay Camera',
  export: 'Hộp thoại Xuất Video MP4'
}

const DIALOG_FRIENDLY_NAMES: Record<string, string> = {
  layer_assembly: 'Xưởng Lắp Ráp Layer & Rigging 2.5D',
  layer_assembly_mixamo_studio: 'Studio Dựng Dáng & Chuyển Động Mixamo 2.5D',
  layer_assembly_clip_json: 'Hộp Thoại Trao Đổi JSON Hoạt Ảnh Clip & Gió 2.5D',
  layer_assembly_swap: 'Hộp Thoại Thay Thế Bộ Phận 2.5D (Part Swap)',
  layer_assembly_retarget: 'Hộp Thoại Retarget Chuyển Động 2.5D',
  layer_assembly_create: 'Hộp Thoại Tạo Mẫu Lắp Ráp 2.5D Mới',
  template_prompt: 'Hộp Thoại Lưu / Tạo Mẫu (Template Prompt)',
  create_3d: 'Xưởng Mô Hình 3D',
  loop_animator: 'Xưởng Hoạt Ảnh Lặp (Loop Animator)',
  loop_animator_align_studio: 'Studio Căn Chỉnh Khung Hình Loop',
  loop_delete_confirm: 'Hộp Thoại Xác Nhận Xoá Mẫu',
  photo_editor: 'Xưởng Tách Nền & Chỉnh Sửa Ảnh (Photo Studio)',
  photo_editor_save_modal: 'Hộp Thoại Lưu Ảnh Tách Nền (Photo Studio)',
  audio: 'Phòng Thu Âm Thanh & Mixer',
  manifest: 'Quản Lý Manifest Tài Nguyên',
  export: 'Xuất Video MP4',
  mcp: 'Cấu Hình Kết Nối AI (MCP)',
  remote: 'Điều Khiển Qua Điện Thoại (QR Remote)',
  performance: 'Cấu Hình Hiệu Năng & GPU',
  path: 'Lộ Trình Camera 3D',
  sketch: 'Vẽ Đường Bay Camera',
  workflow_node_config: 'Hộp Thoại Cấu Hình Node Workflow V2'
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
    bindingMode:
      layer.bindingMode === 'soft' || (layer.extraBoneIds?.length ?? 0) > 0 ? 'soft' : 'rigid',
    isSelected,
    assetPath:
      layer.asset ||
      layer.assetPath ||
      (layer.imageUrl ? 'Ảnh cắt trực tiếp (Data URL)' : 'Chưa gắn ảnh')
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
 * Thu thập ngữ cảnh chuyên sâu của Xưởng / Hộp thoại đang mở (hỗ trợ đầy đủ Xưởng 2.5D, 3D, Loop, Photo Studio, Audio, Manifest, Remote, MCP, Export, Performance...).
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
    const partBoundsMap = new Map<
      string,
      { left: number; top: number; width: number; height: number }
    >()
    const boneIds = new Set<string>()

    for (const el of matchedElements) {
      const layerEl =
        el.closest?.('[data-layer-id]') || (el.hasAttribute?.('data-layer-id') ? el : null)
      const lid = layerEl?.getAttribute?.('data-layer-id')
      if (lid) {
        partIds.add(lid)
        if (!partBoundsMap.has(lid) && typeof layerEl?.getBoundingClientRect === 'function') {
          const r = layerEl.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            partBoundsMap.set(lid, {
              left: Math.round(r.left),
              top: Math.round(r.top),
              width: Math.round(r.width),
              height: Math.round(r.height)
            })
          }
        }
      }

      const boneEl =
        el.closest?.('[data-bone-id]') || (el.hasAttribute?.('data-bone-id') ? el : null)
      const bid = boneEl?.getAttribute?.('data-bone-id')
      if (bid) boneIds.add(bid)
    }

    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
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
            const hits3D = (vp as any).__pxsQuery3DLayersInBox(box) as Array<{
              layer: { id: string }
              screenBounds?: { left: number; top: number; width: number; height: number }
            }>
            for (const h of hits3D.slice(0, 8)) {
              if (h?.layer?.id) {
                partIds.add(h.layer.id)
                if (h.screenBounds && !partBoundsMap.has(h.layer.id)) {
                  partBoundsMap.set(h.layer.id, h.screenBounds)
                }
              }
            }
          } catch {
            /* ignore projection error */
          }
        }
      }
    }

    if (partIds.size === 0 && selectedLayerId) {
      partIds.add(selectedLayerId)
    }

    const scannedParts: Scanned25DPartInfo[] = []
    for (const pid of partIds) {
      const info = buildScanned25DPartInfo(pid)
      if (info) {
        info.screenBounds = partBoundsMap.get(pid) || null
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

    const nestedSubModal = detectNestedLayerAssemblySubModal(matchedElements)
    const defaultLaFiles =
      primaryMode === 'cutter'
        ? [
            'src/renderer/src/ui/layerAssembly/cutter/SpriteCutterLeftRail.tsx',
            'src/renderer/src/ui/layerAssembly/cutter/SpriteCutterRightRail.tsx',
            'src/renderer/src/ui/layerAssembly/cutter/SpriteCutterTargetPane.tsx'
          ]
        : [
            'src/renderer/src/ui/layerAssembly/LayerAssemblyDialog.tsx',
            'src/renderer/src/ui/layerAssembly/WorkshopWorkspace.tsx',
            'src/renderer/src/ui/layerAssembly/LayerAssemblyInspector.tsx'
          ]

    return {
      workshopType: 'layer_assembly_25d',
      workshopTitle: nestedSubModal
        ? `${nestedSubModal.title} (trong Xưởng 2.5D)`
        : 'Xưởng Lắp Ráp Layer & Rigging 2.5D',
      modelName: composite.name || 'Mẫu 2.5D chưa đặt tên',
      modelId: composite.id,
      canvasSize: `${composite.width || 600} × ${composite.height || 600} px`,
      primaryModeLabel:
        primaryMode === 'cutter' ? 'Cắt tách Sprite (Cutter)' : 'Lắp ráp & Rigging 2.5D',
      activeTabLabel: TAB_LABELS[tab] || tab,
      totalLayers: composite.layers.length,
      totalBones: composite.rig?.bones?.length || 0,
      selectedPart,
      selectedBone,
      scannedParts,
      scannedBones,
      relatedFiles: nestedSubModal ? nestedSubModal.relatedFiles : defaultLaFiles,
      extraSummaryLines: nestedSubModal ? [nestedSubModal.summaryLine] : undefined
    }
  }

  // 2. Kiểm tra Xưởng Mô Hình 3D
  const asm3d = getActiveAssemblySession()
  if (asm3d) {
    const model = asm3d.getModel()
    const selFaceId = asm3d.getSelectedFaceId()
    const selFace = model.faces.find((f) => f.id === selFaceId) || null
    const extra: string[] = [`Tổng số mặt 3D: ${model.faces.length} mặt · Tỷ lệ: ${model.scale ?? 1}`]
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
      relatedFiles: [
        'src/renderer/src/ui/assets/models3d/Assembly3DDialog.tsx',
        'src/renderer/src/ui/assets/models3d/AssemblyViewport.tsx',
        'src/renderer/src/ui/assets/models3d/FaceInspector.tsx'
      ],
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
      relatedFiles: [
        'src/renderer/src/ui/loopAnimator/LoopAnimatorDialog.tsx',
        'src/renderer/src/ui/loopAnimator/LoopAnimatorSourcePane.tsx',
        'src/renderer/src/ui/loopAnimator/LoopAnimatorPlayerPane.tsx',
        'src/renderer/src/ui/loopAnimator/LoopAnimatorLeftRail.tsx',
        'src/renderer/src/ui/loopAnimator/LoopAnimatorRightRail.tsx'
      ],
      extraSummaryLines: [
        `Chủ đề: ${loopState.category} · Chế độ cắt: ${loopState.slicerMode}`,
        `Số khung hình (Frames): ${loopState.frames.length} frames · Tốc độ: ${loopState.playback.fps} FPS (${loopState.playback.loopMode})`
      ]
    }
  }

  // 4. Kiểm tra tất cả các Hộp thoại (Dialogs / Modals) khác trong ứng dụng
  return extractOtherDialogOrWorkshopContext(matchedElements)
}
