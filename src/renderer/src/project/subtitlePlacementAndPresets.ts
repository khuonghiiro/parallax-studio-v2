import type {
  Layer,
  Project,
  SubtitleBubbleTail,
  SubtitleDefaultsConfig,
  SubtitlePositionPreset,
  SubtitleStylePresetId,
  Vec3
} from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { autoScaleFactor, referenceDistance } from '../animation/math'

export interface SubtitlePresetOption {
  id: SubtitleStylePresetId
  label: string
  shortLabel: string
  badge: string
  preserveByDefault?: boolean
  config: Omit<SubtitleDefaultsConfig, 'presetId' | 'syncHoldTargetLayer'>
}

export const SUBTITLE_PLANE_Z = -320

export const SUBTITLE_STYLE_PRESETS: SubtitlePresetOption[] = [
  {
    id: 'lugia_cyan',
    label: 'Trắng Nghiêng Viền Xanh Ngọc (Chuẩn Hoạt Ảnh 2.5D)',
    shortLabel: '💎 Lugia Viền Xanh',
    badge: '💎',
    config: {
      fontFamily: 'Montserrat',
      fontSize: 36,
      fontWeight: 900,
      italic: true,
      color: '#ffffff',
      strokeColor: '#072a4d',
      strokeWidth: 7,
      glowColor: '#38bdf8',
      boxColor: '',
      boxOpacity: 0,
      boxBorderColor: '',
      bubbleTail: 'none',
      maxCharsPerLine: 44,
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -405,
      enterEffect: 'fade',
      exitEffect: 'fade',
      fadeInDuration: 0.14,
      fadeOutDuration: 0.14
    }
  },
  {
    id: 'dino_white_pill',
    label: 'Hộp Trắng Viên Thuốc (Chuẩn Shadiao 2.5D)',
    shortLabel: '⬜ Hộp Trắng Shadiao',
    badge: '⬜',
    config: {
      fontFamily: 'Be Vietnam Pro',
      fontSize: 34,
      fontWeight: 800,
      italic: false,
      color: '#0f172a',
      strokeColor: '',
      strokeWidth: 0,
      glowColor: '',
      boxColor: '#ffffff',
      boxOpacity: 0.96,
      boxBorderColor: '#cbd5e1',
      bubbleTail: 'none',
      maxCharsPerLine: 42,
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -415,
      enterEffect: 'fade',
      exitEffect: 'fade',
      fadeInDuration: 0.12,
      fadeOutDuration: 0.12
    }
  },
  {
    id: 'cinema_gold',
    label: 'Vàng Kim Điện Ảnh (Viền Mực Đậm)',
    shortLabel: '🌟 Vàng Điện Ảnh',
    badge: '🌟',
    config: {
      fontFamily: 'Montserrat',
      fontSize: 38,
      fontWeight: 900,
      italic: true,
      color: '#fde047',
      strokeColor: '#1c1917',
      strokeWidth: 7,
      glowColor: '#f59e0b',
      boxColor: '',
      boxOpacity: 0,
      boxBorderColor: '',
      bubbleTail: 'none',
      maxCharsPerLine: 44,
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -405,
      enterEffect: 'fade',
      exitEffect: 'fade',
      fadeInDuration: 0.15,
      fadeOutDuration: 0.15
    }
  },
  {
    id: 'netflix_box',
    label: 'Hộp Nền Đen Mờ (Chuẩn Phim Phụ Đề)',
    shortLabel: '🎬 Hộp Đen Mờ',
    badge: '🎬',
    config: {
      fontFamily: 'Be Vietnam Pro',
      fontSize: 35,
      fontWeight: 800,
      italic: false,
      color: '#f8fafc',
      strokeColor: '#020617',
      strokeWidth: 3,
      glowColor: '',
      boxColor: '#090d16',
      boxOpacity: 0.82,
      boxBorderColor: '#334155',
      bubbleTail: 'none',
      maxCharsPerLine: 44,
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -408,
      enterEffect: 'slide_up',
      exitEffect: 'fade',
      fadeInDuration: 0.16,
      fadeOutDuration: 0.14
    }
  },
  {
    id: 'comic_bubble',
    label: 'Hộp Thoại Truyện Tranh (Có Đuôi Trỏ Nhân Vật)',
    shortLabel: '💬 Hộp Thoại Comic',
    badge: '💬',
    preserveByDefault: true,
    config: {
      fontFamily: 'Be Vietnam Pro',
      fontSize: 32,
      fontWeight: 800,
      italic: false,
      color: '#0f172a',
      strokeColor: '',
      strokeWidth: 0,
      glowColor: '',
      boxColor: '#ffffff',
      boxOpacity: 0.98,
      boxBorderColor: '#0f172a',
      bubbleTail: 'left',
      maxCharsPerLine: 28,
      align: 'center',
      positionPreset: 'speech_right',
      offsetX: 0,
      offsetY: 110,
      enterEffect: 'pop_bounce',
      exitEffect: 'scale_out',
      fadeInDuration: 0.16,
      fadeOutDuration: 0.14
    }
  },
  {
    id: 'comic_shout',
    label: 'Quát Lớn Nổi Giận (Đặc Biệt · Khoá 🔒)',
    shortLabel: '💢 Quát Lớn 🔒',
    badge: '💢',
    preserveByDefault: true,
    config: {
      fontFamily: 'Montserrat',
      fontSize: 42,
      fontWeight: 900,
      italic: true,
      color: '#fef08a',
      strokeColor: '#7f1d1d',
      strokeWidth: 8,
      glowColor: '#ef4444',
      boxColor: '#450a0a',
      boxOpacity: 0.8,
      boxBorderColor: '#f87171',
      bubbleTail: 'none',
      maxCharsPerLine: 36,
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -395,
      enterEffect: 'pop_bounce',
      exitEffect: 'scale_out',
      fadeInDuration: 0.18,
      fadeOutDuration: 0.16
    }
  },
  {
    id: 'inner_thought',
    label: 'Độc Thoại Nội Tâm (Đặc Biệt · Khoá 🔒)',
    shortLabel: '💭 Nội Tâm 🔒',
    badge: '💭',
    preserveByDefault: true,
    config: {
      fontFamily: 'Be Vietnam Pro',
      fontSize: 33,
      fontWeight: 700,
      italic: true,
      color: '#f3e8ff',
      strokeColor: '#2e1065',
      strokeWidth: 5,
      glowColor: '#a855f7',
      boxColor: '#1e1b4b',
      boxOpacity: 0.78,
      boxBorderColor: '#c084fc',
      bubbleTail: 'none',
      maxCharsPerLine: 40,
      align: 'center',
      positionPreset: 'top_center',
      offsetX: 0,
      offsetY: 370,
      enterEffect: 'fade',
      exitEffect: 'fade',
      fadeInDuration: 0.24,
      fadeOutDuration: 0.24
    }
  },
  {
    id: 'system_hologram',
    label: 'Thông Báo Hệ Thống (Đặc Biệt · Khoá 🔒)',
    shortLabel: '🤖 Hệ Thống 🔒',
    badge: '🤖',
    preserveByDefault: true,
    config: {
      fontFamily: 'Montserrat',
      fontSize: 35,
      fontWeight: 900,
      italic: false,
      color: '#7dd3fc',
      strokeColor: '#082f49',
      strokeWidth: 6,
      glowColor: '#38bdf8',
      boxColor: '#082f49',
      boxOpacity: 0.88,
      boxBorderColor: '#38bdf8',
      bubbleTail: 'none',
      maxCharsPerLine: 40,
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -395,
      enterEffect: 'pop_bounce',
      exitEffect: 'fade',
      fadeInDuration: 0.16,
      fadeOutDuration: 0.14
    }
  }
]

