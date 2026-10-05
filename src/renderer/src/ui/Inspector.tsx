import { findLayer, findShot, useEditor } from '../store/editor'
import { IconLayers } from './icons'
import { ShotInspector } from './inspector/ShotInspector'
import { LayerInspector } from './inspector/LayerInspector'
import { CameraInspector } from './inspector/CameraInspector'
import { SceneInspector } from './inspector/SceneInspector'

export { ShotInspector } from './inspector/ShotInspector'
export { LayerInspector } from './inspector/LayerInspector'
export { CameraInspector } from './inspector/CameraInspector'
export { SceneInspector } from './inspector/SceneInspector'

export function Inspector() {
  const tab = useEditor((s) => s.inspectorTab)
  const setTab = useEditor((s) => s.setInspectorTab)
  const layer = useEditor((s) => findLayer(s.project, s.selectedLayerId))
  const shot = useEditor((s) => findShot(s.project, s.selectedShotId))

  return (
    <aside className="right">
      <section className="panel" style={{ flex: 1 }}>
        <div className="tabs">
          <button id="tab-layer" className={`tab${tab === 'layer' ? ' active' : ''}`} onClick={() => setTab('layer')}>
            {!layer && shot ? 'Cảnh này' : 'Layer'}
          </button>
          <button id="tab-camera" className={`tab${tab === 'camera' ? ' active' : ''}`} onClick={() => setTab('camera')}>
            Camera
          </button>
          <button id="tab-scene" className={`tab${tab === 'scene' ? ' active' : ''}`} onClick={() => setTab('scene')}>
            Dự án
          </button>
        </div>
        <div className="panel-body">
          {tab === 'layer' &&
            (layer ? (
              <LayerInspector layer={layer} />
            ) : shot ? (
              <ShotInspector shot={shot} />
            ) : (
              <div className="empty">
                <IconLayers width={28} height={28} style={{ opacity: 0.5 }} />
                <br />
                Chọn một layer hoặc cảnh trong viewer, timeline hay danh sách cảnh.
              </div>
            ))}
          {tab === 'camera' && <CameraInspector />}
          {tab === 'scene' && <SceneInspector />}
        </div>
      </section>
    </aside>
  )
}
