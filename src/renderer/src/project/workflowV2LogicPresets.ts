import type { Layer, Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { assetStore } from './assets'
import {
  extractCompositeDynamicParts,
  type DynamicCompositePartEntry
} from './workflowV2CompositeParts'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_CAVE_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS
} from './workflowV2Options'
import { WORKFLOW_V2_COLLISION_OPTIONS, WORKFLOW_V2_MATERIAL_OPTIONS } from './workflowV2PhysicsAndValidation'

export type WorkflowV2SpawnCategory =
  | 'part_swap'
  | 'rig_bone'
  | 'loop_anim'
  | 'anim_fx'
  | 'action'
  | 'material'
  | 'collision'
  | 'light'
  | 'cave'
  | 'fx'
  | 'audio'

export interface WorkflowV2LogicCategoryItem {
  id: WorkflowV2SpawnCategory
  presetId?: string
  icon: string
  label: string
  hint: string
  accent: string
}

const ATOMIC_FX_ITEMS: WorkflowV2LogicCategoryItem[] = [
  { id: 'fx', presetId: 'v2:fx:fade_in_out', icon: '🌓', label: 'Hiện / Ẩn mờ dần', hint: 'Fade In / Out độ mờ Opacity độc lập', accent: '#a855f7' },
  { id: 'fx', presetId: 'v2:fx:pulse_beat', icon: '💓', label: 'Nhịp thở / Rung', hint: 'Nhịp co giãn Scale hoặc rung nhẹ', accent: '#c084fc' },
  { id: 'fx', presetId: 'v2:fx:glow', icon: '✨', label: 'Phát sáng Neon', hint: 'Hào quang viền sáng tách biệt hoàn toàn', accent: '#e879f9' }
]

/**
 * Nhóm logic gắn vào Layer / Cụm — tuân thủ Nguyên Tắc Đơn Trách Nhiệm Của Node:
 * Mỗi Node chỉ sở hữu đúng 1 miền logic độc lập, kết hợp với nhau qua dây nối trên đồ thị.
 */
export const WORKFLOW_V2_LOGIC_CATEGORIES: WorkflowV2LogicCategoryItem[] = [
  { id: 'loop_anim', icon: '🔁', label: 'Animation Loop', hint: 'Chu kỳ phát lặp, tốc độ & số vòng riêng cho item Loop Animate', accent: '#d946ef' },
  { id: 'part_swap', icon: '🧩', label: 'Bộ phận', hint: 'Đánh tráo bộ phận có 2+ biến thể theo giây', accent: '#06b6d4' },
  { id: 'rig_bone', icon: '🦴', label: 'Gắn xương', hint: 'Khung xương nhân vật & chuỗi xương uốn dẻo cho Layer', accent: '#f59e0b' },
  { id: 'anim_fx', icon: '🎞️', label: 'Hành động Nhân vật', hint: 'Động tác nhép miệng, nháy mắt & Clip xương nhân vật 2.5D/3D', accent: '#6366f1' },
  { id: 'action', icon: '🏃', label: 'Motion', hint: 'Đặt BBox Đích, vẽ quỹ đạo & chuyển động không gian', accent: '#10b981' },
  { id: 'fx', icon: '✨', label: 'Hiệu ứng', hint: 'Hiện/ẩn mờ dần, nhịp đập, rung chấn, phát sáng Neon & quang học', accent: '#a855f7' },
  { id: 'material', icon: '🏷️', label: 'Vật liệu', hint: 'Cao su, gỗ, đá, lá, kim loại & đàn hồi lưới Mesh', accent: '#f97316' },
  { id: 'collision', icon: '💥', label: 'Va chạm', hint: 'Nối 2 Layer / Cụm va đập vật lý', accent: '#f43f5e' },
  { id: 'light', icon: '💡', label: 'Ánh sáng', hint: 'Đèn viền, nến, glow, nguồn sáng ảo 2.5D', accent: '#eab308' },
  { id: 'cave', icon: '🕳️', label: 'Hang động', hint: 'Vòm cổng độ sâu 2.5D', accent: '#14b8a6' },
  { id: 'audio', icon: '🔊', label: 'Âm thanh', hint: 'Thoại, nhép môi & SFX', accent: '#ec4899' }
]

