import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEFAULT_LAYER_WORKSHOP_VIEW_PREFS,
  LAYER_WORKSHOP_VIEW_PREFS_KEY,
  loadLayerWorkshopViewPrefs,
  saveLayerWorkshopViewPrefs,
  resetLayerWorkshopViewPrefs
} from './layerAssemblyViewPrefs'

describe('layerAssemblyViewPrefs', () => {
  let mockStorage: Record<string, string> = {}

  beforeEach(() => {
    mockStorage = {}
    const store = {
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
    }
    vi.stubGlobal('localStorage', store)
    vi.stubGlobal('window', { localStorage: store })
  })

  it('trả về cấu hình mặc định khi localStorage chưa có dữ liệu', () => {
    const prefs = loadLayerWorkshopViewPrefs()
    expect(prefs).toEqual(DEFAULT_LAYER_WORKSHOP_VIEW_PREFS)
    expect(prefs.showFrustum).toBe(true)
    expect(prefs.showGrid).toBe(true)
    expect(prefs.clipToCamera).toBe(true)
    expect(prefs.zExaggeration).toBe(1.8)
    expect(prefs.cameraFov).toBe(45)
  })

  it('lưu và tải lại đúng các thay đổi trong preferences', () => {
    saveLayerWorkshopViewPrefs({
      showFrustum: false,
      showGrid: false,
      zExaggeration: 2.5,
      cameraFov: 60,
      cameraPreset: 'top',
      showTranslate: false
    })

    const loaded = loadLayerWorkshopViewPrefs()
    expect(loaded.showFrustum).toBe(false)
    expect(loaded.showGrid).toBe(false)
    expect(loaded.zExaggeration).toBe(2.5)
    expect(loaded.cameraFov).toBe(60)
    expect(loaded.cameraPreset).toBe('top')
    expect(loaded.showTranslate).toBe(false)
    // Các giá trị không đổi vẫn giữ nguyên
    expect(loaded.showRotate).toBe(true)
    expect(loaded.clipToCamera).toBe(true)
  })

  it('kẹp giới hạn hợp lệ cho zExaggeration và cameraFov', () => {
    saveLayerWorkshopViewPrefs({
      zExaggeration: 100, // vượt quá max 5
      cameraFov: 200 // vượt quá max 120
    })

    const loaded = loadLayerWorkshopViewPrefs()
    expect(loaded.zExaggeration).toBe(5)
    expect(loaded.cameraFov).toBe(120)
  })

  it('khôi phục về mặc định và xóa cache khi gọi resetLayerWorkshopViewPrefs', () => {
    saveLayerWorkshopViewPrefs({
      showFrustum: false,
      zExaggeration: 3.2
    })
    expect(mockStorage[LAYER_WORKSHOP_VIEW_PREFS_KEY]).toBeTruthy()

    const reset = resetLayerWorkshopViewPrefs()
    expect(reset).toEqual(DEFAULT_LAYER_WORKSHOP_VIEW_PREFS)
    expect(mockStorage[LAYER_WORKSHOP_VIEW_PREFS_KEY]).toBeUndefined()
  })
})
