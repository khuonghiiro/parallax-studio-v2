import { describe, expect, it } from 'vitest'
import type { Project } from '@shared/types'
import { createProject } from './factory'
import {
  addAudioTrackToProject,
  duplicateAudioTrackInProject,
  getProjectAudioTracks,
  removeAudioTrackFromProject,
  splitAudioTrackInProject,
  syncProjectAudio
} from './audioTracks'

describe('audioTracks - Multi-track, duplication, and playhead positioning', () => {
  it('adds audio track at current playhead time and syncs project.audio', () => {
    const project: Project = createProject()
    expect(getProjectAudioTracks(project)).toEqual([])
    expect(project.audio).toBeNull()

    // Add first audio track at 2.5s
    const t1 = addAudioTrackToProject(project, 'asset-audio-1', 'Background BGM', 2.5)
    expect(t1.offset).toBe(2.5)
    expect(t1.name).toBe('Background BGM')

    const tracks1 = getProjectAudioTracks(project)
    expect(tracks1).toHaveLength(1)
    expect(tracks1[0].id).toBe(t1.id)

    // project.audio should be kept in sync with the first track for backward compatibility
    expect(project.audio).toBeDefined()
    expect(project.audio?.assetId).toBe('asset-audio-1')
    expect(project.audio?.offset).toBe(2.5)
  })

  it('allows duplicating audio tracks (tạo trùng) with offset', () => {
    const project: Project = createProject()
    const t1 = addAudioTrackToProject(project, 'asset-audio-1', 'BGM Loop', 1.0)

    // Duplicate track t1 with 2.0s offset delta
    const t2 = duplicateAudioTrackInProject(project, t1.id, 2.0)
    expect(t2).not.toBeNull()
    expect(t2?.assetId).toBe('asset-audio-1')
    expect(t2?.name).toBe('BGM Loop')
    expect(t2?.offset).toBe(3.0)

    const tracks = getProjectAudioTracks(project)
    expect(tracks).toHaveLength(2)
    expect(tracks[0].id).toBe(t1.id)
    expect(tracks[1].id).toBe(t2?.id)
  })

  it('allows adding multiple distinct audio tracks at different playhead times', () => {
    const project: Project = createProject()
    const t1 = addAudioTrackToProject(project, 'sound-woosh', 'Woosh SFX', 0.5)
    const t2 = addAudioTrackToProject(project, 'sound-hit', 'Hit SFX', 1.8)
    const t3 = addAudioTrackToProject(project, 'sound-ambient', 'Ambient River', 4.0)

    const tracks = getProjectAudioTracks(project)
    expect(tracks).toHaveLength(3)
    expect(tracks[0].offset).toBe(0.5)
    expect(tracks[1].offset).toBe(1.8)
    expect(tracks[2].offset).toBe(4.0)
  })

  it('removes audio track by id and updates project.audio appropriately', () => {
    const project: Project = createProject()
    const t1 = addAudioTrackToProject(project, 'audio-1', 'First', 0)
    const t2 = addAudioTrackToProject(project, 'audio-2', 'Second', 3)

    expect(getProjectAudioTracks(project)).toHaveLength(2)
    expect(project.audio?.assetId).toBe('audio-1')

    // Remove first track
    removeAudioTrackFromProject(project, t1.id)
    const remaining = getProjectAudioTracks(project)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(t2.id)

    // project.audio should now point to second track
    expect(project.audio?.assetId).toBe('audio-2')

    // Remove remaining track
    removeAudioTrackFromProject(project, t2.id)
    expect(getProjectAudioTracks(project)).toHaveLength(0)
    expect(project.audio).toBeNull()
  })

  it('falls back to project.audio if project.audioTracks is not set', () => {
    const project: Project = createProject()
    delete (project as any).audioTracks
    project.audio = {
      id: 'legacy-main',
      assetId: 'legacy-asset',
      name: 'Legacy Audio',
      offset: 1.25,
      volume: 0.8
    }

    const tracks = getProjectAudioTracks(project)
    expect(tracks).toHaveLength(1)
    expect(tracks[0].id).toBe('legacy-main')
    expect(tracks[0].offset).toBe(1.25)
  })

  it('splits audio track into two parts at splitTime', () => {
    const project: Project = createProject()
    const t = addAudioTrackToProject(project, 'asset-audio-1', 'Theme Song', 1.0)
    t.duration = 8.0

    const splitRes = splitAudioTrackInProject(project, t.id, 4.0)
    expect(splitRes).not.toBeNull()
    expect(splitRes?.part1.duration).toBe(3.0)
    expect(splitRes?.part1.name).toContain('Phần 1')

    expect(splitRes?.part2.offset).toBe(4.0)
    expect(splitRes?.part2.trimIn).toBe(3.0)
    expect(splitRes?.part2.duration).toBe(5.0)
    expect(splitRes?.part2.name).toContain('Phần 2')

    const tracks = getProjectAudioTracks(project)
    expect(tracks).toHaveLength(2)
  })

  it('removes audio track and leaves project audio tracks empty', () => {
    const project: Project = createProject()
    const t = addAudioTrackToProject(project, 'asset-audio-1', 'Voiceover', 1.5)
    expect(getProjectAudioTracks(project)).toHaveLength(1)

    removeAudioTrackFromProject(project, t.id)
    expect(getProjectAudioTracks(project)).toHaveLength(0)
    expect(project.audio).toBeNull()
  })
})

