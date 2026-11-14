import { nanoid } from 'nanoid'
import type { AudioCharacterRole, AudioTargetType, AudioTrackItem, Project } from '@shared/types'
import { assetStore } from './assets'
import { mixAudioTracksToWav } from './audioMixdown'
import { isMouthLayer } from './lipSync'

export { mixAudioTracksToWav }

/**
 * Normalizes and returns all audio tracks in the project.
 * Falls back to project.audio if audioTracks is empty/undefined.
 */
export function getProjectAudioTracks(project: Project): AudioTrackItem[] {
  if (project.audioTracks && project.audioTracks.length > 0) {
    return project.audioTracks
  }
  if (project.audio) {
    return [
      {
        id: project.audio.id || 'main',
        assetId: project.audio.assetId,
        name: project.audio.name,
        offset: project.audio.offset,
        volume: project.audio.volume
      }
    ]
  }
  return []
}

/**
 * Synchronizes project.audio with the first active audioTrack
 * for 100% backward compatibility with single-track code/MCP/tests.
 */
export function syncProjectAudio(project: Project): void {
  const tracks = project.audioTracks
  if (tracks && tracks.length > 0) {
    project.audio = {
      id: tracks[0].id,
      name: tracks[0].name,
      assetId: tracks[0].assetId,
      offset: tracks[0].offset,
      volume: tracks[0].volume
    }
  } else {
    project.audio = null
  }
}

/**
 * Adds an audio track to the project at a specified offset (defaulting to 0).
 * Supports adding multiple audio tracks, including duplicate assets at different times.
 */
export function addAudioTrackToProject(
  project: Project,
  assetId: string,
  name?: string,
  offset: number = 0,
  binding?: Partial<AudioTrackItem>
): AudioTrackItem {
  const existingTracks = getProjectAudioTracks(project)
  const safeOffset = typeof offset === 'number' && !isNaN(offset) ? Math.max(0, Math.round(offset * 100) / 100) : 0
  const item: AudioTrackItem = {
    id: `audio-${nanoid(6)}`,
    assetId,
    name: name || assetStore.get(assetId)?.meta.name || 'Audio',
    offset: safeOffset,
    volume: 1,
    ...binding
  }
  project.audioTracks = [...existingTracks, item]
  syncProjectAudio(project)
  return item
}

/**
 * Duplicates an existing audio track in the project at an optional time delta.
 */
export function duplicateAudioTrackInProject(
  project: Project,
  trackId: string,
  offsetDelta: number = 0.5
): AudioTrackItem | null {
  const existingTracks = getProjectAudioTracks(project)
  const orig = existingTracks.find((t) => t.id === trackId)
  if (!orig) return null

  const safeDelta = typeof offsetDelta === 'number' && !isNaN(offsetDelta) ? offsetDelta : 0.5
  const newOffset = Math.max(0, Math.round((orig.offset + safeDelta) * 100) / 100)
  const item: AudioTrackItem = {
    id: `audio-${nanoid(6)}`,
    assetId: orig.assetId,
    name: orig.name,
    offset: newOffset,
    volume: orig.volume,
    playbackRate: orig.playbackRate,
    trimIn: orig.trimIn,
    duration: orig.duration,
    fadeIn: orig.fadeIn,
    fadeOut: orig.fadeOut,
    tone: orig.tone,
    muted: orig.muted
  }
  project.audioTracks = [...existingTracks, item]
  syncProjectAudio(project)
  return item
}

/**
 * Splits an audio track into two tracks at the specified splitTime.
 * Part 1 ends at splitTime, and Part 2 begins at splitTime.
 */
export function splitAudioTrackInProject(
  project: Project,
  trackId: string,
  splitTime: number
): { part1: AudioTrackItem; part2: AudioTrackItem } | null {
  const existingTracks = getProjectAudioTracks(project)
  const target = existingTracks.find((t) => t.id === trackId)
  if (!target) return null

  const safeSplitTime = Math.max(0, Math.round(splitTime * 100) / 100)
  // Must split strictly inside the track
  if (safeSplitTime <= target.offset) return null

  const rate = target.playbackRate || 1
  const part1Duration = Math.round((safeSplitTime - target.offset) * 100) / 100
  if (part1Duration < 0.05) return null

  // If track already had an explicit duration, ensure part 1 doesn't exceed it
  if (target.duration && part1Duration >= target.duration) return null

  const origTrimIn = target.trimIn || 0
  const origDuration = target.duration

  // Part 1: updated in place
  target.duration = part1Duration
  if (!target.name?.includes('(Phần 1)')) {
    target.name = `${target.name || 'Audio'} (Phần 1)`
  }

  // Part 2: new track starting at splitTime
  const part2TrimIn = Math.round((origTrimIn + part1Duration * rate) * 100) / 100
  const part2Duration = origDuration
    ? Math.max(0.05, Math.round((origDuration - part1Duration) * 100) / 100)
    : undefined

  const baseName = target.name.replace(/\s*\(Phần 1\)$/, '')
  const part2: AudioTrackItem = {
    id: `audio-${nanoid(6)}`,
    assetId: target.assetId,
    name: `${baseName} (Phần 2)`,
    offset: safeSplitTime,
    volume: target.volume,
    playbackRate: target.playbackRate,
    trimIn: part2TrimIn,
    duration: part2Duration,
    fadeIn: target.fadeIn,
    fadeOut: target.fadeOut,
    tone: target.tone,
    muted: target.muted
  }

  project.audioTracks = [...existingTracks, part2]
  syncProjectAudio(project)
  return { part1: target, part2 }
}

