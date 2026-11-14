import type { AudioTrackItem, Layer, Project, Vec3 } from '@shared/types'
import { wasmEvalLipSyncFrames } from '../engine/wasm/wasmAudioBridge'
import { assetStore } from './assets'
import { getAudioPeaks } from './audioPeaks'

/** Cache đồng bộ bộ đệm sóng âm đã nạp trong runtime để tra cứu 60fps */
const syncPeakCache = new Map<string, Float32Array>()
const pendingPreloadPeaks = new Map<string, Promise<Float32Array>>()

export function seedAudioPeaksCache(assetId: string, peaks: Float32Array): void {
  syncPeakCache.set(assetId, peaks)
}

/** Nạp trước đệm sóng âm vào RAM */
export async function preloadAudioPeaks(assetId: string): Promise<Float32Array> {
  const cached = syncPeakCache.get(assetId)
  if (cached) return cached

  const pending = pendingPreloadPeaks.get(assetId)
  if (pending) return pending

  const promise = (async () => {
    try {
      const peaks = await getAudioPeaks(assetId, 2400)
      if (peaks && peaks.length > 0) {
        syncPeakCache.set(assetId, peaks)
      }
      return peaks || new Float32Array(0)
    } finally {
      pendingPreloadPeaks.delete(assetId)
    }
  })()

  pendingPreloadPeaks.set(assetId, promise)
  return promise
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

/** Cache kết quả nhận diện layer miệng để tránh chạy regex 60fps */
const mouthCache = new Map<string, boolean>()

/** Kiểm tra xem một layer có phải là layer miệng hay không */
export function isMouthLayer(layer: Layer): boolean {
  if (!layer || !layer.name) return false
  const cacheKey = `${layer.id}_${layer.name}`
  const cached = mouthCache.get(cacheKey)
  if (cached !== undefined) return cached

  const raw = `${layer.name} ${layer.id || ''}`
  let res = MOUTH_REGEX.test(raw)
  if (!res) {
    const norm = normalizeVietnamese(raw)
    res = MOUTH_REGEX.test(norm)
  }
  mouthCache.set(cacheKey, res)
  return res
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
 * Tối ưu hóa tối đa: thoát ngay 0ms cho các layer không phải là miệng.
 */
export function evaluateCharacterLipSync(
  project: Project,
  layer: Layer,
  t: number
): EvaluatedLipSync {
  const charId = layer.composite?.instanceId
  if (!charId && !layer.id) return INACTIVE_LIP_SYNC

  const tracks = project.audioTracks || (project.audio ? [project.audio as AudioTrackItem] : [])
  if (tracks.length === 0) return INACTIVE_LIP_SYNC

  // Tìm nhanh xem có audio track nào gắn cho nhân vật này hoặc layer này không
  const matchingTrack = tracks.find((tr) => {
    if (tr.muted) return false
    if (tr.targetType === 'character') return tr.targetId === charId
    if (tr.targetType === 'layer') return tr.targetId === layer.id
    return false
  })

  if (!matchingTrack) return INACTIVE_LIP_SYNC

  // Thoát ngay nếu không phải layer miệng (chỉ layer miệng mới tiếp tục)
  const isTargetedMouth =
    matchingTrack.lipSyncLayerId === layer.id ||
    (!matchingTrack.lipSyncLayerId && isMouthLayer(layer)) ||
    (matchingTrack.targetType === 'layer' && matchingTrack.targetId === layer.id)

  if (!isTargetedMouth) return INACTIVE_LIP_SYNC

  // Phải là giọng nói thoại hoặc được bật lip-sync rõ ràng
  const isVoiceOrLipSync = matchingTrack.lipSyncEnabled || matchingTrack.characterRole === 'voice' || !matchingTrack.characterRole
  if (!isVoiceOrLipSync) return INACTIVE_LIP_SYNC

  // Kiểm tra thời gian t có nằm trong track không
  const rate = matchingTrack.playbackRate || 1
  const meta = assetStore.get(matchingTrack.assetId)?.meta
  const dur = matchingTrack.duration ?? (meta?.duration ? meta.duration / rate : 60)
  if (t < matchingTrack.offset || t > matchingTrack.offset + dur) return INACTIVE_LIP_SYNC

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

function appendBakedLipSyncKeyframes(
  mouthLayer: Layer,
  track: AudioTrackItem,
  assetDur: number,
  fps: number,
  intensity: number,
  threshold: number,
  useWasm: boolean
): number {
  const rate = track.playbackRate || 1
  const trimIn = track.trimIn || 0
  const trackDur = track.duration ?? (assetDur > 0 ? (assetDur - trimIn) / rate : 5)
  const startTime = track.offset
  const endTime = track.offset + trackDur
  const baseScale = [...mouthLayer.transform.scale.value] as Vec3
  const basePos = [...mouthLayer.transform.position.value] as Vec3
  const prefix = `lipsync-${track.id}-`
  mouthLayer.transform.scale.keyframes = mouthLayer.transform.scale.keyframes.filter(
    (k) => !k.id.startsWith(prefix)
  )
  mouthLayer.transform.position.keyframes = mouthLayer.transform.position.keyframes.filter(
    (k) => !k.id.startsWith(prefix)
  )

  const step = 1 / fps
  let frameCount = 0
  for (let t = startTime; t <= endTime; t += step) frameCount++

  const peaks = useWasm ? syncPeakCache.get(track.assetId) : undefined
  const wasmEval =
    useWasm && peaks && peaks.length > 0 && frameCount > 0
      ? wasmEvalLipSyncFrames(
          peaks,
          new Float64Array([
            startTime,
            track.offset,
            rate,
            trimIn,
            assetDur,
            assetDur > 0 ? assetDur : 10,
            trackDur,
            Math.min(1.5, track.volume),
            threshold,
            intensity,
            fps,
            baseScale[0],
            baseScale[1],
            baseScale[2],
            basePos[0],
            basePos[1],
            basePos[2]
          ]),
          frameCount
        )
      : null

  let keyCount = 0
  let i = 0
  for (let t = startTime; t <= endTime; t += step, i++) {
    const scaleVal: Vec3 = wasmEval
      ? [wasmEval.scales[i * 3], wasmEval.scales[i * 3 + 1], wasmEval.scales[i * 3 + 2]]
      : (() => {
          const amp = sampleAudioPeakAtTime(track, t, assetDur)
          const eff = amp < threshold ? 0 : amp
          return [
            baseScale[0] * (1.0 + eff * 0.18 * intensity),
            baseScale[1] * (1.0 + eff * 0.7 * intensity),
            baseScale[2]
          ]
        })()
    const posVal: Vec3 = wasmEval
      ? [wasmEval.positions[i * 3], wasmEval.positions[i * 3 + 1], wasmEval.positions[i * 3 + 2]]
      : (() => {
          const amp = sampleAudioPeakAtTime(track, t, assetDur)
          const eff = amp < threshold ? 0 : amp
          return [basePos[0], basePos[1] - eff * 8.0 * intensity, basePos[2]]
        })()

    const frameIdx = Math.round((t - startTime) * fps)
    const roundedT = Math.round(t * 1000) / 1000
    mouthLayer.transform.scale.keyframes.push({
      id: `${prefix}s-${frameIdx}`,
      t: roundedT,
      value: scaleVal,
      ease: 'easeOut'
    })
    mouthLayer.transform.position.keyframes.push({
      id: `${prefix}p-${frameIdx}`,
      t: roundedT,
      value: posVal,
      ease: 'easeOut'
    })
    keyCount += 2
  }

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

  mouthLayer.transform.scale.keyframes.sort((a, b) => a.t - b.t)
  mouthLayer.transform.position.keyframes.sort((a, b) => a.t - b.t)
  return keyCount
}

function runBakeLipSync(
  project: Project,
  trackId: string,
  options: { fps?: number; intensity?: number; openThreshold?: number } | undefined,
  useWasm: boolean
): { success: boolean; layerId?: string; bakedKeyframeCount: number } {
  const tracks = project.audioTracks || []
  const track = tracks.find((t) => t.id === trackId)
  if (!track) return { success: false, bakedKeyframeCount: 0 }

  const charId = track.targetId
  if (!charId && track.targetType !== 'layer') {
    return { success: false, bakedKeyframeCount: 0 }
  }

  const mouthLayer =
    track.targetType === 'layer'
      ? project.layers.find((l) => l.id === track.targetId)
      : findMouthLayerForCharacter(project.layers, charId!, track.lipSyncLayerId)

  if (!mouthLayer) return { success: false, bakedKeyframeCount: 0 }

  const meta = assetStore.get(track.assetId)?.meta
  const assetDur = meta?.duration ?? 0
  const fps = options?.fps || project.comp.fps || 30
  const intensity = options?.intensity || track.lipSyncIntensity || 1.0
  const threshold = options?.openThreshold ?? 0.04

  const bakedKeyframeCount = appendBakedLipSyncKeyframes(
    mouthLayer,
    track,
    assetDur,
    fps,
    intensity,
    threshold,
    useWasm
  )
  return { success: true, layerId: mouthLayer.id, bakedKeyframeCount }
}

/**
 * Nướng keyframe khẩu hình miệng trực tiếp vào Timeline của layer miệng nhân vật (đồng bộ, JS thuần).
 */
export function bakeLipSyncToCharacterLayerSyncJs(
  project: Project,
  trackId: string,
  options?: {
    fps?: number
    intensity?: number
    openThreshold?: number
  }
): { success: boolean; layerId?: string; bakedKeyframeCount: number } {
  return runBakeLipSync(project, trackId, options, false)
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
  return runBakeLipSync(project, trackId, options, true)
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

