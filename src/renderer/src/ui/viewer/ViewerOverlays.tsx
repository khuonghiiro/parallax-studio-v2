import type { Project } from '@shared/types'
import type { ResidencyStats } from '../../engine/SceneRenderer'
import type { EditorViewKind } from '../../engine/EditorCamera'
import { useView, type ViewState } from '../../store/view'
import { IconCamera, IconCube, IconEye, IconFocus, IconRoute, IconSingle, IconSplit } from '../icons'
import { EDITOR_KINDS, type Layout, type Quality } from './viewerLayout'

interface ViewerOverlaysProps {
  view: ViewState
  comp: Project['comp']
  playing: boolean
  fps: number
  fov: number
  stats: ResidencyStats | null
  rects: Layout
  quality: Quality
  setQuality: React.Dispatch<React.SetStateAction<Quality>>
}

export function ViewerOverlays({
  view,
  comp,
  playing,
  fps,
  fov,
  stats,
  rects,
  quality,
  setQuality
}: ViewerOverlaysProps) {
  const showEd = !!rects.ed
  const kindLabel = EDITOR_KINDS.find((k) => k.id === view.editorKind)?.label ?? ''

  return (
    <>
      {rects.cam && (
        <div
          id="camera-frame"
          className="camera-frame"
          style={{ left: rects.cam.x, top: rects.cam.y, width: rects.cam.w, height: rects.cam.h }}
        />
      )}
      {view.split && rects.ed && (
        <div className="pane-divider" style={{ left: rects.ed.x - 1 }} />
      )}

      <div className="viewer-hud">
        <span className="chip">
          <span className="dot" /> {playing ? `${fps} fps` : 'Sẵn sàng'}
        </span>
        <span className="chip">
          {comp.width}×{comp.height} · {comp.fps}p
        </span>
        {rects.cam && <span className="chip">FOV {fov.toFixed(1)}°</span>}
        {stats && (
          <span
            id="memory-chip"
            className={`chip mem${stats.textureMB > stats.budgetMB * 0.85 ? ' warn' : ''}`}
            title={`Texture GPU đang giữ: ${stats.textures} (${stats.pending} đang giải mã)\nNgân sách VRAM: ${stats.budgetMB} MB · LOD bias ${stats.lodBias}\nLayer đang vẽ trong camera: ${stats.visibleLayers}/${stats.totalLayers}\nChỉ cảnh nằm trong khung camera mới được nạp & render.`}
          >
            VRAM {stats.textureMB.toFixed(0)}/{stats.budgetMB} MB · {stats.textures} tex
            {stats.totalShots > 0 && ` · cảnh ${stats.visibleShots}/${stats.totalShots}`}
          </span>
        )}
      </div>

      {view.split && rects.cam && (
        <span className="chip pane-tag" style={{ left: rects.cam.x + 8, top: rects.cam.y + rects.cam.h - 30 }}>
          <IconCamera /> Camera
        </span>
      )}
      {showEd && (
        <span className="chip pane-tag" style={{ left: rects.ed!.x + 12, top: rects.ed!.y + rects.ed!.h - 32 }}>
          <IconCube /> 3D · {kindLabel}
          <span className="pane-hint">Kéo: xoay · Shift/chuột phải: pan · Lăn: zoom · F: focus · Double-click cảnh: bay tới</span>
        </span>
      )}

      <div className="viewer-tools">
        {!view.split && (
          <div className="seg">
            <button
              id="view-camera"
              className={`btn sm${view.primary === 'camera' ? ' active' : ''}`}
              title="Góc nhìn camera (kết quả render)"
              onClick={() => view.set({ primary: 'camera' })}
            >
              <IconCamera /> Camera
            </button>
            <button
              id="view-3d"
              className={`btn sm${view.primary === 'editor' ? ' active' : ''}`}
              title="Không gian 3D: xem các layer xếp chồng, các cảnh và đường bay camera"
              onClick={() => view.set({ primary: 'editor' })}
            >
              <IconCube /> 3D
            </button>
          </div>
        )}
        {showEd && (
          <select
            id="view-kind"
            className="select sm"
            value={view.editorKind}
            onChange={(e) => view.set({ editorKind: e.target.value as EditorViewKind })}
            title="Kiểu nhìn 3D"
          >
            {EDITOR_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        )}
        {showEd && (
          <>
            <button
              id="view-path"
              className={`btn sm icon${view.showPath ? ' active' : ''}`}
              title="Hiện đường bay camera"
              onClick={() => view.set({ showPath: !view.showPath })}
            >
              <IconRoute />
            </button>
            <button
              id="view-camera-only"
              className={`btn sm icon${view.cameraOnly ? ' active' : ''}`}
              title="Chỉ hiện nội dung camera đang thấy (xem trước cơ chế streaming — cảnh ngoài khung chỉ là khung viền)"
              onClick={() => view.set({ cameraOnly: !view.cameraOnly })}
            >
              <IconEye />
            </button>
            <button id="view-focus" className="btn sm icon" title="Focus vùng chọn (F)" onClick={() => useView.getState().requestFocus('selection')}>
              <IconFocus />
            </button>
          </>
        )}
        <button
          id="view-split"
          className={`btn sm icon${view.split ? ' active' : ''}`}
          title={view.split ? '1 view' : '2 view: Camera + 3D'}
          onClick={() => view.set({ split: !view.split })}
        >
          {view.split ? <IconSingle /> : <IconSplit />}
        </button>
        <button id="quality-toggle" className="btn sm" title="Chất lượng preview" onClick={() => setQuality((q) => (q === 1 ? 0.5 : 1))}>
          {quality === 1 ? 'Full' : 'Half'}
        </button>
      </div>
    </>
  )
}
