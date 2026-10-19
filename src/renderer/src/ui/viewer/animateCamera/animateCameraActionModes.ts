import type { CameraFrame2D } from './animateCameraMath'

export type CameraActionMode =
  | 'pan'
  | 'push-in'
  | 'extreme-closeup'
  | 'pull-out'
  | 'establishing'
  | 'hold'
  | 'cut'
  | 'whip-pan'
  | 'crane-up'
  | 'crane-down'
  | 'sweep-left'
  | 'sweep-right'
  | 'tilt-sky'
  | 'aerial-dive'
  | 'orbit-left'
  | 'orbit-right'
  | 'hero-low'
  | 'bird-eye'
  | 'dutch-tilt'
  | 'corkscrew'
  | 'high-angle'
  | 'low-angle'

export type CameraActionCategory = 'all' | 'core' | 'crane-sweep' | 'cinematic-3d'

export interface CameraActionModeMeta {
  id: CameraActionMode
  category: Exclude<CameraActionCategory, 'all'>
  icon: string
  label: string
  badgeLabel: string
  tagLabel?: string
  tag: 'start' | 'pan' | 'zoom-in' | 'zoom-out' | 'hold'
  hint: string
}

export const CAMERA_ACTION_CATEGORIES: { id: CameraActionCategory; label: string; hint: string }[] = [
  { id: 'all', label: 'Tất cả (20)', hint: 'Hiển thị toàn bộ 20 động tác quay phim & hoạt hình 2.5D chuyên nghiệp' },
  { id: 'core', label: '🎥 Cơ bản', hint: 'Lia cân bằng, Đẩy cận, Đặc tả 240%, Kéo rộng, Chuẩn 100%, Dừng ngắm, Cắt cảnh, Lia vút' },
  { id: 'crane-sweep', label: '🏗 Cần cẩu', hint: 'Cần cẩu nâng/hạ, Quét ngang Trái/Phải, Ngước bầu trời, Lao từ trên cao' },
  { id: 'cinematic-3d', label: '🌐 Góc 3D', hint: 'Quỹ đạo 3D Trái/Phải, Góc Hùng vĩ, Góc Toàn không, Nghiêng máy, Xoáy cận 3D' }
]

