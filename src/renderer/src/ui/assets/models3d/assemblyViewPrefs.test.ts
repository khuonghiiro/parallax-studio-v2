import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEFAULT_VIEW_STATE,
  ASSEMBLY_VIEW_PREFS_KEY,
  loadAssemblyViewPrefs,
  saveAssemblyViewPrefs,
  computeNextGizmoMode
} from './AssemblyHeaderBar'

describe('assemblyViewPrefs', () => {
  let mockStorage: Record<string, string> = {}

  beforeEach(() => {
    mockStorage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        mockStorage = {}
      }
    })
  })

  describe('computeNextGizmoMode', () => {
    it('toggles translate correctly from translate', () => {
      expect(computeNextGizmoMode('translate', 'translate')).toBe('off')
      expect(computeNextGizmoMode('translate', 'rotate')).toBe('both')
    })

    it('toggles rotate correctly from rotate', () => {
      expect(computeNextGizmoMode('rotate', 'rotate')).toBe('off')
      expect(computeNextGizmoMode('rotate', 'translate')).toBe('both')
    })

    it('toggles correctly when both are active', () => {
      expect(computeNextGizmoMode('both', 'translate')).toBe('rotate')
      expect(computeNextGizmoMode('both', 'rotate')).toBe('translate')
    })

    it('toggles correctly when both are off', () => {
      expect(computeNextGizmoMode('off', 'translate')).toBe('translate')
      expect(computeNextGizmoMode('off', 'rotate')).toBe('rotate')
    })
  })

  describe('loadAssemblyViewPrefs & saveAssemblyViewPrefs', () => {
    it('returns DEFAULT_VIEW_STATE when nothing is in localStorage', () => {
      const prefs = loadAssemblyViewPrefs()
      expect(prefs).toEqual(DEFAULT_VIEW_STATE)
    })

    it('returns DEFAULT_VIEW_STATE when localStorage contains invalid json', () => {
      mockStorage[ASSEMBLY_VIEW_PREFS_KEY] = 'INVALID_JSON{'
      const prefs = loadAssemblyViewPrefs()
      expect(prefs).toEqual(DEFAULT_VIEW_STATE)
    })

    it('saves and loads modified view preferences', () => {
      saveAssemblyViewPrefs({
        workspaceView: '3d',
        gizmoMode: 'both',
        showGrid: false,
        showAxes: false,
        showWireframe: false,
        meshOnlyPixels: false,
        cameraPreset: 'front',
        showMesh2D: false
      })

      const loaded = loadAssemblyViewPrefs()
      expect(loaded.workspaceView).toBe('3d')
      expect(loaded.gizmoMode).toBe('both')
      expect(loaded.showGrid).toBe(false)
      expect(loaded.showAxes).toBe(false)
      expect(loaded.showWireframe).toBe(false)
      expect(loaded.meshOnlyPixels).toBe(false)
      expect(loaded.cameraPreset).toBe('front')
      expect(loaded.showMesh2D).toBe(false)
      // Untouched fields should retain defaults
      expect(loaded.meshEditMode).toBe('none')
    })

    it('supports switching gizmoMode to rotate only or off', () => {
      saveAssemblyViewPrefs({ gizmoMode: 'rotate' })
      expect(loadAssemblyViewPrefs().gizmoMode).toBe('rotate')

      saveAssemblyViewPrefs({ gizmoMode: 'off' })
      expect(loadAssemblyViewPrefs().gizmoMode).toBe('off')

      saveAssemblyViewPrefs({ gizmoMode: 'both' })
      expect(loadAssemblyViewPrefs().gizmoMode).toBe('both')
    })
  })
})