/**
 * Merges multiple audio tracks (or all tracks in the project) into a single unified WAV audio track.
 * Uses Web Audio OfflineAudioContext mixdown to produce an actual master audio asset.
 */
export async function mergeAudioTracksInProject(
  project: Project,
  trackIds?: string[]
): Promise<AudioTrackItem | null> {
  const existingTracks = getProjectAudioTracks(project)
  const tracksToMerge =
    trackIds && trackIds.length > 0
      ? existingTracks.filter((t) => trackIds.includes(t.id))
      : existingTracks

  if (tracksToMerge.length < 2) return null

  const minOffset = Math.min(...tracksToMerge.map((t) => t.offset))
  // Calculate max reach of all tracks
  const maxEnd = Math.max(
    ...tracksToMerge.map((t) => {
      const dur = t.duration || 60
      return t.offset + dur
    })
  )
  const totalDuration = Math.max(1, maxEnd - minOffset)

  const wavBytes = await mixAudioTracksToWav(tracksToMerge, totalDuration, minOffset)
  if (!wavBytes) return null

  const assetName = `Gộp âm thanh (${tracksToMerge.length} luồng).wav`
  const asset = await assetStore.add(assetName, 'audio/wav', wavBytes, 'audio')

  // Remove the merged tracks
  const mergedIds = new Set(tracksToMerge.map((t) => t.id))
  const remaining = existingTracks.filter((t) => !mergedIds.has(t.id))

  const mergedItem: AudioTrackItem = {
    id: `audio-${nanoid(6)}`,
    assetId: asset.meta.id,
    name: assetName,
    offset: minOffset,
    volume: 1
  }

  project.audioTracks = [...remaining, mergedItem]
  if (!project.assets.some((a) => a.id === asset.meta.id)) {
    project.assets.push(asset.meta)
  }
  syncProjectAudio(project)
  return mergedItem
}

/**
 * Removes an audio track by ID and updates project.audio.
 */
export function removeAudioTrackFromProject(project: Project, trackId: string): void {
  const existingTracks = getProjectAudioTracks(project)
  project.audioTracks = existingTracks.filter((t) => t.id !== trackId)
  syncProjectAudio(project)
}

export interface AudioTargetOption {
  type: AudioTargetType
  id: string // instanceId hoặc layer.id
  name: string
  shotId?: string
  shotName?: string
  layerCount?: number
  mouthLayerId?: string
}

/**
 * Quét toàn bộ project (hoặc shot) để lấy danh sách các mục tiêu có thể gắn Audio:
 * - Nhân vật được tạo từ xưởng lắp ráp layer (Composite)
 * - Khối mô hình 3D (Model 3D)
 * - Layer đơn lẻ (Image, Text, Solid...)
 */
