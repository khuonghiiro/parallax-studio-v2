export interface LayerWorkshopViewPrefs {
  showFrustum: boolean
  showGrid: boolean
  clipToCamera: boolean
  showTranslate: boolean
  showRotate: boolean
  zExaggeration: number
  cameraFov: number
  cameraPreset: 'orbit' | 'top' | 'side' | 'front'
  cameraYaw: number
  cameraPitch: number
  show3DPerspective2D: boolean
  clipToCamera2D: boolean
  showBbox2D: boolean
}

export const DEFAULT_LAYER_WORKSHOP_VIEW_PREFS: LayerWorkshopViewPrefs = {
  showFrustum: true,
  showGrid: true,
  clipToCamera: true,
  showTranslate: true,
  showRotate: true,
  zExaggeration: 1.8,
  cameraFov: 45,
  cameraPreset: 'orbit',
  cameraYaw: -32,
  cameraPitch: 20,
  show3DPerspective2D: true,
  clipToCamera2D: true,
  showBbox2D: true
}

export const LAYER_WORKSHOP_VIEW_PREFS_KEY = 'pxs.layerWorkshopViewPrefs'

/**
 * Tải cài đặt tùy chọn góc nhìn và công cụ chiều sâu 3D đã lưu từ localStorage
 */
export function loadLayerWorkshopViewPrefs(): LayerWorkshopViewPrefs {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_LAYER_WORKSHOP_VIEW_PREFS }
  }
  try {
    const raw = localStorage.getItem(LAYER_WORKSHOP_VIEW_PREFS_KEY)
    if (!raw) return { ...DEFAULT_LAYER_WORKSHOP_VIEW_PREFS }
    const parsed = JSON.parse(raw)
    return {
      showFrustum: typeof parsed.showFrustum === 'boolean' ? parsed.showFrustum : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.showFrustum,
      showGrid: typeof parsed.showGrid === 'boolean' ? parsed.showGrid : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.showGrid,
      clipToCamera: typeof parsed.clipToCamera === 'boolean' ? parsed.clipToCamera : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.clipToCamera,
      showTranslate: typeof parsed.showTranslate === 'boolean' ? parsed.showTranslate : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.showTranslate,
      showRotate: typeof parsed.showRotate === 'boolean' ? parsed.showRotate : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.showRotate,
      zExaggeration: Number.isFinite(parsed.zExaggeration) ? Math.max(0.5, Math.min(5, parsed.zExaggeration)) : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.zExaggeration,
      cameraFov: Number.isFinite(parsed.cameraFov) ? Math.max(15, Math.min(120, parsed.cameraFov)) : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.cameraFov,
      cameraPreset: ['orbit', 'top', 'side', 'front'].includes(parsed.cameraPreset) ? parsed.cameraPreset : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.cameraPreset,
      cameraYaw: Number.isFinite(parsed.cameraYaw) ? parsed.cameraYaw : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.cameraYaw,
      cameraPitch: Number.isFinite(parsed.cameraPitch) ? parsed.cameraPitch : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.cameraPitch,
      show3DPerspective2D: typeof parsed.show3DPerspective2D === 'boolean' ? parsed.show3DPerspective2D : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.show3DPerspective2D,
      clipToCamera2D: typeof parsed.clipToCamera2D === 'boolean' ? parsed.clipToCamera2D : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.clipToCamera2D,
      showBbox2D: typeof parsed.showBbox2D === 'boolean' ? parsed.showBbox2D : DEFAULT_LAYER_WORKSHOP_VIEW_PREFS.showBbox2D
    }
  } catch (err) {
    console.warn('[LayerAssembly] Failed to load view preferences:', err)
    return { ...DEFAULT_LAYER_WORKSHOP_VIEW_PREFS }
  }
}

/**
 * Lưu các thay đổi tùy chọn góc nhìn và công cụ chiều sâu 3D vào localStorage
 */
export function saveLayerWorkshopViewPrefs(patch: Partial<LayerWorkshopViewPrefs>): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const current = loadLayerWorkshopViewPrefs()
    const next = { ...current, ...patch }
    localStorage.setItem(LAYER_WORKSHOP_VIEW_PREFS_KEY, JSON.stringify(next))
  } catch (err) {
    console.warn('[LayerAssembly] Failed to save view preferences:', err)
  }
}

/**
 * Đặt lại toàn bộ tùy chọn góc nhìn 3D về mặc định ban đầu và xóa cache
 */
export function resetLayerWorkshopViewPrefs(): LayerWorkshopViewPrefs {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(LAYER_WORKSHOP_VIEW_PREFS_KEY)
    } catch {}
  }
  return { ...DEFAULT_LAYER_WORKSHOP_VIEW_PREFS }
}
