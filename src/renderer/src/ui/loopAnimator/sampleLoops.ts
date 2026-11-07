import { assetStore } from '../../project/assets'
import { loadAssetBytesFromDiskOrBuiltIn } from '../../project/json/assetLoader'
import type { SampleLoopPreset } from './types'

const _resolvedUrlCache = new Map<string, string>()

function drawProceduralCampfireCell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  phase: number,
  cell: number
): void {
  const baseY = cy + cell * 0.28
  // Khúc củi dưới đáy
  ctx.fillStyle = '#5c3a21'
  ctx.beginPath()
  ctx.roundRect(cx - 24, baseY - 2, 48, 8, 4)
  ctx.fill()

  // Hào quang lửa ngoài
  const outerR = 36 + Math.sin(phase) * 4
  const glow = ctx.createRadialGradient(cx, cy - 2, 4, cx, cy - 2, outerR * 1.25)
  glow.addColorStop(0, 'rgba(254, 240, 138, 0.95)')
  glow.addColorStop(0.45, 'rgba(249, 115, 22, 0.82)')
  glow.addColorStop(0.8, 'rgba(220, 38, 38, 0.35)')
  glow.addColorStop(1, 'rgba(220, 38, 38, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy - 2, outerR * 1.25, 0, Math.PI * 2)
  ctx.fill()

  // Ngọn lửa chính uốn lượn theo pha
  const sway = Math.sin(phase) * 6
  const height = 48 + Math.cos(phase * 2) * 5
  const flameGrad = ctx.createLinearGradient(cx, baseY, cx, baseY - height)
  flameGrad.addColorStop(0, '#fef08a')
  flameGrad.addColorStop(0.45, '#f97316')
  flameGrad.addColorStop(1, '#dc2626')
  ctx.fillStyle = flameGrad
  ctx.beginPath()
  ctx.moveTo(cx - 18, baseY)
  ctx.quadraticCurveTo(cx - 22 - sway * 0.4, baseY - height * 0.55, cx + sway, baseY - height)
  ctx.quadraticCurveTo(cx + 22 - sway * 0.4, baseY - height * 0.55, cx + 18, baseY)
  ctx.closePath()
  ctx.fill()

  // Lõi lửa sáng vàng trắng
  ctx.fillStyle = '#fef9c3'
  ctx.beginPath()
  ctx.moveTo(cx - 9, baseY)
  ctx.quadraticCurveTo(cx - 10, baseY - height * 0.38, cx + sway * 0.5, baseY - height * 0.62)
  ctx.quadraticCurveTo(cx + 10, baseY - height * 0.38, cx + 9, baseY)
  ctx.closePath()
  ctx.fill()
}

function generateProceduralSpriteSheet(kind: string): string {
  if (typeof document === 'undefined') return ''
  const size = 512
  const cols = 4
  const rows = 4
  const cell = size / cols
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  if (kind === 'campfire_chroma') {
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(0, 0, size, size)
  }

  for (let i = 0; i < 16; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = col * cell + cell * 0.5
    const cy = row * cell + cell * 0.5
    const phase = (i / 16) * Math.PI * 2

    ctx.save()
    if (kind === 'campfire' || kind === 'campfire_chroma') {
      drawProceduralCampfireCell(ctx, cx, cy, phase, cell)
    } else if (kind === 'magic_orb') {
      const r = 34 + Math.sin(phase) * 5
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r * 1.45)
      grad.addColorStop(0, 'rgba(224, 242, 254, 1)')
      grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.95)')
      grad.addColorStop(0.7, 'rgba(139, 92, 246, 0.65)')
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.9)'
      ctx.lineWidth = 2.5
      for (let k = 0; k < 3; k++) {
        const a = phase + (k * Math.PI * 2) / 3
        ctx.beginPath()
        ctx.ellipse(cx, cy, r * 1.15, r * 0.42, a, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else if (kind === 'butterfly') {
      const flap = 0.32 + 0.68 * Math.abs(Math.cos(phase))
      ctx.translate(cx, cy + Math.sin(phase) * 4)
      for (const dir of [-1, 1]) {
        ctx.save()
        ctx.scale(dir * flap, 1)
        const wGrad = ctx.createRadialGradient(18, -6, 2, 22, 0, 44)
        wGrad.addColorStop(0, 'rgba(167, 243, 208, 0.98)')
        wGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.9)')
        wGrad.addColorStop(1, 'rgba(59, 130, 246, 0.15)')
        ctx.fillStyle = wGrad
        ctx.beginPath()
        ctx.moveTo(0, -4)
        ctx.bezierCurveTo(22, -38, 52, -24, 38, 4)
        ctx.bezierCurveTo(26, 12, 10, 6, 0, 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(0, 2)
        ctx.bezierCurveTo(18, 6, 34, 24, 20, 34)
        ctx.bezierCurveTo(10, 38, 3, 20, 0, 8)
        ctx.fill()
        ctx.restore()
      }
      ctx.fillStyle = '#e2e8f0'
      ctx.beginPath()
      ctx.ellipse(0, 2, 3.2, 16, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      const baseR = 32
      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 52)
      glow.addColorStop(0, 'rgba(254, 249, 195, 0.85)')
      glow.addColorStop(0.45, 'rgba(56, 189, 248, 0.55)')
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, 52, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#e0f2fe'
      ctx.lineWidth = 2.6
      ctx.beginPath()
      const segments = 14
      for (let s = 0; s <= segments; s++) {
        const a = (s / segments) * Math.PI * 2 + phase * 0.5
        const jitter = Math.sin(s * 3.7 + i * 1.9) * 9
        const rad = baseR + jitter
        const px = cx + Math.cos(a) * rad
        const py = cy + Math.sin(a) * rad
        if (s === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}

/**
 * Phục hồi URL đầy đủ (Blob URL hoặc Data URL) từ đường dẫn asset / built-in / disk / procedural
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

  const cached = _resolvedUrlCache.get(trimmed)
  if (cached) return cached

  if (trimmed.startsWith('procedural-loop:')) {
    const kind = trimmed.slice('procedural-loop:'.length)
    const dataUrl = generateProceduralSpriteSheet(kind)
    if (dataUrl) {
      _resolvedUrlCache.set(trimmed, dataUrl)
      return dataUrl
    }
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
      const blobUrl = URL.createObjectURL(blob)
      _resolvedUrlCache.set(trimmed, blobUrl)
      return blobUrl
    }
  } catch {
    /* ignore */
  }

  // 3. Fallback cho các mẫu campfire mặc định nếu file demo không có trên ổ đĩa
  if (trimmed.includes('campfire_loop_chroma')) {
    const dataUrl = generateProceduralSpriteSheet('campfire_chroma')
    if (dataUrl) {
      _resolvedUrlCache.set(trimmed, dataUrl)
      return dataUrl
    }
  }
  if (trimmed.includes('campfire_loop')) {
    const dataUrl = generateProceduralSpriteSheet('campfire')
    if (dataUrl) {
      _resolvedUrlCache.set(trimmed, dataUrl)
      return dataUrl
    }
  }

  return trimmed
}

export const SAMPLE_LOOP_PRESETS: SampleLoopPreset[] = [
  {
    id: 'loop_preset_campfire',
    name: 'Lửa Trại Bập Bùng (Đã Tách Nền)',
    category: 'fire',
    badge: '🔥 Lửa 16F',
    description: 'Ngọn lửa trại cháy lặp 16 frame mượt mà đã tách nền trong suốt, kết hợp nháy sáng ấm áp.',
    imageUrl: 'procedural-loop:campfire',
    defaultGrid: { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 },
    defaultChroma: {
      enabled: false,
      keyColor: '#ff00ff',
      similarity: 0.34,
      smoothness: 0.12,
      spill: 0.25
    },
    defaultFps: 14,
    defaultLoopMode: 'loop',
    defaultSpeed: 1,
    defaultRhythm: {
      rhythmMode: 'flicker_opacity',
      rhythmRateHz: 3.2,
      rhythmIntensity: 0.25,
      minOpacity: 0.72,
      scaleBeatPct: 8
    }
  },
  {
    id: 'campfire_chroma',
    name: 'Lửa Trại 16F (Nền Hồng Chroma)',
    category: 'fire',
    badge: '🔥 Chroma 16F',
    description: 'Sprite sheet 4×4 trên nền hồng Magenta (#ff00ff), tự động khử nền bằng Chroma Key.',
    imageUrl: 'procedural-loop:campfire_chroma',
    defaultGrid: { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 },
    defaultChroma: {
      enabled: true,
      keyColor: '#ff00ff',
      similarity: 0.38,
      smoothness: 0.12,
      spill: 0.25
    },
    defaultFps: 12,
    defaultLoopMode: 'loop',
    defaultSpeed: 1,
    defaultRhythm: {
      rhythmMode: 'sync_both',
      rhythmRateHz: 2.8,
      rhythmIntensity: 0.3,
      minOpacity: 0.7,
      scaleBeatPct: 9
    }
  },
  {
    id: 'loop_preset_magic_orb',
    name: 'Cầu Năng Lượng Ma Thuật (16F)',
    category: 'magic',
    badge: '✨ Phép thuật 16F',
    description: 'Quả cầu plasma xanh tím xoay tròn phát tia năng lượng lặp vô tận.',
    imageUrl: 'procedural-loop:magic_orb',
    defaultGrid: { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 },
    defaultChroma: {
      enabled: false,
      keyColor: '#00ff00',
      similarity: 0.34,
      smoothness: 0.12,
      spill: 0.25
    },
    defaultFps: 12,
    defaultLoopMode: 'loop',
    defaultSpeed: 1,
    defaultRhythm: {
      rhythmMode: 'pulse_scale',
      rhythmRateHz: 1.8,
      rhythmIntensity: 0.45,
      minOpacity: 0.65,
      scaleBeatPct: 14
    }
  },
  {
    id: 'loop_preset_butterfly',
    name: 'Bướm Xanh Vỗ Cánh (16F)',
    category: 'nature',
    badge: '🦋 Sinh vật 16F',
    description: 'Cánh bướm phát sáng vỗ nhịp nhàng cho cảnh rừng thần tiên.',
    imageUrl: 'procedural-loop:butterfly',
    defaultGrid: { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 },
    defaultChroma: {
      enabled: false,
      keyColor: '#00ff00',
      similarity: 0.34,
      smoothness: 0.12,
      spill: 0.25
    },
    defaultFps: 16,
    defaultLoopMode: 'ping-pong',
    defaultSpeed: 1,
    defaultRhythm: {
      rhythmMode: 'none',
      rhythmRateHz: 2.0,
      rhythmIntensity: 0.3,
      minOpacity: 0.6,
      scaleBeatPct: 10
    }
  },
  {
    id: 'loop_preset_lightning',
    name: 'Vòng Sét Điện Từ (16F)',
    category: 'electric',
    badge: '⚡ Điện 16F',
    description: 'Tia hồ quang điện phóng xung quanh tâm cho hiệu ứng chiến đấu.',
    imageUrl: 'procedural-loop:lightning',
    defaultGrid: { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 },
    defaultChroma: {
      enabled: false,
      keyColor: '#00ff00',
      similarity: 0.34,
      smoothness: 0.12,
      spill: 0.25
    },
    defaultFps: 18,
    defaultLoopMode: 'random',
    defaultSpeed: 1.2,
    defaultRhythm: {
      rhythmMode: 'strobe_beat',
      rhythmRateHz: 4.5,
      rhythmIntensity: 0.5,
      minOpacity: 0.35,
      scaleBeatPct: 15
    }
  }
]

export const BUILTIN_LOOP_PRESETS = SAMPLE_LOOP_PRESETS
