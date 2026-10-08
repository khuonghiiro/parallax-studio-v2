import { useState, type ReactNode } from 'react'
import type { GizmoMode } from './AssemblyViewport'
import { ASSEMBLY_SHORTCUTS } from './useAssemblyShortcuts'
import {
  IconAxisMove,
  IconAxisRotate,
  IconCube,
  IconFocus,
  IconGrid,
  IconImage,
  IconInfo,
  IconRedo,
  IconSplitView,
  IconUndo,
  IconWireframe,
  IconX
} from '../../icons'

export type CameraPreset = 'front' | 'left' | 'right' | 'top' | 'iso'
export type MeshEditMode = 'none' | 'erase' | 'select'
export type WorkspaceView = '3d' | '2d' | 'split'

export interface AssemblyViewState {
  workspaceView: WorkspaceView
  showWireframe: boolean
  meshOnlyPixels: boolean
  showGrid: boolean
  showAxes: boolean
  cameraPreset: CameraPreset
  gizmoMode: GizmoMode
  meshEditMode: MeshEditMode
  showMesh2D: boolean
}

export const DEFAULT_VIEW_STATE: AssemblyViewState = {
  workspaceView: 'split',
  showWireframe: true,
  meshOnlyPixels: true,
  showGrid: true,
  showAxes: true,
  cameraPreset: 'iso',
  gizmoMode: 'translate',
  meshEditMode: 'none',
  showMesh2D: true
}

export const ASSEMBLY_VIEW_PREFS_KEY = 'pxs:assembly_view_prefs'

/** Load saved assembly view preferences from localStorage with fallback to default state. */
export function loadAssemblyViewPrefs(): AssemblyViewState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ASSEMBLY_VIEW_PREFS_KEY) : null
    if (!raw) return { ...DEFAULT_VIEW_STATE }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_VIEW_STATE }
    return {
      workspaceView: (['split', '3d', '2d'] as const).includes(parsed.workspaceView)
        ? parsed.workspaceView
        : DEFAULT_VIEW_STATE.workspaceView,
      showWireframe: typeof parsed.showWireframe === 'boolean'
        ? parsed.showWireframe
        : DEFAULT_VIEW_STATE.showWireframe,
      meshOnlyPixels: typeof parsed.meshOnlyPixels === 'boolean'
        ? parsed.meshOnlyPixels
        : DEFAULT_VIEW_STATE.meshOnlyPixels,
      showGrid: typeof parsed.showGrid === 'boolean'
        ? parsed.showGrid
        : DEFAULT_VIEW_STATE.showGrid,
      showAxes: typeof parsed.showAxes === 'boolean'
        ? parsed.showAxes
        : DEFAULT_VIEW_STATE.showAxes,
      cameraPreset: (['front', 'left', 'right', 'top', 'iso'] as const).includes(parsed.cameraPreset)
        ? parsed.cameraPreset
        : DEFAULT_VIEW_STATE.cameraPreset,
      gizmoMode: (['translate', 'rotate', 'both', 'off'] as const).includes(parsed.gizmoMode)
        ? parsed.gizmoMode
        : DEFAULT_VIEW_STATE.gizmoMode,
      meshEditMode: (['none', 'erase', 'select'] as const).includes(parsed.meshEditMode)
        ? parsed.meshEditMode
        : DEFAULT_VIEW_STATE.meshEditMode,
      showMesh2D: typeof parsed.showMesh2D === 'boolean'
        ? parsed.showMesh2D
        : DEFAULT_VIEW_STATE.showMesh2D
    }
  } catch (err) {
    console.warn('[AssemblyHeaderBar] Error loading view preferences:', err)
    return { ...DEFAULT_VIEW_STATE }
  }
}

