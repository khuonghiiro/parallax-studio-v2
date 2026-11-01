import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE_SESSION_STORAGE_KEY,
  clearActiveWorkshopSession,
  loadActiveWorkshopSession,
  saveActiveWorkshopSession,
  updateActiveWorkshopDraft,
  type LayerAssemblyActiveSession
} from './layerAssemblySessionStorage'
import type { LayerComposite } from './types'

describe('layerAssemblySessionStorage', () => {
  const mockStorage: Record<string, string> = {}

  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      }
    })
  })

  const dummyComposite: LayerComposite = {
    id: 'comp-character-cutout-demo-20261011',
    name: 'Nhân Vật Anime 2.5D',
    category: 'character',
    description: 'Test',
    width: 750,
    height: 1050,
    layers: []
  }

  it('saves and loads active workshop session correctly', () => {
    expect(loadActiveWorkshopSession()).toBeNull()

    const session: LayerAssemblyActiveSession = {
      isOpen: true,
      compositeId: dummyComposite.id,
      draftComposite: dummyComposite,
      tab: 'bones',
      primaryMode: 'assembly',
      selectedBoneId: 'bone-pelvis',
      time: 1.2,
      timestamp: Date.now()
    }

    saveActiveWorkshopSession(session)
    const loaded = loadActiveWorkshopSession()
    expect(loaded).not.toBeNull()
    expect(loaded?.isOpen).toBe(true)
    expect(loaded?.compositeId).toBe(dummyComposite.id)
    expect(loaded?.tab).toBe('bones')
    expect(loaded?.selectedBoneId).toBe('bone-pelvis')

    clearActiveWorkshopSession()
    expect(loadActiveWorkshopSession()).toBeNull()
  })

  it('updates draft seamlessly and preserves tabs/modes', () => {
    updateActiveWorkshopDraft(dummyComposite, { tab: 'animation', selectedBoneId: 'bone-head' })

    const loaded = loadActiveWorkshopSession()
    expect(loaded?.isOpen).toBe(true)
    expect(loaded?.tab).toBe('animation')
    expect(loaded?.selectedBoneId).toBe('bone-head')

    const updatedComposite: LayerComposite = {
      ...dummyComposite,
      name: 'Nhân Vật Anime Đã Sửa Đổi'
    }
    updateActiveWorkshopDraft(updatedComposite)

    const reloaded = loadActiveWorkshopSession()
    expect(reloaded?.draftComposite.name).toBe('Nhân Vật Anime Đã Sửa Đổi')
    expect(reloaded?.tab).toBe('animation') // preserved
  })

  it('rejects corrupted or incomplete session data safely', () => {
    mockStorage[ACTIVE_SESSION_STORAGE_KEY] = 'not-valid-json'
    expect(loadActiveWorkshopSession()).toBeNull()

    mockStorage[ACTIVE_SESSION_STORAGE_KEY] = JSON.stringify({ isOpen: false })
    expect(loadActiveWorkshopSession()).toBeNull()

    mockStorage[ACTIVE_SESSION_STORAGE_KEY] = JSON.stringify({ isOpen: true, compositeId: 'abc', draftComposite: {} })
    expect(loadActiveWorkshopSession()).toBeNull()
  })
})
