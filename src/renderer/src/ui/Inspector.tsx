import { findLayer, findShot, useEditor } from '../store/editor'
import { IconLayers } from './icons'
import { ShotInspector } from './inspector/ShotInspector'
import { LayerInspector } from './inspector/LayerInspector'
import { CameraInspector } from './inspector/CameraInspector'
import { SceneInspector } from './inspector/SceneInspector'
import { AudioTrackInspector } from './inspector/AudioTrackInspector'

export { ShotInspector } from './inspector/ShotInspector'
export { LayerInspector } from './inspector/LayerInspector'
export { CameraInspector } from './inspector/CameraInspector'
export { SceneInspector } from './inspector/SceneInspector'
export { AudioTrackInspector } from './inspector/AudioTrackInspector'

export function Inspector() {
  const tab = useEditor((s) => s.inspectorTab)
  const setTab = useEditor((s) => s.setInspectorTab)
  const layer = useEditor((s) => findLayer(s.project, s.selectedLayerId))
  const shot = useEditor((s) => findShot(s.project, s.selectedShotId))
  const audioTrack = useEditor((s) =>
    s.selectedAudioTrackId
      ? s.project.audioTracks?.find((t) => t.id === s.selectedAudioTrackId) ||
        (s.project.audio?.id === s.selectedAudioTrackId ? s.project.audio : null)
      : null
  )

  const tabTitle = audioTrack ? 'Âm thanh' : !layer && shot ? 'Cảnh này' : 'Layer'

  return (
    <aside className="right">
      <section className="panel" style={{ flex: 1 }}>
        <div className="tabs">
          <button id="tab-layer" className={`tab${tab === 'layer' ? ' active' : ''}`} onClick={() => setTab('layer')}>
            {tabTitle}
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
            (audioTrack ? (
              <AudioTrackInspector track={audioTrack} />
            ) : layer ? (
              <LayerInspector layer={layer} />
            ) : shot ? (
              <ShotInspector shot={shot} />
            ) : (
              <div className="empty">
                <IconLayers width={28} height={28} style={{ opacity: 0.5 }} />
                <br />
                Chọn một layer, cảnh hoặc đoạn âm thanh trên timeline để chỉnh sửa.
              </div>
            ))}
          {tab === 'camera' && <CameraInspector />}
          {tab === 'scene' && <SceneInspector />}
        </div>
      </section>
    </aside>
  )
}