/** Save updated view preferences to localStorage. */
export function saveAssemblyViewPrefs(state: Partial<AssemblyViewState>): void {
  try {
    if (typeof localStorage === 'undefined') return
    const current = loadAssemblyViewPrefs()
    const merged = { ...current, ...state }
    localStorage.setItem(ASSEMBLY_VIEW_PREFS_KEY, JSON.stringify(merged))
  } catch (err) {
    console.warn('[AssemblyHeaderBar] Error saving view preferences:', err)
  }
}

/** Compute the next GizmoMode when toggling translate or rotate independently. */
export function computeNextGizmoMode(current: GizmoMode, toggled: 'translate' | 'rotate'): GizmoMode {
  const isTranslate = current === 'translate' || current === 'both'
  const isRotate = current === 'rotate' || current === 'both'
  if (toggled === 'translate') {
    if (isTranslate) return isRotate ? 'rotate' : 'off'
    return isRotate ? 'both' : 'translate'
  } else {
    if (isRotate) return isTranslate ? 'translate' : 'off'
    return isTranslate ? 'both' : 'rotate'
  }
}

interface AssemblyHeaderBarProps {
  view: AssemblyViewState
  onViewChange: (patch: Partial<AssemblyViewState>) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onFrame: () => void
  onClose: () => void
}

const VIEW_TABS: Array<{ id: WorkspaceView; label: string; title: string; Icon: typeof IconCube }> = [
  { id: 'split', label: '2D & 3D', title: 'Chia đôi: chỉnh lưới 2D và xem 3D realtime', Icon: IconSplitView },
  { id: '3d', label: '3D', title: 'Toàn màn hình không gian 3D', Icon: IconCube },
  { id: '2d', label: '2D', title: 'Toàn màn hình chỉnh lưới ảnh 2D', Icon: IconImage }
]

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string; title: string }> = [
  { id: 'front', label: 'Trước', title: 'Nhìn thẳng chính diện' },
  { id: 'left', label: 'Trái', title: 'Góc nhìn bên trái' },
  { id: 'right', label: 'Phải', title: 'Góc nhìn bên phải' },
  { id: 'top', label: 'Trên', title: 'Góc nhìn từ trên xuống' },
  { id: 'iso', label: 'Phối cảnh', title: 'Phối cảnh 3D lập thể' }
]

function ShortcutHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="ah-help">
      <button
        type="button"
        className={`ah-icon-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Phím tắt"
        aria-expanded={open}
      >
        <IconInfo width={14} height={14} />
      </button>
      {open && (
        <div className="ah-help-pop" role="dialog" aria-label="Phím tắt Xưởng lắp ráp" onMouseLeave={() => setOpen(false)}>
          <div className="ah-help-title">Phím tắt</div>
          {ASSEMBLY_SHORTCUTS.map(([keys, label]) => (
            <div key={keys} className="ah-help-row">
              <kbd>{keys}</kbd>
              <span>{label}</span>
            </div>
          ))}
          <div className="ah-help-row">
            <kbd>Shift + Click / Alt + Click</kbd>
            <span>Chọn ô uốn / gọt ô lưới trên 3D</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Header of the Assembly workshop: workspace layout, tools, display toggles, camera, history. */
export function AssemblyHeaderBar({ view, onViewChange, canUndo, canRedo, onUndo, onRedo, onFrame, onClose }: AssemblyHeaderBarProps) {
  const toggle = (key: 'showWireframe' | 'meshOnlyPixels' | 'showGrid' | 'showAxes', label: string, title: string, icon?: ReactNode) => (
    <button
      type="button"
      className={`ah-toggle${view[key] ? ' active' : ''}`}
      aria-pressed={view[key]}
      title={title}
      onClick={() => onViewChange({ [key]: !view[key] })}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
  const meshMode = (mode: MeshEditMode) => onViewChange({ meshEditMode: view.meshEditMode === mode ? 'none' : mode })
  const isTranslateActive = view.gizmoMode === 'translate' || view.gizmoMode === 'both'
  const isRotateActive = view.gizmoMode === 'rotate' || view.gizmoMode === 'both'
  const toggleGizmo = (kind: 'translate' | 'rotate') => {
    onViewChange({ gizmoMode: computeNextGizmoMode(view.gizmoMode, kind) })
  }

  return (
    <div className="assembly-modal-header">
      <div className="header-title">
        <IconCube width={18} height={18} />
        <span>Xưởng Lắp Ráp 3D</span>
      </div>

      <div className="ah-group ah-history">
        <button type="button" className="ah-icon-btn" disabled={!canUndo} onClick={onUndo} title="Hoàn tác (Ctrl+Z)">
          <IconUndo width={14} height={14} />
        </button>
        <button type="button" className="ah-icon-btn" disabled={!canRedo} onClick={onRedo} title="Làm lại (Ctrl+Y)">
          <IconRedo width={14} height={14} />
        </button>
      </div>

      <div className="header-view-controls">
        <div className="view-mode-tabs" title="Bố cục khung làm việc">
          {VIEW_TABS.map(({ id, label, title, Icon }) => (
            <button key={id} type="button" title={title} onClick={() => onViewChange({ workspaceView: id })}
              className={`view-mode-tab-btn${view.workspaceView === id ? ' active' : ''}`}>
              <Icon width={13} height={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="ah-seg" role="group" aria-label="Công cụ biến đổi">
          <button
            type="button"
            className={`ah-seg-btn${isTranslateActive ? ' active' : ''}`}
            onClick={() => toggleGizmo('translate')}
            title="Trục di chuyển XYZ + khung co giãn (bấm để bật/tắt)"
            aria-pressed={isTranslateActive}
          >
            <IconAxisMove width={12} height={12} />
            <span>Di chuyển</span>
          </button>
          <button
            type="button"
            className={`ah-seg-btn${isRotateActive ? ' active' : ''}`}
            onClick={() => toggleGizmo('rotate')}
            title="3 vòng tròn xoay XYZ (bấm để bật/tắt)"
            aria-pressed={isRotateActive}
          >
            <IconAxisRotate width={12} height={12} />
            <span>Xoay</span>
          </button>
          <button type="button" className={`ah-seg-btn${view.meshEditMode === 'select' ? ' active' : ''}`}
            onClick={() => meshMode('select')} title="Chọn ô lưới để uốn/bẻ (hoặc Shift + Click trên 3D)">
            <span>Chọn ô</span>
          </button>
          <button type="button" className={`ah-seg-btn danger${view.meshEditMode === 'erase' ? ' active' : ''}`}
            onClick={() => meshMode('erase')} title="Gọt/tỉa từng ô lưới (hoặc Alt + Click trên 3D)">
            <span>Gọt</span>
          </button>
        </div>

        <div className="ah-group">
          {toggle('showWireframe', 'Mesh', 'Hiện lưới dây wireframe', <IconWireframe width={12} height={12} />)}
          {toggle('meshOnlyPixels', 'Bám pixel', 'Lưới tự bám theo viền pixel của ảnh (tắt = giữ nguyên khung chữ nhật)')}
          {toggle('showGrid', 'Sàn', 'Hiện lưới mặt sàn', <IconGrid width={12} height={12} />)}
          {toggle('showAxes', 'Trục', 'Hiện trục tọa độ không gian')}
        </div>

        <div className="ah-seg" role="group" aria-label="Góc camera">
          {CAMERA_PRESETS.map((p) => (
            <button key={p.id} type="button" title={p.title} onClick={() => onViewChange({ cameraPreset: p.id })}
              className={`ah-seg-btn${view.cameraPreset === p.id ? ' active' : ''}`}>
              {p.label}
            </button>
          ))}
          <button type="button" className="ah-seg-btn" onClick={onFrame} title="Lấy nét camera vào mặt đang chọn (F)">
            <IconFocus width={12} height={12} />
          </button>
        </div>

        <ShortcutHelp />
      </div>

      <button type="button" className="ah-icon-btn ah-close" onClick={onClose} title="Đóng">
        <IconX width={14} height={14} />
      </button>
    </div>
  )
}