export const CAMERA_ACTION_MODES: CameraActionModeMeta[] = [
  // 1. Nhóm Cơ bản & Tiêu cự (Core & Focal / Dolly Moves)
  {
    id: 'pan',
    category: 'core',
    icon: '↔',
    label: 'Lia cân bằng',
    badgeLabel: 'Lia cân bằng',
    tag: 'pan',
    hint: 'Smooth Pan: Lia máy mượt mà theo phương ngang/dọc với đường chân trời thẳng 0°'
  },
  {
    id: 'push-in',
    category: 'core',
    icon: '🔍+',
    label: 'Đẩy cận',
    badgeLabel: 'Đẩy cận (Dolly In)',
    tag: 'zoom-in',
    hint: 'Dolly Push-In: Thu hẹp khung ngắm đẩy tiến vào chủ thể để nhấn mạnh cảm xúc'
  },
  {
    id: 'extreme-closeup',
    category: 'core',
    icon: '👁',
    label: 'Đặc tả 240%',
    badgeLabel: 'Đặc tả chi tiết (240%)',
    tag: 'zoom-in',
    hint: 'Extreme Close-Up: Đẩy cực cận 240% vào điểm nhấn trung tâm kèm góc ngẩng nhẹ (-3°)'
  },
  {
    id: 'pull-out',
    category: 'core',
    icon: '🔍-',
    label: 'Kéo rộng',
    badgeLabel: 'Kéo rộng (Reveal)',
    tag: 'zoom-out',
    hint: 'Dolly Pull-Out: Mở rộng khung ngắm lùi ra xa để hé lộ toàn cảnh không gian'
  },
  {
    id: 'establishing',
    category: 'core',
    icon: '🏛',
    label: 'Chuẩn 100%',
    badgeLabel: 'Toàn cảnh chuẩn 100%',
    tag: 'pan',
    hint: 'Establishing Shot: Căn tâm máy chuẩn 1:1 (100%) chính giữa cảnh và đặt góc 3D về 0°'
  },
  {
    id: 'hold',
    category: 'core',
    icon: '⏸',
    label: 'Dừng ngắm',
    badgeLabel: 'Dừng ngắm cảnh',
    tag: 'hold',
    hint: 'Camera Hold: Giữ nguyên khung hình của mốc trước để người xem thưởng thức bối cảnh'
  },
  {
    id: 'cut',
    category: 'core',
    icon: '⚡',
    label: 'Cắt cảnh',
    badgeLabel: 'Cắt cảnh tức thì',
    tag: 'pan',
    hint: 'Jump Cut: Chuyển thẳng sang khung hình này ngay lập tức mà không lia máy ở giữa'
  },
  {
    id: 'whip-pan',
    category: 'core',
    icon: '💨',
    label: 'Lia vút',
    badgeLabel: 'Lia vút nhanh (Whip)',
    tag: 'pan',
    hint: 'Whip Pan: Lia vút tốc độ cao với gia tốc mạnh (Strong Ease) kèm nghiêng máy động năng (±5°)'
  },

  // 2. Nhóm Cần cẩu & Quét cảnh (Crane, Pedestal & Tracking Sweep)
  {
    id: 'crane-up',
    category: 'crane-sweep',
    icon: '⤴',
    label: 'Cần cẩu lên',
    badgeLabel: 'Cần cẩu nâng cao',
    tag: 'pan',
    hint: 'Crane Up: Nâng máy từ dưới lên cao nhìn bao quát xuống bối cảnh (Pitch +18°, ΔY -18%)'
  },
  {
    id: 'crane-down',
    category: 'crane-sweep',
    icon: '⤵',
    label: 'Cần cẩu xuống',
    badgeLabel: 'Cần cẩu hạ thấp',
    tag: 'zoom-in',
    hint: 'Crane Down: Hạ máy từ trên cao đáp êm xuống ngang tầm chủ thể (Pitch -8°, ΔY +12%, Zoom 140%)'
  },
  {
    id: 'sweep-left',
    category: 'crane-sweep',
    icon: '⬅',
    label: 'Quét Trái',
    badgeLabel: 'Quét ngang Trái',
    tag: 'pan',
    hint: 'Tracking Left: Trượt máy sang phần bên trái của cảnh kèm góc liếc 3D nhẹ (Yaw -12°)'
  },
  {
    id: 'sweep-right',
    category: 'crane-sweep',
    icon: '➡',
    label: 'Quét Phải',
    badgeLabel: 'Quét ngang Phải',
    tag: 'pan',
    hint: 'Tracking Right: Trượt máy sang phần bên phải của cảnh kèm góc liếc 3D nhẹ (Yaw +12°)'
  },
  {
    id: 'tilt-sky',
    category: 'crane-sweep',
    icon: '🌤',
    label: 'Ngước trời',
    badgeLabel: 'Ngước bầu trời (Tilt Up)',
    tag: 'pan',
    hint: 'Sky Tilt Up: Hất góc máy ngước nhìn lên bầu trời hoặc đỉnh công trình (Pitch -22°)'
  },
  {
    id: 'aerial-dive',
    category: 'crane-sweep',
    icon: '🦅',
    label: 'Lao xuống',
    badgeLabel: 'Lao từ trên cao (Dive)',
    tag: 'zoom-in',
    hint: 'Aerial Dive: Lao nhanh từ góc cao xuống cận cảnh trung tâm (Pitch +24°, Roll -6°, Zoom 175%)'
  },

  // 3. Nhóm Không gian 3D Parallax & Góc Điện ảnh (3D Orbit & Cinematic Angles)
  {
    id: 'orbit-left',
    category: 'cinematic-3d',
    icon: '↺',
    label: 'Quỹ đạo Trái',
    badgeLabel: 'Quỹ đạo 3D Trái (-28°)',
    tag: 'pan',
    hint: '3D Orbit Left: Xoay vòng cung 3D sang trái (-28°) tạo hiệu ứng tách lớp chiều sâu 2.5D Parallax'
  },
  {
    id: 'orbit-right',
    category: 'cinematic-3d',
    icon: '↻',
    label: 'Quỹ đạo Phải',
    badgeLabel: 'Quỹ đạo 3D Phải (+28°)',
    tag: 'pan',
    hint: '3D Orbit Right: Xoay vòng cung 3D sang phải (+28°) tạo hiệu ứng tách lớp chiều sâu 2.5D Parallax'
  },
  {
    id: 'hero-low',
    category: 'cinematic-3d',
    icon: '🦸',
    label: 'Góc Hùng vĩ',
    badgeLabel: 'Góc Hùng vĩ (Hero Low)',
    tag: 'zoom-in',
    hint: 'Hero Low Angle: Đặt máy thấp hất ngược lên tôn vinh vẻ uy nghi của chủ thể (Pitch -22°, Yaw -12°)'
  },
  {
    id: 'bird-eye',
    category: 'cinematic-3d',
    icon: '🛰',
    label: 'Góc Toàn không',
    badgeLabel: 'Góc Toàn không (+32°)',
    tag: 'zoom-out',
    hint: "Bird's Eye View: Góc nhìn từ trên cao bao quát toàn bộ chiều sâu không gian 3D (Pitch +32°)"
  },
  {
    id: 'dutch-tilt',
    category: 'cinematic-3d',
    icon: '📐',
    label: 'Nghiêng máy',
    badgeLabel: 'Nghiêng kịch tính (Dutch)',
    tag: 'pan',
    hint: 'Dutch Angle Tilt: Xoay nghiêng đường chân trời (Roll ±15°) tạo cảm giác kịch tính, cao trào'
  },
  {
    id: 'corkscrew',
    category: 'cinematic-3d',
    icon: '🌀',
    label: 'Xoáy cận 3D',
    badgeLabel: 'Xoáy cận 3D (Corkscrew)',
    tag: 'zoom-in',
    hint: 'Corkscrew Spiral Push: Vừa đẩy cận cảnh 185% vừa xoay xoáy 3D (Roll ±18°, Yaw ±16°) cuốn hút'
  }
]