/** Ngắt dòng cân bằng (chống rớt 1 từ ngắn mồ côi sang dòng 2 như "ĐI.") */
export function wrapBalancedSubtitle(raw: string, maxCharsPerLine = 42): string {
  const clean = raw.trim().replace(/\s+/g, ' ')
  if (!clean || clean.includes('\n') || clean.length <= maxCharsPerLine) return clean
  const words = clean.split(' ')
  if (words.length <= 2) return clean

  // Nếu vừa trong 2 dòng: tìm điểm cắt gần giữa nhất (ưu tiên ngay sau dấu phẩy/chấm hỏi/chấm than)
  if (clean.length <= maxCharsPerLine * 2) {
    const half = clean.length * 0.5
    let bestIdx = 1
    let bestScore = Infinity
    let acc = 0
    for (let i = 0; i < words.length - 1; i++) {
      acc += (i > 0 ? 1 : 0) + words[i].length
      const rem = clean.length - acc - 1
      if (acc > maxCharsPerLine + 4 || rem > maxCharsPerLine + 4) continue
      const punctBonus = /[,;:.?!—–]$/.test(words[i]) ? -5.5 : 0
      const widowPenalty = i === 0 || i === words.length - 2 ? 12 : 0
      const score = Math.abs(acc - half) + punctBonus + widowPenalty
      if (score < bestScore) {
        bestScore = score
        bestIdx = i + 1
      }
    }
    return `${words.slice(0, bestIdx).join(' ')}\n${words.slice(bestIdx).join(' ')}`
  }

  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxCharsPerLine && cur.length > 0) {
      lines.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) {
    // Nếu dòng cuối chỉ còn 1 từ ngắn <= 5 ký tự, mượn 1 từ cuối của dòng kế trước sang
    if (lines.length >= 1 && !cur.includes(' ') && cur.length <= 5) {
      const prevWords = lines[lines.length - 1].split(' ')
      if (prevWords.length >= 3) {
        const moved = prevWords.pop()!
        lines[lines.length - 1] = prevWords.join(' ')
        cur = `${moved} ${cur}`
      }
    }
    lines.push(cur)
  }
  return lines.join('\n')
}

