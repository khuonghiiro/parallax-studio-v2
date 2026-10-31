import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '../project/factory'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { computeEffectiveLayout } from './remoteSession'
import {
  SHARED_LIBRARY_KEYS,
  applySyncEnvelopeToStores,
  isApplyingRemoteSync
} from './remoteStudioSync'

describe('remoteStudioSync & remoteSession — Full Studio Multi-Device Sync', () => {
  beforeEach(() => {
    const p = createProject({ name: 'Init Scene', duration: 12 })
    useEditor.getState().loadProject(p, null)
    useEditor.setState({ time: 0, playing: false, loop: true })
    useView.getState().set({ theme: 'dark' })
  })

  it('computes effective layout profile across auto and explicit device overrides', () => {
    expect(computeEffectiveLayout('auto', 'phone')).toBe('phone')
    expect(computeEffectiveLayout('auto', 'ipad')).toBe('tablet')
    expect(computeEffectiveLayout('auto', 'tablet')).toBe('tablet')
    expect(computeEffectiveLayout('auto', 'laptop')).toBe('desktop')
    expect(computeEffectiveLayout('auto', 'desktop')).toBe('desktop')

    expect(computeEffectiveLayout('phone', 'desktop')).toBe('phone')
    expect(computeEffectiveLayout('tablet', 'phone')).toBe('tablet')
    expect(computeEffectiveLayout('desktop', 'phone')).toBe('desktop')
  })

  it('applies initial bootstrap without polluting Undo history, then coalesces live remote edits into Undo steps', () => {
    const bootProj = createProject({ name: 'Host Live Project', duration: 15 })
    const shotId = bootProj.shots[0]?.id ?? null

    applySyncEnvelopeToStores(
      {
        rev: 1,
        clientId: 'host',
        project: bootProj,
        filePath: 'D:/Projects/demo.pxs',
        dirty: false,
        time: 2.4,
        playing: false,
        selectedShotId: shotId,
        theme: 'light'
      },
      { initialBootstrap: true }
    )

    expect(useEditor.getState().project.comp.name).toBe('Host Live Project')
    expect(useEditor.getState().filePath).toBe('D:/Projects/demo.pxs')
    expect(useEditor.getState().dirty).toBe(false)
    expect(useEditor.getState().past.length).toBe(0)
    expect(useEditor.getState().time).toBeCloseTo(2.4, 3)
    expect(useView.getState().theme).toBe('light')
    expect(isApplyingRemoteSync()).toBe(false)

    // Subsequent rapid edits from a phone client coalesce cleanly into 1 Undo step
    const edit1 = structuredClone(bootProj)
    edit1.comp.name = 'Edited From iPhone #1'
    applySyncEnvelopeToStores({
      rev: 2,
      clientId: 'iphone-client',
      project: edit1,
      dirty: true,
      time: 3.1
    })

    const edit2 = structuredClone(edit1)
    edit2.comp.name = 'Edited From iPhone #2'
    applySyncEnvelopeToStores({
      rev: 3,
      clientId: 'iphone-client',
      project: edit2,
      dirty: true,
      time: 3.2
    })

    expect(useEditor.getState().project.comp.name).toBe('Edited From iPhone #2')
    expect(useEditor.getState().past.length).toBe(1)
    expect(useEditor.getState().dirty).toBe(true)

    // Host or remote user pressing Undo (Ctrl+Z) restores the pre-edit state cleanly!
    useEditor.getState().undo()
    expect(useEditor.getState().project.comp.name).toBe('Host Live Project')
  })

  it('tracks all 8 shared library storage keys for Layer Composites, 3D Models, and Custom Assets', () => {
    expect(SHARED_LIBRARY_KEYS).toContain('pxs.layerComposites')
    expect(SHARED_LIBRARY_KEYS).toContain('parallax_models_3d_v2')
    expect(SHARED_LIBRARY_KEYS).toContain('pxs.customPublicAssets')
    expect(SHARED_LIBRARY_KEYS.length).toBe(8)
  })
})
