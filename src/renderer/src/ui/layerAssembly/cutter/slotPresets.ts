import type { TemplateSlotDef, TemplateSlotPreset } from './types'
import type { AssembledLayerItem } from '../types'

export const BUILTIN_SLOT_PRESETS: TemplateSlotPreset[] = [
  {
    id: 'humanoid_anime',
    name: 'Nhân vật Anime 2.5D — 13 Mảnh (Đầu kèm Tóc, Kính, 2 Biểu cảm, Thân, 4 Tay, 4 Chân)',
    category: 'character',
    description: 'Khung mẫu giải phẫu 13 bộ phận chuẩn ảnh minh hoạ: Đầu kèm tóc trơn, Gọng kính, 2 Biểu cảm mặt rời, Thân áo sơ mi, 2 Bắp tay, 2 Cẳng tay, 2 Đùi và 2 Ống quần kèm giày.',
    slots: [
      { id: 'head', name: '1. Đầu & Mái tóc trơn', role: 'head', x: -3, y: -162, width: 199, height: 166, z: -20, scale: 0.52 },
      { id: 'glasses', name: '2. Gọng mắt kính rời', role: 'glasses', x: -7, y: -121, width: 105, height: 16, z: -30, scale: 0.52 },
      { id: 'face_normal', name: '3. Biểu cảm 1 (Bình thường)', role: 'face', x: -7, y: -125, width: 74, height: 53, z: -25, scale: 0.52 },
      { id: 'face_happy', name: '4. Biểu cảm 2 (Cười mỉm)', role: 'face-alt', x: -7, y: -123, width: 78, height: 62, z: -26, scale: 0.52 },
      { id: 'arm_left', name: '5. Bắp tay áo trái', role: 'arm-left', x: -50, y: -18, width: 45, height: 94, z: 10, scale: 0.52 },
      { id: 'arm_right', name: '6. Bắp tay áo phải', role: 'arm-right', x: 52, y: -18, width: 45, height: 94, z: 10, scale: 0.52 },
      { id: 'torso', name: '7. Thân áo, Cổ & Thắt lưng', role: 'torso', x: 0, y: -12, width: 113, height: 184, z: 0, scale: 0.52 },
      { id: 'thigh_left', name: '8. Đùi quần trái', role: 'thigh-left', x: -23, y: 92, width: 48, height: 114, z: 20, scale: 0.52 },
      { id: 'thigh_right', name: '9. Đùi quần phải', role: 'thigh-right', x: 25, y: 92, width: 48, height: 114, z: 20, scale: 0.52 },
      { id: 'shin_left', name: '10. Ống quần & Giày trái', role: 'shin-left', x: -28, y: 184, width: 54, height: 123, z: 25, scale: 0.52 },
      { id: 'shin_right', name: '11. Ống quần & Giày phải', role: 'shin-right', x: 20, y: 184, width: 54, height: 123, z: 25, scale: 0.52 },
      { id: 'forearm_left', name: '12. Cẳng tay & Bàn tay trái', role: 'forearm-left', x: -56, y: 52, width: 27, height: 89, z: 15, scale: 0.52 },
      { id: 'forearm_right', name: '13. Cẳng tay & Bàn tay phải', role: 'forearm-right', x: 58, y: 52, width: 27, height: 87, z: 15, scale: 0.52 }
    ]
  },
  {
    id: 'simple_puppet',
    name: 'Búp bê cơ bản (7 phần: Đầu, Tóc, Thân, 2 Tay, 2 Chân)',
    category: 'character',
    description: 'Cấu trúc tối giản, nhanh gọn cho mọi nhân vật hoạt hình đơn giản.',
    slots: [
      { id: 'hair', name: 'Tóc', role: 'hair', x: 0, y: -140, width: 130, height: 100, z: -5 },
      { id: 'head', name: 'Đầu', role: 'head', x: 0, y: -100, width: 110, height: 110, z: 0 },
      { id: 'torso', name: 'Thân', role: 'torso', x: 0, y: 15, width: 100, height: 120, z: 5 },
      { id: 'arm_left', name: 'Tay trái', role: 'arm-left', x: -75, y: 15, width: 45, height: 95, z: 8 },
      { id: 'arm_right', name: 'Tay phải', role: 'arm-right', x: 75, y: 15, width: 45, height: 95, z: 8 },
      { id: 'leg_left', name: 'Chân trái', role: 'leg-left', x: -30, y: 140, width: 45, height: 110, z: 10 },
      { id: 'leg_right', name: 'Chân phải', role: 'leg-right', x: 30, y: 140, width: 45, height: 110, z: 10 }
    ]
  },
  {
    id: 'freeform',
    name: 'Bố cục tự do (Không dùng khung cố định)',
    category: 'custom',
    description: 'Thoải mái dán và kéo thả các mảnh vào bất kỳ vị trí nào trên canvas.',
    slots: []
  }
]

