import type { AudioTrackItem, Project } from '@shared/types'
import {
  addAudioTrackToProject,
  duplicateAudioTrackInProject,
  getProjectAudioTracks,
  mergeAudioTracksInProject,
  removeAudioTrackFromProject,
  splitAudioTrackInProject,
  syncProjectAudio
} from '../../project/audioTracks'
import { assetStore } from '../../project/assets'
import { ParamError, ed, proj, type Handler } from '../types'
import { bool, has, num, str } from '../params'

function summarizeTrack(t: AudioTrackItem) {
  const asset = assetStore.get(t.assetId)
  return {
    id: t.id,
    name: t.name,
    assetId: t.assetId,
    offset: t.offset,
    volume: t.volume,
    duration: t.duration ?? asset?.meta.duration,
    muted: !!t.muted,
    loop: !!t.loop,
    playbackRate: t.playbackRate ?? 1,
    trimIn: t.trimIn ?? 0,
    fadeIn: t.fadeIn ?? 0,
    fadeOut: t.fadeOut ?? 0,
    tone: t.tone,
    gainDb: t.gainDb ?? 0
  }
}

export const audioCommands: Record<string, Handler> = {
  get_audio_info: () => {
    const tracks = getProjectAudioTracks(proj())
    return {
      tracks: tracks.map(summarizeTrack),
      totalTracks: tracks.length,
      primaryAudio: proj().audio
    }
  },

  add_audio_track: async (p, cmd) => {
    let assetId = str(p, 'asset_id')
    let defaultName = str(p, 'name')

    if (cmd.file) {
      if (!cmd.file.mime.startsWith('audio/')) {
        throw new ParamError(`Tập tin không phải là âm thanh hợp lệ: ${cmd.file.name}`)
      }
      const asset = await assetStore.add(cmd.file.name, cmd.file.mime, cmd.file.data, 'audio')
      assetId = asset.meta.id
      if (!defaultName) defaultName = asset.meta.name
      ed().update((d) => {
        if (!d.assets.some((a) => a.id === asset.meta.id)) {
          d.assets.push(asset.meta)
        }
      })
    }

    if (!assetId) {
      throw new ParamError('Cần cung cấp "file_path" để nạp file âm thanh hoặc "asset_id" của tài nguyên có sẵn')
    }

    const offset = has(p, 'offset') ? num(p, 'offset')! : ed().time
    let createdId = ''

    ed().update((d) => {
      const created = addAudioTrackToProject(d as Project, assetId!, defaultName, offset)
      createdId = created.id
      if (has(p, 'volume')) created.volume = Math.max(0, Math.min(1, num(p, 'volume')!))
      if (has(p, 'muted')) created.muted = bool(p, 'muted')!
      if (has(p, 'loop')) created.loop = bool(p, 'loop')!
      if (has(p, 'playback_rate')) created.playbackRate = Math.max(0.25, Math.min(4, num(p, 'playback_rate')!))
      if (has(p, 'fade_in')) created.fadeIn = Math.max(0, num(p, 'fade_in')!)
      if (has(p, 'fade_out')) created.fadeOut = Math.max(0, num(p, 'fade_out')!)
      if (has(p, 'trim_in')) created.trimIn = Math.max(0, num(p, 'trim_in')!)
      if (has(p, 'duration')) created.duration = Math.max(0.1, num(p, 'duration')!)
      syncProjectAudio(d as Project)
    })

    const found = getProjectAudioTracks(proj()).find((t) => t.id === createdId)
    return found ? summarizeTrack(found) : null
  },

  update_audio_track: (p) => {
    const trackId = str(p, 'track_id', true)
    let targetId = ''

    ed().update((d) => {
      const tracks = getProjectAudioTracks(d as Project)
      const target = trackId === 'main' ? tracks[0] : tracks.find((t) => t.id === trackId)
      if (!target) throw new ParamError(`Không tìm thấy track âm thanh với ID: ${trackId}`)
      targetId = target.id

      if (has(p, 'name')) target.name = str(p, 'name')!
      if (has(p, 'offset')) target.offset = Math.max(0, num(p, 'offset')!)
      if (has(p, 'volume')) target.volume = Math.max(0, Math.min(1, num(p, 'volume')!))
      if (has(p, 'muted')) target.muted = bool(p, 'muted')!
      if (has(p, 'loop')) target.loop = bool(p, 'loop')!
      if (has(p, 'playback_rate')) target.playbackRate = Math.max(0.25, Math.min(4, num(p, 'playback_rate')!))
      if (has(p, 'fade_in')) target.fadeIn = Math.max(0, num(p, 'fade_in')!)
      if (has(p, 'fade_out')) target.fadeOut = Math.max(0, num(p, 'fade_out')!)
      if (has(p, 'trim_in')) target.trimIn = Math.max(0, num(p, 'trim_in')!)
      if (has(p, 'duration')) target.duration = Math.max(0.1, num(p, 'duration')!)
      if (has(p, 'gain_db')) target.gainDb = Math.max(-24, Math.min(12, num(p, 'gain_db')!))
      if (has(p, 'tone')) target.tone = str(p, 'tone') as AudioTrackItem['tone']

      syncProjectAudio(d as Project)
    })

    const found = getProjectAudioTracks(proj()).find((t) => t.id === targetId)
    return found ? summarizeTrack(found) : null
  },

  delete_audio_track: (p) => {
    const trackId = str(p, 'track_id', true)
    ed().update((d) => {
      const tracks = getProjectAudioTracks(d as Project)
      const target = trackId === 'main' ? tracks[0] : tracks.find((t) => t.id === trackId)
      if (!target) throw new ParamError(`Không tìm thấy track âm thanh với ID: ${trackId}`)
      removeAudioTrackFromProject(d as Project, target.id)
    })
    return { deleted: trackId, remainingTracks: getProjectAudioTracks(proj()).length }
  },

  duplicate_audio_track: (p) => {
    const trackId = str(p, 'track_id', true)
    const delta = has(p, 'offset_delta') ? num(p, 'offset_delta')! : 0.5
    let dupId = ''

    ed().update((d) => {
      const tracks = getProjectAudioTracks(d as Project)
      const target = trackId === 'main' ? tracks[0] : tracks.find((t) => t.id === trackId)
      if (!target) throw new ParamError(`Không tìm thấy track âm thanh: ${trackId}`)
      const dup = duplicateAudioTrackInProject(d as Project, target.id, delta)
      if (dup) dupId = dup.id
    })

    const found = getProjectAudioTracks(proj()).find((t) => t.id === dupId)
    return found ? summarizeTrack(found) : null
  },

  split_audio_track: (p) => {
    const trackId = str(p, 'track_id', true)
    const splitTime = has(p, 'split_time') ? num(p, 'split_time')! : ed().time
    let part1Id = ''
    let part2Id = ''

    ed().update((d) => {
      const tracks = getProjectAudioTracks(d as Project)
      const target = trackId === 'main' ? tracks[0] : tracks.find((t) => t.id === trackId)
      if (!target) throw new ParamError(`Không tìm thấy track âm thanh: ${trackId}`)
      const res = splitAudioTrackInProject(d as Project, target.id, splitTime)
      if (!res) {
        throw new ParamError(
          `Không thể cắt track: thời điểm cắt (${splitTime}s) phải nằm giữa khoảng phát của track (offset: ${target.offset}s)`
        )
      }
      part1Id = res.part1.id
      part2Id = res.part2.id
    })

    const all = getProjectAudioTracks(proj())
    const p1 = all.find((t) => t.id === part1Id)
    const p2 = all.find((t) => t.id === part2Id)
    return p1 && p2 ? { part1: summarizeTrack(p1), part2: summarizeTrack(p2) } : null
  },

  merge_audio_tracks: async (p) => {
    const trackIds = Array.isArray(p.track_ids)
      ? (p.track_ids as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined

    const merged = await mergeAudioTracksInProject(proj(), trackIds)
    if (!merged) {
      throw new ParamError('Cần ít nhất 2 tracks âm thanh hợp lệ để gộp âm thanh')
    }

    ed().update((d) => {
      syncProjectAudio(d as Project)
    })

    const found = getProjectAudioTracks(proj()).find((t) => t.id === merged.id)
    return found ? summarizeTrack(found) : summarizeTrack(merged)
  }
}
