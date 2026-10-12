import type { AudioTrackItem, Layer, Project, Vec3 } from '@shared/types'
import { assetStore } from './assets'
import { getAudioPeaks } from './audioPeaks'

/** Cache đồng bộ bộ đệm sóng âm đã nạp trong runtime để tra cứu 60fps */
const syncPeakCache = new Map<string, Float32Array>()

/** Nạp trước đệm sóng âm vào RAM */
export async function preloadAudioPeaks(assetId: string): Promise<Float32Array> {
  let peaks = syncPeakCache.get(assetId)
  if (!peaks) {
    peaks = await getAudioPeaks(assetId, 2400)
    if (peaks && peaks.length > 0) {
      syncPeakCache.set(assetId, peaks)
    }
  }
  return peaks || new Float32Array(0)
}

/**
 * Lấy biên độ sóng âm tại thời điểm timeline t (giây).
 * Trả về giá trị chuẩn hóa 0..1.
 */
export function sampleAudioPeakAtTime(
  track: AudioTrackItem,
  t: number,
  assetDuration: number
): number {
  if (t < track.offset) return 0
  const rate = track.playbackRate || 1
  const trimIn = track.trimIn || 0
  const trackDur = track.duration ?? (assetDuration > 0 ? (assetDuration - trimIn) / rate : 0)
  if (trackDur > 0 && t > track.offset + trackDur) return 0

  const localTime = (t - track.offset) * rate + trimIn
  if (localTime < 0 || (assetDuration > 0 && localTime > assetDuration)) return 0

  const peaks = syncPeakCache.get(track.assetId)
  if (!peaks || peaks.length === 0) {
    // Kích hoạt preload chạy ngầm cho các khung hình tiếp theo
    preloadAudioPeaks(track.assetId).catch(() => undefined)
    return 0
  }

  const effectiveDuration = assetDuration > 0 ? assetDuration : 10
  const ratio = Math.max(0, Math.min(1, localTime / effectiveDuration))
  const index = Math.min(peaks.length - 1, Math.floor(ratio * peaks.length))

  const baseAmp = peaks[index] || 0
  return Math.max(0, Math.min(1, baseAmp * Math.min(1.5, track.volume)))
}