/** Kiểm tra xem Layer có phải tài nguyên Hoạt ảnh Lặp (Animate Loop / GIF) hay không */
export function isAnimatedLoopLayer(layer: Layer | undefined, project?: Project): boolean {
  if (!layer || layer.type !== 'image') return false
  if (layer.props.loopTemplateId) return true
  const assetId = layer.props.assetId
  if (!assetId) return false
  const meta = project?.assets.find((a) => a.id === assetId)
  if (meta?.isAnimated) return true
  const runtime = assetStore.get(assetId)
  return Boolean(runtime?.meta.isAnimated || runtime?.gif)
}

/**
 * Lọc danh sách các Node Logic con phù hợp với ngữ cảnh của Node Cha đang kết nối
 * (Cụm 2.5D, Khối/Layer 3D, hay Layer 2.5D đơn lẻ) và trả về kèm danh sách Bộ phận động từ Tab `Bộ phận`.
 */
export function getCompatibleLogicCatalogForNode(
  parentNode: WorkflowNode | null | undefined,
  project?: Project
): {
  categories: WorkflowV2LogicCategoryItem[]
  dynamicParts: DynamicCompositePartEntry[]
  parentKind: 'composite_25d' | 'model_3d' | 'single_25d'
} {
  if (!parentNode) {
    return { categories: WORKFLOW_V2_LOGIC_CATEGORIES, dynamicParts: [], parentKind: 'single_25d' }
  }
  const firstLayer = project?.layers.find((l) => (parentNode.params?.targetLayerIds ?? []).includes(l.id))
  const is3D = parentNode.params?.assemblyKind === 'model3d' || Boolean(firstLayer?.model3d)
  const isClusterNode =
    parentNode.params?.logicCategory === 'cluster_lock' ||
    Boolean(parentNode.params?.groupKind) ||
    (parentNode.params?.targetLayerIds?.length ?? 0) > 1
  const isComposite =
    !is3D &&
    isClusterNode &&
    (parentNode.params?.assemblyKind === 'composite' ||
      Boolean(parentNode.params?.instanceId) ||
      Boolean(firstLayer?.composite))

  const dynamicParts = project
    ? extractCompositeDynamicParts(project, parentNode.params?.instanceId, firstLayer).filter(
        (p) => p.layerIds.length >= 2 || p.variants.length >= 2
      )
    : []

  if (is3D) {
    const categories: WorkflowV2LogicCategoryItem[] = []
    if (isClusterNode && dynamicParts.length > 0) {
      categories.push({
        id: 'part_swap',
        icon: '🧊',
        label: 'Bộ phận 3D',
        hint: 'Tách mặt / bộ phận khối 3D',
        accent: '#06b6d4'
      })
    }
    categories.push(
      { id: 'action', icon: '🔄', label: 'Motion 3D', hint: 'Xoay 3D & vẽ quỹ đạo chuyển động', accent: '#10b981' },
      ...ATOMIC_FX_ITEMS,
      { id: 'material', icon: '🏷️', label: 'Vật liệu 3D', hint: 'Đá cứng, kim loại, gỗ, đàn hồi', accent: '#f97316' },
      { id: 'collision', icon: '💥', label: 'Va chạm 3D', hint: 'Tương tác va đập vật lý 3D', accent: '#f43f5e' },
      { id: 'light', icon: '💡', label: 'Ánh sáng 3D', hint: 'Chiếu sáng khối 3D, Rim & Point', accent: '#eab308' },
      { id: 'audio', icon: '🔊', label: 'Âm thanh 3D', hint: 'Âm thanh gắn theo khối 3D', accent: '#ec4899' }
    )
    return { categories, dynamicParts, parentKind: 'model_3d' }
  }

  if (isComposite) {
    const categories: WorkflowV2LogicCategoryItem[] = []
    if (dynamicParts.length > 0 || !project) {
      categories.push({
        id: 'part_swap',
        icon: '🧩',
        label: 'Bộ phận',
        hint: 'Chỉnh bộ phận lắp ráp từ Xưởng 2.5D',
        accent: '#06b6d4'
      })
    }
    categories.push(
      { id: 'anim_fx', icon: '🎞️', label: 'Hành động Nhân vật', hint: 'Động tác nhép miệng, nháy mắt & Clip xương 2.5D', accent: '#6366f1' },
      { id: 'action', icon: '🏃', label: 'Motion', hint: 'Đặt BBox Đích & vẽ quỹ đạo chuyển động', accent: '#10b981' },
      ...ATOMIC_FX_ITEMS,
      { id: 'material', icon: '🏷️', label: 'Vật liệu', hint: 'Đàn hồi chất liệu cho cụm 2.5D', accent: '#f97316' },
      { id: 'collision', icon: '💥', label: 'Va chạm', hint: 'Nối 2 Cụm / Layer va đập vật lý', accent: '#f43f5e' },
      { id: 'light', icon: '💡', label: 'Ánh sáng', hint: 'Đèn viền, glow, nguồn sáng cụm', accent: '#eab308' },
      { id: 'audio', icon: '🔊', label: 'Âm thanh', hint: 'Thoại & nhép môi nhân vật', accent: '#ec4899' }
    )
    return { categories, dynamicParts, parentKind: 'composite_25d' }
  }

  // Layer 2.5D đơn lẻ: nếu là tài nguyên Animate Loop thì có sẵn Node Animation Loop phục vụ riêng cho nó
  const singleCategories: WorkflowV2LogicCategoryItem[] = []
  if (isAnimatedLoopLayer(firstLayer, project)) {
    singleCategories.push({
      id: 'loop_anim',
      icon: '🔁',
      label: 'Animation Loop',
      hint: 'Chu kỳ phát lặp, tốc độ & số vòng riêng cho item Loop',
      accent: '#d946ef'
    })
  }
  singleCategories.push(
    { id: 'action', icon: '🏃', label: 'Motion', hint: 'Đặt BBox Đích & vẽ quỹ đạo di chuyển Layer', accent: '#10b981' },
    ...ATOMIC_FX_ITEMS,
    { id: 'rig_bone', icon: '🦴', label: 'Gắn xương', hint: 'Chuỗi xương uốn dẻo cho Layer', accent: '#f59e0b' },
    { id: 'material', icon: '🏷️', label: 'Vật liệu', hint: 'Cao su, gỗ, đá, lá, kim loại & đàn hồi Mesh', accent: '#f97316' },
    { id: 'collision', icon: '💥', label: 'Va chạm', hint: 'Nối 2 Layer va đập vật lý', accent: '#f43f5e' },
    { id: 'light', icon: '💡', label: 'Ánh sáng', hint: 'Đèn viền, nến, glow, nguồn sáng', accent: '#eab308' },
    { id: 'cave', icon: '🕳️', label: 'Hang động', hint: 'Vòm cổng độ sâu 2.5D', accent: '#14b8a6' },
    { id: 'audio', icon: '🔊', label: 'Âm thanh', hint: 'Thoại, nhép môi & SFX', accent: '#ec4899' }
  )
  return { categories: singleCategories, dynamicParts: [], parentKind: 'single_25d' }
}