const MODE_META_MAP = new Map<CameraActionMode, CameraActionModeMeta>(
  CAMERA_ACTION_MODES.map((m) => [m.id, m])
)

export function getActionModeMeta(mode: CameraActionMode): CameraActionModeMeta | undefined {
  if (mode === 'high-angle') return MODE_META_MAP.get('bird-eye')
  if (mode === 'low-angle') return MODE_META_MAP.get('hero-low')
  return MODE_META_MAP.get(mode)
}

export interface WaypointTimingMeta {
  /** Tổng thời lượng của riêng mốc này (giây) */
  stepDuration?: number
  /** Đệm chờ tĩnh ở đầu mốc trước khi bắt đầu động tác quay (giây) */
  delaySec?: number
  /** Thời gian thực hiện động tác quay (giây: càng ít càng nhanh, càng lâu càng chậm) */
  actionDurationSec?: number
  /** Đánh dấu người dùng đã chỉnh riêng Đệm giây hoặc Thời gian động tác */
  hasCustomActionTiming?: boolean
}

// Lưu vết động tác quay chuyên nghiệp & thông số nhịp động tác tại từng mốc thời gian
const explicitActionModesByTimeKey = new Map<number, CameraActionMode>()
const waypointTimingMetaByTimeKey = new Map<number, WaypointTimingMeta>()

function timeToKey(time: number): number {
  return Math.round(time * 100)
}

export function recordExplicitActionMode(time: number, mode: CameraActionMode): void {
  explicitActionModesByTimeKey.set(timeToKey(time), mode)
}

export function getExplicitActionMode(time: number): CameraActionMode | undefined {
  return explicitActionModesByTimeKey.get(timeToKey(time))
}

export function setWaypointTimingMeta(time: number, patch: Partial<WaypointTimingMeta>): void {
  const key = timeToKey(time)
  const prev = waypointTimingMetaByTimeKey.get(key) ?? {}
  waypointTimingMetaByTimeKey.set(key, {
    ...prev,
    ...patch
  })
}

export function getWaypointTimingMeta(
  time: number,
  fallbackStepDuration = 2.0
): {
  stepDuration: number
  delaySec: number
  actionDurationSec: number
  hasCustomActionTiming: boolean
} {
  const raw = waypointTimingMetaByTimeKey.get(timeToKey(time))
  const stepDuration = Math.max(
    0.2,
    Math.round(((raw?.stepDuration ?? fallbackStepDuration) || 2.0) * 100) / 100
  )
  const maxSpan = Math.max(stepDuration, fallbackStepDuration)
  const delaySec = Math.max(
    0,
    Math.min(
      Math.max(0, Math.round((maxSpan - 0.2) * 100) / 100),
      Math.round((raw?.delaySec ?? 0) * 100) / 100
    )
  )
  const defaultActionDur = Math.max(0.2, Math.round((stepDuration - delaySec) * 100) / 100)
  const maxActionDur = Math.max(0.2, Math.round((maxSpan - delaySec) * 100) / 100)
  const actionDurationSec =
    raw?.actionDurationSec !== undefined
      ? Math.max(
          0.2,
          Math.min(maxActionDur, Math.round(raw.actionDurationSec * 100) / 100)
        )
      : defaultActionDur
  return {
    stepDuration,
    delaySec,
    actionDurationSec,
    hasCustomActionTiming: Boolean(raw?.hasCustomActionTiming)
  }
}