function normalizeVietnamese(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/** Biểu thức regex nhận diện layer miệng của nhân vật */
const MOUTH_REGEX = /(?:^|[\s\-_.[\]()/\\])(mouth|mieng|lips?|moi|khau[-_ ]?hinh|cuoi|smile|jaw)(?:[\s\-_.[\]()/\\]|$)/i

/** Kiểm tra xem một layer có phải là layer miệng hay không */
export function isMouthLayer(layer: Layer): boolean {
  if (!layer || !layer.name) return false
  const raw = `${layer.name} ${layer.id || ''}`
  if (MOUTH_REGEX.test(raw)) return true
  const norm = normalizeVietnamese(raw)
  return MOUTH_REGEX.test(norm)
}

/** Tìm layer miệng của một cụm nhân vật */
export function findMouthLayerForCharacter(
  layers: Layer[],
  characterInstanceId: string,
  customMouthLayerId?: string
): Layer | undefined {
  const characterLayers = layers.filter(
    (l) => l.composite && l.composite.instanceId === characterInstanceId
  )
  if (characterLayers.length === 0) return undefined

  if (customMouthLayerId) {
    const designated = characterLayers.find((l) => l.id === customMouthLayerId)
    if (designated) return designated
  }

  // Ưu tiên tìm layer có tên hoặc id khớp với pattern miệng
  return characterLayers.find(isMouthLayer)
}

export interface EvaluatedLipSync {
  active: boolean
  amplitude: number
  scaleY: number
  scaleX: number
  offsetY: number
}

const INACTIVE_LIP_SYNC: EvaluatedLipSync = {
  active: false,
  amplitude: 0,
  scaleY: 1,
  scaleX: 1,
  offsetY: 0
}

/**
 * Đánh giá biến đổi khẩu hình miệng cho một layer tại thời điểm t.
 * Nếu layer thuộc nhân vật đang có audio track thoại bật lip-sync,
 * tính toán mức độ mở hé miệng và dịch chuyển hàm dưới.
 */
export function evaluateCharacterLipSync(
  project: Project,
  layer: Layer,
  t: number
): EvaluatedLipSync {
  if (!layer.composite?.instanceId && !layer.id) return INACTIVE_LIP_SYNC
  const tracks = project.audioTracks || (project.audio ? [project.audio as AudioTrackItem] : [])
  if (tracks.length === 0) return INACTIVE_LIP_SYNC

  // Tìm audio track đang phát gắn cho nhân vật này hoặc layer này
  const charId = layer.composite?.instanceId
  const matchingTrack = tracks.find((tr) => {
    if (tr.muted) return false
    const isTargetChar = tr.targetType === 'character' && tr.targetId === charId
    const isTargetLayer = tr.targetType === 'layer' && tr.targetId === layer.id
    if (!isTargetChar && !isTargetLayer) return false

    // Phải là giọng nói thoại hoặc được bật lip-sync rõ ràng
    const isVoiceOrLipSync = tr.lipSyncEnabled || tr.characterRole === 'voice' || !tr.characterRole
    if (!isVoiceOrLipSync) return false

    // Kiểm tra thời gian t có nằm trong track không
    const rate = tr.playbackRate || 1
    const meta = assetStore.get(tr.assetId)?.meta
    const dur = tr.duration ?? (meta?.duration ? meta.duration / rate : 60)
    return t >= tr.offset && t <= tr.offset + dur
  })

  if (!matchingTrack) return INACTIVE_LIP_SYNC

  // Kiểm tra xem layer hiện tại có phải là layer miệng được chỉ định hoặc tự động nhận diện
  const isTargetedMouth =
    matchingTrack.lipSyncLayerId === layer.id ||
    (!matchingTrack.lipSyncLayerId && isMouthLayer(layer)) ||
    (matchingTrack.targetType === 'layer' && matchingTrack.targetId === layer.id)

  if (!isTargetedMouth) return INACTIVE_LIP_SYNC

  const meta = assetStore.get(matchingTrack.assetId)?.meta
  const assetDur = meta?.duration ?? 0
  const amp = sampleAudioPeakAtTime(matchingTrack, t, assetDur)
  if (amp <= 0.01) return INACTIVE_LIP_SYNC

  const intensity = matchingTrack.lipSyncIntensity ?? 1.0

  // Khẩu hình miệng mở theo chiều dọc (Scale Y) và hơi mở nhẹ chiều ngang (Scale X)
  // Kèm độ dịch chuyển cằm/miệng xuống dưới (offsetY)
  const scaleY = 1.0 + amp * 0.7 * intensity
  const scaleX = 1.0 + amp * 0.18 * intensity
  const offsetY = -amp * 8.0 * intensity

  return {
    active: true,
    amplitude: amp,
    scaleY,
    scaleX,
    offsetY
  }
}

/**
 * Nướng keyframe khẩu hình miệng trực tiếp vào Timeline của layer miệng nhân vật (đồng bộ).
 */
export function bakeLipSyncToCharacterLayerSync(
  project: Project,
  trackId: string,
  options?: {
    fps?: number
    intensity?: number
    openThreshold?: number
  }
): { success: boolean; layerId?: string; bakedKeyframeCount: number } {
  const tracks = project.audioTracks || []
  const track = tracks.find((t) => t.id === trackId)
  if (!track) return { success: false, bakedKeyframeCount: 0 }

  const charId = track.targetId
  if (!charId && track.targetType !== 'layer') {
    return { success: false, bakedKeyframeCount: 0 }
  }

  // Tìm layer miệng mục tiêu
  let mouthLayer: Layer | undefined
  if (track.targetType === 'layer') {
    mouthLayer = project.layers.find((l) => l.id === track.targetId)
  } else {
    mouthLayer = findMouthLayerForCharacter(project.layers, charId!, track.lipSyncLayerId)
  }

  if (!mouthLayer) return { success: false, bakedKeyframeCount: 0 }

  const meta = assetStore.get(track.assetId)?.meta
  const assetDur = meta?.duration ?? 0

  const fps = options?.fps || project.comp.fps || 30
  const intensity = options?.intensity || track.lipSyncIntensity || 1.0
  const threshold = options?.openThreshold ?? 0.04

  const rate = track.playbackRate || 1
  const trimIn = track.trimIn || 0
  const trackDur = track.duration ?? (assetDur > 0 ? (assetDur - trimIn) / rate : 5)
  const startTime = track.offset
  const endTime = track.offset + trackDur

  const baseScale = [...mouthLayer.transform.scale.value] as Vec3
  const basePos = [...mouthLayer.transform.position.value] as Vec3

  const scaleKeys = mouthLayer.transform.scale.keyframes
  const posKeys = mouthLayer.transform.position.keyframes

  // Xóa các keyframe lip-sync cũ của track này trên layer
  const prefix = `lipsync-${track.id}-`
  mouthLayer.transform.scale.keyframes = scaleKeys.filter((k) => !k.id.startsWith(prefix))
  mouthLayer.transform.position.keyframes = posKeys.filter((k) => !k.id.startsWith(prefix))

  let keyCount = 0
  const step = 1 / fps

  for (let t = startTime; t <= endTime; t += step) {
    const amp = sampleAudioPeakAtTime(track, t, assetDur)
    const effectiveAmp = amp < threshold ? 0 : amp

    const scY = baseScale[1] * (1.0 + effectiveAmp * 0.7 * intensity)
    const scX = baseScale[0] * (1.0 + effectiveAmp * 0.18 * intensity)
    const posY = basePos[1] - effectiveAmp * 8.0 * intensity

    const frameIdx = Math.round((t - startTime) * fps)
    mouthLayer.transform.scale.keyframes.push({
      id: `${prefix}s-${frameIdx}`,
      t: Math.round(t * 1000) / 1000,
      value: [scX, scY, baseScale[2]],
      ease: 'easeOut'
    })
    mouthLayer.transform.position.keyframes.push({
      id: `${prefix}p-${frameIdx}`,
      t: Math.round(t * 1000) / 1000,
      value: [basePos[0], posY, basePos[2]],
      ease: 'easeOut'
    })
    keyCount += 2
  }

  // Khôi phục trạng thái miệng đóng ở cuối track
  const closeTime = Math.round((endTime + step) * 1000) / 1000
  mouthLayer.transform.scale.keyframes.push({
    id: `${prefix}s-close`,
    t: closeTime,
    value: [...baseScale] as Vec3,
    ease: 'easeOut'
  })
  mouthLayer.transform.position.keyframes.push({
    id: `${prefix}p-close`,
    t: closeTime,
    value: [...basePos] as Vec3,
    ease: 'easeOut'
  })
  keyCount += 2

  // Sắp xếp keyframes theo thời gian t tăng dần
  mouthLayer.transform.scale.keyframes.sort((a, b) => a.t - b.t)
  mouthLayer.transform.position.keyframes.sort((a, b) => a.t - b.t)

  return {
    success: true,
    layerId: mouthLayer.id,
    bakedKeyframeCount: keyCount
  }
}

/**
 * Nướng keyframe khẩu hình miệng trực tiếp vào Timeline của layer miệng nhân vật (async có preload).
 */
export async function bakeLipSyncToCharacterLayer(
  project: Project,
  trackId: string,
  options?: {
    fps?: number
    intensity?: number
    openThreshold?: number
  }
): Promise<{ success: boolean; layerId?: string; bakedKeyframeCount: number }> {
  const tracks = project.audioTracks || []
  const track = tracks.find((t) => t.id === trackId)
  if (track) {
    await preloadAudioPeaks(track.assetId)
  }
  return bakeLipSyncToCharacterLayerSync(project, trackId, options)
}

