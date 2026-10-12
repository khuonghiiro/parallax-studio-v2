import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'

describe('MCP audioCommands', () => {
  beforeEach(() => {
    const proj = createProject()
    // Add dummy audio asset
    proj.assets.push({
      id: 'asset-sound-1',
      name: 'soundtrack.mp3',
      kind: 'audio',
      mime: 'audio/mp3'
    })
    useEditor.getState().loadProject(proj, null)
  })

  it('runs get_audio_info and returns empty tracks initially', async () => {
    const res = (await runCommand('get_audio_info')) as any
    expect(res.tracks).toEqual([])
    expect(res.totalTracks).toBe(0)
    expect(res.primaryAudio).toBeNull()
  })

  it('adds audio track via add_audio_track and synchronizes', async () => {
    const res = (await runCommand('add_audio_track', {
      asset_id: 'asset-sound-1',
      name: 'Intro Theme',
      offset: 1.5,
      volume: 0.8,
      loop: true
    })) as any

    expect(res.name).toBe('Intro Theme')
    expect(res.offset).toBe(1.5)
    expect(res.volume).toBe(0.8)
    expect(res.loop).toBe(true)

    const info = (await runCommand('get_audio_info')) as any
    expect(info.totalTracks).toBe(1)
    expect(info.tracks[0].id).toBe(res.id)
    expect(info.primaryAudio?.offset).toBe(1.5)
  })

  it('updates an audio track via update_audio_track', async () => {
    const added = (await runCommand('add_audio_track', {
      asset_id: 'asset-sound-1',
      offset: 0,
      volume: 1.0
    })) as any

    const updated = (await runCommand('update_audio_track', {
      track_id: added.id,
      volume: 0.4,
      offset: 2.0,
      muted: true
    })) as any

    expect(updated.volume).toBe(0.4)
    expect(updated.offset).toBe(2.0)
    expect(updated.muted).toBe(true)
  })

  it('duplicates an audio track via duplicate_audio_track', async () => {
    const added = (await runCommand('add_audio_track', {
      asset_id: 'asset-sound-1',
      offset: 1.0
    })) as any

    const dup = (await runCommand('duplicate_audio_track', {
      track_id: added.id,
      offset_delta: 2.5
    })) as any

    expect(dup.offset).toBe(3.5)
    const info = (await runCommand('get_audio_info')) as any
    expect(info.totalTracks).toBe(2)
  })

  it('splits an audio track via split_audio_track', async () => {
    const added = (await runCommand('add_audio_track', {
      asset_id: 'asset-sound-1',
      offset: 0
    })) as any

    const split = (await runCommand('split_audio_track', {
      track_id: added.id,
      split_time: 1.5
    })) as any

    expect(split.part1.duration).toBe(1.5)
    expect(split.part2.offset).toBe(1.5)
    const info = (await runCommand('get_audio_info')) as any
    expect(info.totalTracks).toBe(2)
  })

  it('deletes an audio track via delete_audio_track', async () => {
    const added = (await runCommand('add_audio_track', {
      asset_id: 'asset-sound-1',
      offset: 0
    })) as any

    const del = (await runCommand('delete_audio_track', {
      track_id: added.id
    })) as any

    expect(del.deleted).toBe(added.id)
    expect(del.remainingTracks).toBe(0)
  })

  it('lists audio targets and binds audio track to character with lip-sync', async () => {
    // Thêm một nhân vật composite gồm 2 layer (thân và miệng)
    useEditor.getState().update((p) => {
      p.layers.push({
        id: 'layer-body-1',
        name: '[Nam Hiệp Sĩ] Thân',
        type: 'image',
        visible: true,
        locked: false,
        inPoint: 0,
        outPoint: 10,
        blendMode: 'normal',
        props: { assetId: 'asset-img-1' },
        transform: {
          position: { value: [0, 0, 0], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
        },
        composite: {
          instanceId: 'comp-inst-hero-1',
          compositeId: 'comp-hero',
          compositeName: 'Nam Hiệp Sĩ',
          lockedGroup: true
        }
      } as any)
      p.layers.push({
        id: 'layer-mouth-1',
        name: '[Nam Hiệp Sĩ] Miệng',
        type: 'image',
        visible: true,
        locked: false,
        inPoint: 0,
        outPoint: 10,
        blendMode: 'normal',
        props: { assetId: 'asset-img-2' },
        transform: {
          position: { value: [0, -10, 0], keyframes: [] },
          rotation: { value: [0, 0, 0], keyframes: [] },
          scale: { value: [1, 1, 1], keyframes: [] },
          opacity: { value: 1, keyframes: [] }
        },
        composite: {
          instanceId: 'comp-inst-hero-1',
          compositeId: 'comp-hero',
          compositeName: 'Nam Hiệp Sĩ',
          lockedGroup: true
        }
      } as any)
    })

    // 1. Kiểm tra get_audio_targets
    const targetsRes = (await runCommand('get_audio_targets')) as any
    expect(targetsRes.totalTargets).toBeGreaterThanOrEqual(1)
    const heroTarget = targetsRes.targets.find((t: any) => t.id === 'comp-inst-hero-1')
    expect(heroTarget).toBeDefined()
    expect(heroTarget.name).toBe('Nam Hiệp Sĩ')
    expect(heroTarget.mouthLayerId).toBe('layer-mouth-1')

    // 2. Thêm track thoại và gắn vào nhân vật
    const track = (await runCommand('add_audio_track', {
      asset_id: 'asset-sound-1',
      name: 'Giọng nói anh hùng',
      target_type: 'character',
      target_id: 'comp-inst-hero-1',
      target_name: 'Nam Hiệp Sĩ',
      character_role: 'voice',
      lip_sync: true,
      lip_sync_intensity: 1.2
    })) as any

    expect(track.targetType).toBe('character')
    expect(track.targetId).toBe('comp-inst-hero-1')
    expect(track.characterRole).toBe('voice')
    expect(track.lipSyncEnabled).toBe(true)
    expect(track.lipSyncIntensity).toBe(1.2)

    // 3. Cập nhật gắn lại qua attach_audio_to_target
    const attached = (await runCommand('attach_audio_to_target', {
      track_id: track.id,
      target_type: 'character',
      target_id: 'comp-inst-hero-1',
      character_role: 'voice',
      lip_sync: true,
      lip_sync_intensity: 1.5
    })) as any

    expect(attached.lipSyncIntensity).toBe(1.5)
    expect(attached.lipSyncLayerId).toBe('layer-mouth-1')

    // 4. Thay thế audio cho nhân vật qua replace_character_audio
    // Thêm dummy asset mới
    useEditor.getState().update((p) => {
      p.assets.push({
        id: 'asset-sound-voice-2',
        name: 'voice_take2.mp3',
        kind: 'audio',
        mime: 'audio/mp3'
      })
    })

    const replaced = (await runCommand('replace_character_audio', {
      character_instance_id: 'comp-inst-hero-1',
      asset_id: 'asset-sound-voice-2',
      name: 'Thoại Take 2'
    })) as any

    expect(replaced.assetId).toBe('asset-sound-voice-2')
    expect(replaced.name).toBe('Thoại Take 2')
    expect(replaced.targetId).toBe('comp-inst-hero-1')

    // 5. Nướng keyframe khẩu hình qua bake_character_lipsync
    const bakeRes = (await runCommand('bake_character_lipsync', {
      track_id: track.id,
      intensity: 1.2,
      fps: 24
    })) as any

    expect(bakeRes.success).toBe(true)
    expect(bakeRes.layerId).toBe('layer-mouth-1')
    expect(bakeRes.bakedKeyframeCount).toBeGreaterThan(0)
  })
})