export function getActionVerbLabel(mode: CameraActionMode): string {
  switch (mode) {
    case 'push-in':
    case 'extreme-closeup':
      return 'đẩy cận'
    case 'pull-out':
    case 'establishing':
      return 'kéo rộng'
    case 'whip-pan':
      return 'lia vút'
    case 'crane-up':
      return 'nâng cẩu'
    case 'crane-down':
      return 'hạ cẩu'
    case 'sweep-left':
    case 'sweep-right':
      return 'quét máy'
    case 'tilt-sky':
      return 'ngước máy'
    case 'aerial-dive':
      return 'lao xuống'
    case 'orbit-left':
    case 'orbit-right':
      return 'xoay 3D'
    case 'hero-low':
    case 'low-angle':
    case 'bird-eye':
    case 'high-angle':
      return 'chuyển góc'
    case 'dutch-tilt':
      return 'nghiêng máy'
    case 'corkscrew':
      return 'xoáy cận 3D'
    case 'hold':
      return 'dừng ngắm'
    case 'cut':
      return 'cắt cảnh'
    case 'pan':
    default:
      return 'lia máy'
  }
}

export function moveExplicitActionMode(oldTime: number, newTime: number): void {
  const oldKey = timeToKey(oldTime)
  const newKey = timeToKey(newTime)
  if (oldKey === newKey) return
  const existing = explicitActionModesByTimeKey.get(oldKey)
  if (existing !== undefined) {
    explicitActionModesByTimeKey.delete(oldKey)
    explicitActionModesByTimeKey.set(newKey, existing)
  }
  const existingTiming = waypointTimingMetaByTimeKey.get(oldKey)
  if (existingTiming !== undefined) {
    waypointTimingMetaByTimeKey.delete(oldKey)
    waypointTimingMetaByTimeKey.set(newKey, existingTiming)
  }
}

export function shiftExplicitActionModes(afterTime: number, delta: number): void {
  if (Math.abs(delta) < 0.001) return
  const thresholdKey = timeToKey(afterTime)
  const entries = [...explicitActionModesByTimeKey.entries()].sort((a, b) =>
    delta > 0 ? b[0] - a[0] : a[0] - b[0]
  )
  for (const [k, mode] of entries) {
    if (k > thresholdKey + 2) {
      explicitActionModesByTimeKey.delete(k)
      const nextT = Math.max(0, k / 100 + delta)
      explicitActionModesByTimeKey.set(timeToKey(nextT), mode)
    }
  }
  const timingEntries = [...waypointTimingMetaByTimeKey.entries()].sort((a, b) =>
    delta > 0 ? b[0] - a[0] : a[0] - b[0]
  )
  for (const [k, meta] of timingEntries) {
    if (k > thresholdKey + 2) {
      waypointTimingMetaByTimeKey.delete(k)
      const nextT = Math.max(0, k / 100 + delta)
      waypointTimingMetaByTimeKey.set(timeToKey(nextT), meta)
    }
  }
}

export function clearExplicitActionModes(): void {
  explicitActionModesByTimeKey.clear()
  waypointTimingMetaByTimeKey.clear()
}

/**
 * Suy luận thông minh Động tác Quay (`actionMode`, `tag`, `tagLabel`) cho từng mốc lộ trình
 * kết hợp giữa động tác đã chọn tường minh và phân tích hình học 2D/3D của khung máy.
 */
