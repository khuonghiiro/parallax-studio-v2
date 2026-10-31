import { describe, expect, it } from 'vitest'
import type { Project } from '@shared/types'
import { createProject, createShot, createSolidLayer } from './factory'
import { resolveActivePlaybackRange } from './playbackRange'

function makeMockProject(duration = 15): Project {
  const project = createProject({ duration, width: 1920, height: 1080 })
  const shot1 = createShot('Cánh Đồng', [0, 0, 0], 0)
  const shot2 = createShot('Phòng Khách', [1000, 0, 0], 1)
  project.shots = [shot1, shot2]

  const l1 = createSolidLayer(project.comp)
  l1.shotId = shot1.id
  l1.name = 'Layer 1'
  l1.inPoint = 0
  l1.outPoint = 5

  const l2 = createSolidLayer(project.comp)
  l2.shotId = shot2.id
  l2.name = 'Layer 2'
  l2.inPoint = 5
  l2.outPoint = 12

  project.layers = [l1, l2]
  return project
}

describe('resolveActivePlaybackRange', () => {
  it('returns whole composition range when isolateShotPlayback is false', () => {
    const project = makeMockProject(15)
    const shotId = project.shots[0].id
    const range = resolveActivePlaybackRange(project, false, shotId, null)
    expect(range).toEqual({
      start: 0,
      end: 15,
      duration: 15,
      source: 'comp'
    })
  })

  it('isolates playback to the selected shot when isolateShotPlayback is true', () => {
    const project = makeMockProject(15)
    const shot1 = project.shots[0]
    const range = resolveActivePlaybackRange(project, true, shot1.id, null)
    expect(range.source).toBe('shot')
    expect(range.shotId).toBe(shot1.id)
    expect(range.shotName).toBe('Cánh Đồng')
    expect(range.start).toBeGreaterThanOrEqual(0)
    expect(range.end).toBeGreaterThan(range.start)
  })

  it('uses customPlaybackRange when in Toàn cảnh (focusedShotId is null)', () => {
    const project = makeMockProject(15)
    const range = resolveActivePlaybackRange(project, true, null, { start: 2.5, end: 7.2 })
    expect(range).toEqual({
      start: 2.5,
      end: 7.2,
      duration: 4.7,
      source: 'custom'
    })
  })

  it('clamps customPlaybackRange cleanly within composition bounds', () => {
    const project = makeMockProject(15)
    const range = resolveActivePlaybackRange(project, true, null, { start: -5, end: 999 })
    expect(range.start).toBe(0)
    expect(range.end).toBe(15)
    expect(range.duration).toBe(15)
    expect(range.source).toBe('custom')
  })

  it('handles custom range where end is before start by enforcing minimum positive delta', () => {
    const project = makeMockProject(15)
    const range = resolveActivePlaybackRange(project, true, null, { start: 8, end: 4 })
    expect(range.start).toBe(8)
    expect(range.end).toBe(8.1)
    expect(range.duration).toBe(0.1)
  })
})
