import { nanoid } from 'nanoid'
import type { AudioTrackItem, Project } from '@shared/types'
import { assetStore } from './assets'

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
  offset: number = 0
): AudioTrackItem {
  const existingTracks = getProjectAudioTracks(project)
  const safeOffset = typeof offset === 'number' && !isNaN(offset) ? Math.max(0, Math.round(offset * 100) / 100) : 0
  const item: AudioTrackItem = {
    id: `audio-${nanoid(6)}`,
    assetId,
    name: name || assetStore.get(assetId)?.meta.name || 'Audio',
    offset: safeOffset,
    volume: 1
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

/**
 * Mixes multiple audio tracks into a single WAV audio buffer using Web Audio OfflineAudioContext.
 * Returns Uint8Array of the WAV file, ready for FFmpeg muxing during export.
 */
export async function mixAudioTracksToWav(
  tracks: AudioTrackItem[],
  totalDuration: number,
  start = 0
): Promise<Uint8Array | null> {
  if (tracks.length === 0 || totalDuration <= 0) return null

  try {
    const sampleRate = 44100
    const frameCount = Math.max(1, Math.ceil(totalDuration * sampleRate))
    const actx = new OfflineAudioContext(2, frameCount, sampleRate)
    const baseAudioCtx = new AudioContext({ sampleRate })

    let renderedCount = 0

    for (const track of tracks) {
      if (track.muted) continue
      const data = await assetStore.getBytes(track.assetId)
      if (!data || data.byteLength === 0) continue

      try {
        const audioBuffer = await baseAudioCtx.decodeAudioData(data.buffer.slice(0))
        const source = actx.createBufferSource()
        source.buffer = audioBuffer
        const rate = track.playbackRate || 1
        source.playbackRate.value = rate

        const gainNode = actx.createGain()
        gainNode.gain.value = Math.max(0, Math.min(2, track.volume))

        let lastNode: AudioNode = source

        // Apply EQ filter if specified
        if (track.tone && track.tone !== 'normal') {
          const filter = actx.createBiquadFilter()
          if (track.tone === 'bass') {
            filter.type = 'lowshelf'
            filter.frequency.value = 150
            filter.gain.value = 6
          } else if (track.tone === 'treble') {
            filter.type = 'highshelf'
            filter.frequency.value = 3500
            filter.gain.value = 6
          } else if (track.tone === 'vocal') {
            filter.type = 'peaking'
            filter.frequency.value = 1500
            filter.Q.value = 1
            filter.gain.value = 4
          } else if (track.tone === 'warm') {
            filter.type = 'lowpass'
            filter.frequency.value = 4500
          }
          lastNode.connect(filter)
          lastNode = filter
        }

        lastNode.connect(gainNode)
        gainNode.connect(actx.destination)

        const trackStart = track.offset - start
        const trimIn = Math.max(0, track.trimIn || 0)
        const dur = track.duration

        if (trackStart >= 0) {
          if (dur) source.start(trackStart, trimIn, dur)
          else source.start(trackStart, trimIn)
        } else {
          // Negative offset means skipping the beginning of the audio
          const skip = -trackStart
          const actualTrim = trimIn + skip
          if (dur) source.start(0, actualTrim, Math.max(0, dur - skip))
          else source.start(0, actualTrim)
        }
        renderedCount++
      } catch (err) {
        console.warn(`[mixAudioTracks] Failed to decode audio for track ${track.id}:`, err)
      }
    }

    baseAudioCtx.close().catch(() => undefined)

    if (renderedCount === 0) return null

    const rendered = await actx.startRendering()
    return encodeAudioBufferToWav(rendered)
  } catch (err) {
    console.error('[mixAudioTracksToWav] Mixing failed:', err)
    return null
  }
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = Math.min(2, buffer.numberOfChannels)
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = length * blockAlign
  const headerSize = 44
  const wavBytes = new Uint8Array(headerSize + dataSize)
  const view = new DataView(wavBytes.buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch))
  }

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return wavBytes
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