export function getAvailableAudioTargets(project: Project, shotId?: string): AudioTargetOption[] {
  const results: AudioTargetOption[] = []
  const shotMap = new Map(project.shots.map((s) => [s.id, s.name]))

  // 1. Gom các cụm nhân vật composite
  const compositeMap = new Map<string, { name: string; shotId?: string; layers: string[]; mouthId?: string }>()
  // 2. Gom các mô hình 3D
  const model3dMap = new Map<string, { name: string; shotId?: string; layers: string[] }>()
  // 3. Các layer độc lập
  const singleLayers: AudioTargetOption[] = []

  const relevantLayers = shotId ? project.layers.filter((l) => l.shotId === shotId) : project.layers

  for (const l of relevantLayers) {
    if (l.composite?.instanceId) {
      const inst = l.composite.instanceId
      let entry = compositeMap.get(inst)
      if (!entry) {
        const newEntry = { name: l.composite.compositeName, shotId: l.shotId || undefined, layers: [] }
        compositeMap.set(inst, newEntry)
        entry = newEntry
      }
      entry.layers.push(l.id)
      if (isMouthLayer(l) && !entry.mouthId) {
        entry.mouthId = l.id
      }
    } else if (l.model3d?.instanceId) {
      const inst = l.model3d.instanceId
      let entry = model3dMap.get(inst)
      if (!entry) {
        const newEntry = { name: l.model3d.modelName, shotId: l.shotId || undefined, layers: [] }
        model3dMap.set(inst, newEntry)
        entry = newEntry
      }
      entry.layers.push(l.id)
    } else {
      singleLayers.push({
        type: 'layer',
        id: l.id,
        name: l.name,
        shotId: l.shotId || undefined,
        shotName: l.shotId ? shotMap.get(l.shotId) : undefined
      })
    }
  }

  // Thêm các nhân vật composite
  for (const [id, comp] of compositeMap.entries()) {
    results.push({
      type: 'character',
      id,
      name: comp.name,
      shotId: comp.shotId,
      shotName: comp.shotId ? shotMap.get(comp.shotId) : undefined,
      layerCount: comp.layers.length,
      mouthLayerId: comp.mouthId
    })
  }

  // Thêm các mô hình 3D
  for (const [id, mod] of model3dMap.entries()) {
    results.push({
      type: 'model3d',
      id,
      name: mod.name,
      shotId: mod.shotId,
      shotName: mod.shotId ? shotMap.get(mod.shotId) : undefined,
      layerCount: mod.layers.length
    })
  }

  // Thêm các layer đơn lẻ
  results.push(...singleLayers)
  return results
}

/**
 * Gắn hoặc cập nhật liên kết mục tiêu cho track âm thanh.
 */
export function attachAudioTrackToTarget(
  project: Project,
  trackId: string,
  binding: {
    targetType?: AudioTargetType
    targetId?: string
    targetName?: string
    targetShotId?: string
    characterRole?: AudioCharacterRole
    lipSyncEnabled?: boolean
    lipSyncLayerId?: string
    lipSyncIntensity?: number
  }
): AudioTrackItem | null {
  const tracks = getProjectAudioTracks(project)
  const target = trackId === 'main' ? tracks[0] : tracks.find((t) => t.id === trackId)
  if (!target) return null

  if (binding.targetType !== undefined) target.targetType = binding.targetType
  if (binding.targetId !== undefined) target.targetId = binding.targetId
  if (binding.targetName !== undefined) target.targetName = binding.targetName
  if (binding.targetShotId !== undefined) target.targetShotId = binding.targetShotId
  if (binding.characterRole !== undefined) target.characterRole = binding.characterRole
  if (binding.lipSyncEnabled !== undefined) target.lipSyncEnabled = binding.lipSyncEnabled
  if (binding.lipSyncLayerId !== undefined) target.lipSyncLayerId = binding.lipSyncLayerId
  if (binding.lipSyncIntensity !== undefined) target.lipSyncIntensity = binding.lipSyncIntensity

  // Tự động tìm mouth layer nếu là nhân vật và chưa có mouthLayerId
  if (target.targetType === 'character' && target.targetId && !target.lipSyncLayerId) {
    const targets = getAvailableAudioTargets(project)
    const charTarget = targets.find((t) => t.id === target.targetId)
    if (charTarget?.mouthLayerId) {
      target.lipSyncLayerId = charTarget.mouthLayerId
    }
  }

  syncProjectAudio(project)
  return target
}

/**
 * Thay thế tệp âm thanh (asset) mới cho track đã có, bảo lưu nguyên vẹn target binding và timeline offset.
 */
export function replaceAudioTrackAsset(
  project: Project,
  trackId: string,
  newAssetId: string,
  newName?: string
): AudioTrackItem | null {
  const tracks = getProjectAudioTracks(project)
  const target = trackId === 'main' ? tracks[0] : tracks.find((t) => t.id === trackId)
  if (!target) return null

  target.assetId = newAssetId
  if (newName) {
    target.name = newName
  } else {
    const meta = assetStore.get(newAssetId)?.meta
    if (meta?.name) target.name = meta.name
  }

  syncProjectAudio(project)
  return target
}

/**
 * Thay thế âm thanh nhanh cho một nhân vật cụ thể trong cảnh.
 */
export function replaceCharacterAudio(
  project: Project,
  characterInstanceId: string,
  newAssetId: string,
  role?: AudioCharacterRole,
  newName?: string
): AudioTrackItem | null {
  const tracks = getProjectAudioTracks(project)
  const charTrack = tracks.find((t) => {
    if (t.targetType !== 'character' || t.targetId !== characterInstanceId) return false
    if (role && t.characterRole && t.characterRole !== role) return false
    return true
  })

  if (!charTrack) return null
  return replaceAudioTrackAsset(project, charTrack.id, newAssetId, newName)
}