export interface WorkflowV2LogicPreset {
  /** Dạng `v2:<nhóm>:<tuỳ chọn>`, ví dụ `v2:light:candle` */
  id: string
  category: WorkflowV2SpawnCategory
  label: string
  title: string
  params: Partial<WorkflowNodeParams>
}

const prefix: Record<WorkflowV2SpawnCategory, string> = {
  loop_anim: 'Animation Loop',
  part_swap: 'Bộ phận',
  rig_bone: 'Gắn xương',
  anim_fx: 'Hành động',
  action: 'Motion',
  material: 'Vật liệu',
  collision: 'Va chạm',
  light: 'Ánh sáng',
  cave: 'Hang động',
  fx: 'Hiệu ứng',
  audio: 'Âm thanh'
}

function preset(category: WorkflowV2SpawnCategory, optionId: string, label: string, params: Partial<WorkflowNodeParams>): WorkflowV2LogicPreset {
  return { id: `v2:${category}:${optionId}`, category, label, title: `${prefix[category]}: ${label}`, params }
}

/** Toàn bộ mẫu logic (mỗi tuỳ chọn của từng nhóm, tách biệt đơn trách nhiệm) */
export const WORKFLOW_V2_LOGIC_PRESETS: WorkflowV2LogicPreset[] = [
  // 1. Node Animation Loop — chỉ phục vụ chu kỳ lặp & tốc độ phát của item Loop Animate
  preset('loop_anim', 'loop', '🔁 Lặp vô tận (Loop)', {
    animMode: 'loop_sprite',
    loopMode: 'loop',
    loopSpeed: 1,
    loopAutoPlayPaused: true
  }),
  preset('loop_anim', 'ping_pong', '↔ Lặp đảo chiều (Ping-Pong)', {
    animMode: 'loop_sprite',
    loopMode: 'ping-pong',
    loopSpeed: 1,
    loopAutoPlayPaused: true
  }),
  preset('loop_anim', 'once', '1️⃣ Chạy 1 lần (Play Once)', {
    animMode: 'loop_sprite',
    loopMode: 'once',
    loopPlayCount: 1,
    loopEndAction: 'hold',
    loopSpeed: 1,
    loopAutoPlayPaused: true
  }),
  preset('loop_anim', 'random', '🎲 Lặp ngẫu nhiên (Random)', {
    animMode: 'loop_sprite',
    loopMode: 'random',
    loopSpeed: 1,
    loopAutoPlayPaused: true
  }),

  // 2. Node Motion — chỉ phục vụ dịch chuyển vị trí / quỹ đạo không gian
  preset('action', 'bbox_target', '🎯 Đặt BBox Đích (#1 → #2) & Chiều sâu Z', {
    actionPreset: 'bbox_target',
    motionMode: 'bbox',
    bboxPathType: 'shortest',
    bboxTargetScalePct: 140,
    depthMode: 'flat_2d',
    intensity: 1
  }),
  ...WORKFLOW_V2_ACTION_OPTIONS.map((o) => preset('action', o.id, o.label, { actionPreset: o.id, intensity: o.defaultAmount })),
  preset('action', 'custom_draw', '🎨 Vẽ quỹ đạo & Đồ thị Motion mới', { actionPreset: 'float', motionMode: 'path', intensity: 1 }),

  // 3. Node Gắn xương
  preset('rig_bone', 'humanoid_15', '🦴 Khung xương Nhân vật 2.5D (15 khớp)', { rigBonePreset: 'humanoid_15', rigSoftBinding: true, intensity: 1 }),
  preset('rig_bone', 'mixamo_12', '🕺 Auto-Rig 12 điểm mốc Mixamo 2.5D', { rigBonePreset: 'mixamo_12', rigSoftBinding: true, intensity: 1 }),
  preset('rig_bone', 'chain_3', '🌿 Chuỗi xương uốn 3 khớp (Cây / Đạo cụ)', { rigBonePreset: 'chain_3', rigSoftBinding: true, intensity: 1 }),
  preset('rig_bone', 'quadruped_12', '🐺 Khung xương Thú 4 chân 2.5D (12 khớp)', { rigBonePreset: 'quadruped_12', rigSoftBinding: true, intensity: 1 }),
  preset('rig_bone', 'bird_8', '🦅 Khung xương Chim / Cánh bay 2.5D (8 khớp)', { rigBonePreset: 'bird_8', rigSoftBinding: true, intensity: 1 }),
  preset('rig_bone', 'monster_14', '👹 Khung xương Quái vật 2.5D (14 khớp)', { rigBonePreset: 'monster_14', rigSoftBinding: true, intensity: 1 }),

  // 4. Node Hành động Nhân vật (anim_fx) — chỉ phục vụ Clip cử động xương & động tác nhân vật 2.5D
  preset('anim_fx', 'rig_idle', '🌬️ Đứng thở tự nhiên (Idle)', { animMode: 'rig_clip', rigActionPreset: 'idle', intensity: 1 }),
  preset('anim_fx', 'rig_run', '🏃 Chạy bứt tốc (Run)', { animMode: 'rig_clip', rigActionPreset: 'run', intensity: 1 }),
  preset('anim_fx', 'rig_jump', '🦘 Bật nhảy lên cao (Jump)', { animMode: 'rig_clip', rigActionPreset: 'jump', intensity: 1 }),
  preset('anim_fx', 'rig_land', '🦶 Tiếp đất chắc chắn (Land)', { animMode: 'rig_clip', rigActionPreset: 'land', intensity: 1 }),
  preset('anim_fx', 'rig_combat', '⚔️ Combo chém kiếm 2.5D (Combat)', { animMode: 'rig_clip', rigActionPreset: 'combat', intensity: 1 }),
  preset('anim_fx', 'rig_martial_kick', '🥋 Đá xoáy võ thuật (Martial Kick)', { animMode: 'rig_clip', rigActionPreset: 'martial_kick', intensity: 1 }),
  preset('anim_fx', 'rig_dodge_counter', '💨 Né đòn & Phản công (Dodge Counter)', { animMode: 'rig_clip', rigActionPreset: 'dodge_counter', intensity: 1 }),
  preset('anim_fx', 'rig_hit_recoil', '💥 Trúng đòn giật lùi (Hit Recoil)', { animMode: 'rig_clip', rigActionPreset: 'hit_recoil', intensity: 1 }),
  preset('anim_fx', 'rig_quadruped_walk', '🐾 Thú 4 chân đi bộ (Quadruped Walk)', { animMode: 'rig_clip', rigActionPreset: 'quadruped_walk', intensity: 1 }),
  preset('anim_fx', 'rig_quadruped_gallop', '🐺 Thú 4 chân phi nước đại (Gallop)', { animMode: 'rig_clip', rigActionPreset: 'quadruped_gallop', intensity: 1 }),
  preset('anim_fx', 'rig_wing_flap', '🦅 Chim vỗ cánh bay lượn (Wing Flap)', { animMode: 'rig_clip', rigActionPreset: 'wing_flap', intensity: 1 }),
  preset('anim_fx', 'rig_monster_prowl', '🕷️ Quái vật rình mồi (Monster Prowl)', { animMode: 'rig_clip', rigActionPreset: 'monster_prowl', intensity: 1 }),
  preset('anim_fx', 'rig_monster_roar', '🦁 Quái vật gầm rú (Monster Roar)', { animMode: 'rig_clip', rigActionPreset: 'monster_roar', intensity: 1 }),
  preset('anim_fx', 'rig_monster_pounce', '👹 Quái vật vồ mồi (Monster Pounce)', { animMode: 'rig_clip', rigActionPreset: 'monster_pounce', intensity: 1 }),
  preset('anim_fx', 'rig_talk', '💬 Thuyết thoại 2D (Talk)', { animMode: 'rig_clip', rigActionPreset: 'talk', intensity: 1 }),
  preset('anim_fx', 'rig_scheming', '🧠 Mưu tính chống cằm (Scheming)', { animMode: 'rig_clip', rigActionPreset: 'scheming', intensity: 1 }),
  preset('anim_fx', 'rig_shock', '😱 Giật mình Quái Đàm (Shock)', { animMode: 'rig_clip', rigActionPreset: 'shock', intensity: 1 }),
  preset('anim_fx', 'rig_point', '👉 Chỉ tay phá cục (Point)', { animMode: 'rig_clip', rigActionPreset: 'point', intensity: 1 }),
  preset('anim_fx', 'rig_walk', '🚶 Bước đi (Walk)', { animMode: 'rig_clip', rigActionPreset: 'walk', intensity: 1 }),
  preset('anim_fx', 'rig_wave', '👋 Vẫy tay chào (Wave)', { animMode: 'rig_clip', rigActionPreset: 'wave', intensity: 1 }),
  preset('anim_fx', 'rig_bow', '🙇 Cúi chào (Bow)', { animMode: 'rig_clip', rigActionPreset: 'bow', intensity: 1 }),
  preset('anim_fx', 'rig_action', '⚔️ Vung đòn hành động (Action)', { animMode: 'rig_clip', rigActionPreset: 'action', intensity: 1 }),

  // 5. Node Bộ phận
  preset('part_swap', 'part_group', '🧩 Bộ phận lắp ráp 2.5D', { swapMode: 'part_variant', intensity: 1 }),
  preset('part_swap', 'expression', '😊 Đổi biểu cảm / Biến thể mảnh', { swapMode: 'expression', intensity: 1 }),
  preset('part_swap', 'toggle_part', '👁 Bật / Ẩn bộ phận cụm', { swapMode: 'toggle_part', intensity: 1 }),
  preset('part_swap', 'replace_asset', '🖼 Thay ảnh mảnh / Bộ phận', { swapMode: 'replace_asset', intensity: 1 }),
  preset('part_swap', 'replace_template', '🔄 Thay nguyên cụm 2.5D', { swapMode: 'replace_template', intensity: 1 }),

  // 6. Node Vật liệu & Va chạm & Ánh sáng & Hang động
  ...WORKFLOW_V2_MATERIAL_OPTIONS.map((o) =>
    preset('material', o.id, o.label, {
      materialTag: o.id,
      materialStiffness: o.defaultStiffness,
      materialBounciness: o.defaultBounciness,
      materialGravity: o.defaultGravity,
      intensity: o.defaultBounciness
    })
  ),
  ...WORKFLOW_V2_COLLISION_OPTIONS.map((o) =>
    preset('collision', o.id, o.label, { collisionMode: o.id, collisionForce: o.defaultForce, deformIntensity: o.defaultDeform, intensity: o.defaultForce })
  ),
  ...WORKFLOW_V2_LIGHT_OPTIONS.map((o) =>
    preset('light', o.id, o.label, { lightMode: o.id, lightColor: o.defaultColor, intensity: o.defaultIntensity })
  ),
  ...WORKFLOW_V2_CAVE_OPTIONS.map((o) =>
    preset('cave', o.id, o.label, { caveArchShape: o.id, caveDarkness: o.defaultDarkness, caveMinScale: o.defaultMinScale, intensity: o.defaultDarkness })
  ),

  // 7. Node Hiệu ứng nguyên tử (`fx`) — tách bạch 3 vai trò đơn nhiệm: Hiện/Ẩn (`fade`), Nhịp/Rung (`pulse`), Phát sáng (`glow`)
  ...WORKFLOW_V2_ANIM_FX_OPTIONS.filter((o) => o.id !== 'loop_rhythm' && o.id !== 'loop_flicker').map((o) => {
    const role = o.fxCategory === 'opacity' ? 'fade' : o.fxCategory === 'transform' ? 'pulse' : 'glow'
    const roleTitlePrefix = role === 'fade' ? 'Hiện/Ẩn' : role === 'pulse' ? 'Nhịp/Rung' : 'Phát sáng'
    return {
      ...preset('fx', o.id, o.label, {
        fxAtomicRole: role,
        fxSubTab: role === 'fade' ? 'opacity' : role,
        animFxPreset: o.id,
        intensity: o.defaultIntensity,
        animFxCount: o.defaultCount,
        animFxColor: o.defaultColor,
        ...(o.id === 'fadeIn' ? { loopFadeInSec: 0.6 } : {}),
        ...(o.id === 'fadeOut' ? { loopEndAction: 'fade_out', loopFadeOutSec: 0.6 } : {})
      }),
      title: `${roleTitlePrefix}: ${o.label}`
    }
  }),
  {
    ...preset('fx', 'fadeInOut', '🌗 Hiện mờ → nét & Ẩn mờ dần', {
      fxAtomicRole: 'fade',
      fxSubTab: 'opacity',
      animFxPreset: 'fadeIn',
      loopFadeInSec: 0.5,
      loopEndAction: 'fade_out',
      loopFadeOutSec: 0.5,
      intensity: 1
    }),
    title: 'Hiện/Ẩn: Hiện mờ → nét & Ẩn mờ dần'
  },
  {
    ...preset('fx', 'rhythm_beat', '🔥 Nhịp đập & Nháy sáng liên tục (Rhythm Beat)', {
      fxAtomicRole: 'pulse',
      fxSubTab: 'pulse',
      animFxPreset: 'loop_rhythm',
      loopRhythmMode: 'sync_both',
      loopRhythmRateHz: 2.5,
      loopRhythmIntensity: 0.45,
      loopMinOpacity: 0.55,
      loopScaleBeatPct: 12,
      intensity: 0.45
    }),
    title: 'Nhịp/Rung: Nhịp đập & Nháy sáng liên tục'
  },
  ...WORKFLOW_V2_FX_OPTIONS.map((o) => {
    const role = o.id === 'wind_physics' || o.id === 'particles' ? 'pulse' : 'glow'
    const roleTitlePrefix = role === 'pulse' ? 'Nhịp/Hạt' : 'Phát sáng'
    return {
      ...preset('fx', o.id, o.label, {
        fxAtomicRole: role,
        fxSubTab: role,
        fxKind: o.id,
        intensity: o.defaultIntensity
      }),
      title: `${roleTitlePrefix}: ${o.label}`
    }
  }),

  // 8. Node Âm thanh
  preset('audio', 'voice', 'Thoại & nhép môi', { intensity: 1, autoLipSync: true })
]