export function inferWaypointActionClassification(
  f: CameraFrame2D,
  idx: number,
  prev: CameraFrame2D | null,
  durationFromPrev: number,
  zoomPct: number
): {
  tag: 'start' | 'pan' | 'zoom-in' | 'zoom-out' | 'hold'
  tagLabel: string
  actionMode: CameraActionMode
} {
  const explicit = getExplicitActionMode(f.time)
  if (explicit) {
    const meta = getActionModeMeta(explicit)
    if (meta) {
      return {
        tag: idx === 0 ? 'start' : meta.tag,
        tagLabel: meta.badgeLabel,
        actionMode: explicit
      }
    }
  }

  const isJumpCut = prev?.ease === 'hold'
  if (isJumpCut) {
    return {
      tag: 'pan',
      tagLabel: f.shotId && prev?.shotId && f.shotId !== prev.shotId ? `Cắt tới ${f.shotName}` : 'Cắt cảnh tức thì',
      actionMode: 'cut'
    }
  }

  // Fallback phân tích hình học từ toạ độ 2D, Scale và Góc 3D (Yaw, Pitch, Roll)
  const absRoll = Math.abs(f.roll)
  const absYaw = Math.abs(f.yaw)
  const absPitch = Math.abs(f.pitch)

  if (absRoll >= 14 && f.scale <= 0.62 && absYaw >= 10) {
    return { tag: 'zoom-in', tagLabel: 'Xoáy cận 3D (Corkscrew)', actionMode: 'corkscrew' }
  }
  if (absRoll >= 8) {
    return { tag: 'pan', tagLabel: `Nghiêng máy (${Math.round(f.roll)}°)`, actionMode: 'dutch-tilt' }
  }
  if (f.pitch <= -18 && f.scale <= 0.85) {
    return { tag: 'zoom-in', tagLabel: 'Góc Hùng vĩ (Hero Low)', actionMode: 'hero-low' }
  }
  if (f.pitch <= -18) {
    return { tag: 'pan', tagLabel: 'Ngước bầu trời (Tilt Up)', actionMode: 'tilt-sky' }
  }
  if (f.pitch >= 26 && f.scale >= 0.95) {
    return { tag: 'zoom-out', tagLabel: 'Góc Toàn không (+32°)', actionMode: 'bird-eye' }
  }
  if (f.pitch >= 20 && f.scale <= 0.68) {
    return { tag: 'zoom-in', tagLabel: 'Lao từ trên cao (Dive)', actionMode: 'aerial-dive' }
  }
  if (f.pitch >= 14) {
    return { tag: 'pan', tagLabel: 'Cần cẩu nâng cao', actionMode: 'crane-up' }
  }
  if (f.yaw <= -16) {
    return { tag: 'pan', tagLabel: `Quỹ đạo 3D Trái (${Math.round(f.yaw)}°)`, actionMode: 'orbit-left' }
  }
  if (f.yaw >= 16) {
    return { tag: 'pan', tagLabel: `Quỹ đạo 3D Phải (+${Math.round(f.yaw)}°)`, actionMode: 'orbit-right' }
  }
  if (f.scale <= 0.46) {
    return { tag: 'zoom-in', tagLabel: `Đặc tả (${zoomPct}%)`, actionMode: 'extreme-closeup' }
  }
  if (f.ease === 'easeInOutStrong' && absRoll >= 3) {
    return { tag: 'pan', tagLabel: 'Lia vút nhanh (Whip)', actionMode: 'whip-pan' }
  }

  if (idx === 0) {
    return { tag: 'start', tagLabel: 'Khung gốc (Bắt đầu)', actionMode: 'pan' }
  }

  if (prev) {
    const scaleDiff = f.scale - prev.scale
    const dist = Math.hypot(f.stageX - prev.stageX, f.stageY - prev.stageY)
    const angleDiff = Math.hypot(f.yaw - prev.yaw, f.pitch - prev.pitch, f.roll - prev.roll)

    if (dist <= 60 && Math.abs(scaleDiff) <= 0.12 && f.shotId === prev.shotId && angleDiff <= 5) {
      return {
        tag: 'hold',
        tagLabel: `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)`,
        actionMode: 'hold'
      }
    }
    if (scaleDiff < -0.04) {
      return { tag: 'zoom-in', tagLabel: `Đẩy cận (${zoomPct}%)`, actionMode: 'push-in' }
    }
    if (scaleDiff > 0.04) {
      return { tag: 'zoom-out', tagLabel: `Kéo rộng (${zoomPct}%)`, actionMode: 'pull-out' }
    }
    if (f.shotId && prev.shotId && f.shotId !== prev.shotId) {
      return { tag: 'pan', tagLabel: `Lia tới ${f.shotName}`, actionMode: 'pan' }
    }
    if (dist > 60 || angleDiff > 5) {
      return {
        tag: 'pan',
        tagLabel: angleDiff > 8 ? `Xoay góc 3D (${Math.round(f.yaw)}°)` : 'Lia cân bằng',
        actionMode: 'pan'
      }
    }
  }

  return {
    tag: 'hold',
    tagLabel: durationFromPrev > 0 ? `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)` : 'Điểm dừng',
    actionMode: 'hold'
  }
}