export function defaultOffsetYForPreset(pos: SubtitlePositionPreset): number {
  switch (pos) {
    case 'bottom_center':
      return -405
    case 'top_center':
      return 370
    case 'above_speaker':
      return 220
    case 'below_speaker':
      return -250
    case 'speech_left':
    case 'speech_right':
      return 110
    case 'custom':
    default:
      return -405
  }
}

export function resolveBubbleTailForPreset(
  pos: SubtitlePositionPreset,
  explicitTail?: SubtitleBubbleTail
): SubtitleBubbleTail {
  if (explicitTail && explicitTail !== 'none') return explicitTail
  if (pos === 'speech_right') return 'left'
  if (pos === 'speech_left') return 'right'
  if (pos === 'above_speaker') return 'bottom'
  return explicitTail ?? 'none'
}

/** Chiếu vị trí nhân vật nói trong không gian 3D sang toạ độ màn hình 2D 1080p chuẩn */
export function projectSpeakerScreenCenter(
  project: Project,
  speakerLayer: Layer | undefined,
  atTime: number
): { screenX: number; screenY: number } {
  if (!speakerLayer) return { screenX: 0, screenY: 0 }
  const refD = Math.max(100, referenceDistance(project.comp))
  const spPos: Vec3 = evaluate(speakerLayer.transform.position, atTime)
  const pFactor = refD / Math.max(80, refD + (spPos[2] ?? 0))
  return {
    screenX: spPos[0] * pFactor,
    screenY: spPos[1] * pFactor
  }
}

/**
 * Tính tọa độ không gian (X, Y, Z) chuẩn xác 1:1 theo pixel màn hình 1080p tại mặt phẳng `subZ = -320`:
 * - Mọi `offsetX` và `offsetY` đều tính bằng pixel trên khung 1920x1080 (tâm 0,0; Y hướng lên).
 * - Không bao giờ dùng `offsetY || default` để tránh lỗi nhảy vị trí khi người dùng kéo về `Y = 0`.
 */
export function computeSubtitlePlacement(
  project: Project,
  speakerLayer: Layer | undefined,
  positionPreset: SubtitlePositionPreset,
  offsetX: number,
  offsetY: number,
  atTime: number
): { position: Vec3; scale: number; screenX: number; screenY: number } {
  const subZ = SUBTITLE_PLANE_Z
  const perspK = autoScaleFactor(subZ, project.comp)
  const safeScale = 0.9
  const halfW = Math.max(240, (project.comp.width || 1920) * 0.44)
  const halfH = Math.max(160, (project.comp.height || 1080) * 0.46)
  const clampX = (x: number): number => Math.max(-halfW, Math.min(halfW, x))
  const clampY = (y: number): number => Math.max(-halfH, Math.min(halfH, y))

  const ox = Number.isFinite(offsetX) ? offsetX : 0
  const oy = Number.isFinite(offsetY) ? offsetY : defaultOffsetYForPreset(positionPreset)
  const sp = projectSpeakerScreenCenter(project, speakerLayer, atTime)

  let screenX = 0
  let screenY = -405

  switch (positionPreset) {
    case 'top_center':
      screenX = clampX(ox)
      screenY = clampY(oy)
      break
    case 'above_speaker':
      screenX = clampX(sp.screenX + ox)
      screenY = clampY(sp.screenY + oy)
      break
    case 'below_speaker':
      screenX = clampX(sp.screenX + ox)
      screenY = clampY(sp.screenY + oy)
      break
    case 'speech_left':
      screenX = clampX(sp.screenX - 270 + ox)
      screenY = clampY(sp.screenY + oy)
      break
    case 'speech_right':
      screenX = clampX(sp.screenX + 270 + ox)
      screenY = clampY(sp.screenY + oy)
      break
    case 'custom':
      screenX = clampX(ox)
      screenY = clampY(oy)
      break
    case 'bottom_center':
    default:
      screenX = clampX(ox)
      screenY = clampY(oy)
      break
  }

  return {
    position: [Math.round(screenX * perspK), Math.round(screenY * perspK), subZ],
    scale: safeScale,
    screenX: Math.round(screenX),
    screenY: Math.round(screenY)
  }
}