export const SLOT_PRESETS = BUILTIN_SLOT_PRESETS

const STORAGE_KEY = 'parallax_cutter_custom_templates'

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {}
  return null
}

export function loadCustomPresets(): TemplateSlotPreset[] {
  try {
    const storage = getStorage()
    if (!storage) return []
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomPreset(preset: TemplateSlotPreset): void {
  const storage = getStorage()
  if (!storage) return
  const all = loadCustomPresets()
  const idx = all.findIndex((p) => p.id === preset.id)
  if (idx >= 0) {
    all[idx] = preset
  } else {
    all.push(preset)
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function deleteCustomPreset(id: string): void {
  const storage = getStorage()
  if (!storage) return
  const all = loadCustomPresets().filter((p) => p.id !== id)
  storage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getAllPresets(): TemplateSlotPreset[] {
  const custom = loadCustomPresets()
  return [...BUILTIN_SLOT_PRESETS, ...custom]
}

export function createPresetFromLayers(
  name: string,
  description: string,
  layers: AssembledLayerItem[]
): TemplateSlotPreset {
  const slots: TemplateSlotDef[] = layers.map((layer, idx) => ({
    id: `slot_${Date.now()}_${idx}`,
    name: layer.name || `Bộ phận ${idx + 1}`,
    x: Math.round(layer.x),
    y: Math.round(layer.y),
    width: Math.round(100 * (layer.scaleX ?? layer.scale ?? 1)),
    height: Math.round(100 * (layer.scaleY ?? layer.scale ?? 1)),
    z: Math.round(layer.z || 0),
    scale: layer.scale ?? 1,
    rotation: layer.rotation ?? 0
  }))

  return {
    id: `custom_template_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim() || 'Mẫu tùy chỉnh mới',
    category: 'custom',
    description: description.trim() || `Mẫu tự lưu gồm ${slots.length} bộ phận`,
    slots,
    isCustom: true,
    createdAt: new Date().toISOString()
  }
}

export function exportPresetJson(preset: TemplateSlotPreset): string {
  return JSON.stringify(preset, null, 2)
}

export function importPresetJson(jsonStr: string): TemplateSlotPreset {
  const parsed = JSON.parse(jsonStr)
  if (!parsed || !Array.isArray(parsed.slots)) {
    throw new Error('Dữ liệu mẫu không hợp lệ: thiếu mảng slots')
  }
  const preset: TemplateSlotPreset = {
    id: `custom_template_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: String(parsed.name || 'Mẫu nhập khẩu'),
    category: 'custom',
    description: String(parsed.description || ''),
    slots: parsed.slots.map((s: TemplateSlotDef, idx: number) => ({
      id: s.id || `slot_${idx}`,
      name: s.name || `Bộ phận ${idx + 1}`,
      x: Number(s.x) || 0,
      y: Number(s.y) || 0,
      width: Number(s.width) || 100,
      height: Number(s.height) || 100,
      z: Number(s.z) || 0,
      scale: typeof s.scale === 'number' ? s.scale : 1,
      rotation: typeof s.rotation === 'number' ? s.rotation : 0
    })),
    isCustom: true,
    createdAt: new Date().toISOString()
  }
  saveCustomPreset(preset)
  return preset
}

