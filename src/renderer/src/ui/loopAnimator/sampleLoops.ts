import type { LoopAnimationPreset } from './types'
import { loadAssetBytesFromDiskOrBuiltIn } from '../../project/json/assetLoader'
import { assetStore } from '../../project/assets'

/**
 * Phục hồi URL đầy đủ (Blob URL hoặc Data URL) từ đường dẫn asset / built-in / disk
 */
export async function resolveLoopAssetUrl(urlOrPath: string): Promise<string> {
  if (!urlOrPath) return ''
  const trimmed = urlOrPath.trim()
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed
  }

  // 1. Kiểm tra assetStore trong project
  try {
    const rt = assetStore.get(trimmed)
    if (rt?.url) return rt.url
    if (rt?.thumbUrl) return rt.thumbUrl
  } catch {
    /* ignore */
  }

  // 2. Nạp bytes từ disk hoặc built-in assets qua IPC
  try {
    const res = await loadAssetBytesFromDiskOrBuiltIn(trimmed)
    if (res && res.data) {
      const blob = new Blob([res.data as unknown as BlobPart], { type: res.mime || 'image/png' })
      return URL.createObjectURL(blob)
    }
  } catch {
    /* ignore */
  }

  return trimmed
}

export const SAMPLE_CAMPFIRE_TRANSPARENT: LoopAnimationPreset = {
  id: 'campfire_transparent',
  name: 'Lửa trại 16 frame (Đã tách nền trong suốt)',
  description: 'Chuỗi frame 4×4 chuyển động mượt mà từ trái qua phải, từ trên xuống dưới',
  imageUrl: 'assets/demo_transparent/campfire_loop_transparent.png',
  isChroma: false,
  defaultGrid: { rows: 4, cols: 4 },
  defaultFps: 12
}

export const SAMPLE_CAMPFIRE_CHROMA: LoopAnimationPreset = {
  id: 'campfire_chroma',
  name: 'Lửa trại 16 frame (Nền hồng Magenta)',
  description: 'Sprite sheet 4×4 trên nền hồng chroma key, hỗ trợ AI & bộ lọc tự động khử nền trong suốt',
  imageUrl: 'assets/demo_transparent/campfire_loop_chroma.jpg',
  isChroma: true,
  defaultGrid: { rows: 4, cols: 4 },
  defaultFps: 12,
  chromaConfig: {
    enabled: true,
    keyColorType: 'chroma_magenta',
    customHex: '#ff00ff',
    tolerance: 38,
    smoothness: 12,
    despill: 20
  }
}

export const BUILTIN_LOOP_PRESETS: LoopAnimationPreset[] = [
  SAMPLE_CAMPFIRE_TRANSPARENT,
  SAMPLE_CAMPFIRE_CHROMA
]