/** Ánh xạ mã logic cũ (hoặc mã gọi trước khi tách `loop_anim` / `fx`) sang mẫu V2 đơn trách nhiệm */
const LEGACY_TO_V2: Record<string, string> = {
  'logic-physics-wind': 'v2:material:foliage_bush',
  'logic-physics-elastic': 'v2:material:jelly_slime',
  'logic-physics-sway': 'v2:action:sway',
  'logic-physics-bounce': 'v2:collision:elastic_bounce',
  'logic-fx-candle': 'v2:light:candle',
  'logic-fx-flashlight': 'v2:light:spot',
  'logic-fx-rimglow': 'v2:light:rim',
  'logic-fx-cave-portal': 'v2:cave:arch',
  'logic-fx-particles': 'v2:fx:particles',
  'logic-motion-walk-z': 'v2:action:drift',
  'logic-motion-jump': 'v2:action:pulse',
  'logic-motion-drift': 'v2:action:drift',
  'logic-motion-breathe': 'v2:action:pulse',
  'logic-motion-cross': 'v2:action:drift',
  'logic-motion-emerge': 'v2:action:float',
  'logic-motion-pulse': 'v2:action:pulse',
  'logic-motion-spin': 'v2:action:spin',
  'logic-audio-lipsync': 'v2:audio:voice',
  'logic-audio-sfx': 'v2:audio:voice',
  'v2:fx:wind_physics': 'v2:material:foliage_bush',
  'v2:anim_fx:loop_rhythm': 'v2:loop_anim:loop',
  'v2:anim_fx:loop_flicker': 'v2:loop_anim:loop',
  'v2:anim_fx:popIn': 'v2:fx:popIn',
  'v2:anim_fx:shake': 'v2:fx:shake',
  'v2:anim_fx:pulse': 'v2:fx:pulse',
  'v2:anim_fx:fadeIn': 'v2:fx:fadeIn',
  'v2:anim_fx:fadeOut': 'v2:fx:fadeOut',
  'v2:anim_fx:blink': 'v2:fx:blink',
  'v2:anim_fx:breathe': 'v2:fx:breathe',
  'v2:anim_fx:neonBreathe': 'v2:fx:neonBreathe',
  'v2:anim_fx:neonBlink': 'v2:fx:neonBlink',
  'v2:anim_fx:neonFlicker': 'v2:fx:neonFlicker',
  'v2:anim_fx:neonSolid': 'v2:fx:neonSolid'
}

export function findLogicPreset(id: string): WorkflowV2LogicPreset | undefined {
  return WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.id === id) ?? (LEGACY_TO_V2[id] ? WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.id === LEGACY_TO_V2[id]) : undefined)
}

export function defaultLogicPreset(category: WorkflowV2SpawnCategory): WorkflowV2LogicPreset {
  if (category === 'loop_anim') {
    return WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.id === 'v2:loop_anim:loop')!
  }
  if (category === 'anim_fx') {
    return WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.id === 'v2:anim_fx:rig_idle')!
  }
  if (category === 'fx') {
    return WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.id === 'v2:fx:fadeInOut')!
  }
  return WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.category === category)!
}

/** Mẫu V2 cho một mã logic bất kỳ (mã V2 trực tiếp, hoặc mã kho cũ đã ánh xạ) */
export function resolveLogicPreset(logicId: string): WorkflowV2LogicPreset | undefined {
  return findLogicPreset(logicId)
}

/** Áp dụng mẫu lên Node Logic (giữ nguyên dây nối, đích và khoảng thời gian) */
export function applyLogicPresetToNode(node: WorkflowNode, p: WorkflowV2LogicPreset): WorkflowNode {
  return { ...node, title: p.title, params: { ...node.params, ...p.params } }
}
