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
})
