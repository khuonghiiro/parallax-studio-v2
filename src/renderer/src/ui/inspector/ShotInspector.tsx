import type { Shot } from '@shared/types'
import { deleteShot, flyToShot, updateShot } from '../../actions'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { AnimRow, ColorInput, Row, Switch, TextInput } from '../controls'
import { IconFilm, IconFocus, IconPlane, IconTrash } from '../icons'
import { KeyEaseSection } from './KeyEaseSection'

export function ShotInspector({ shot }: { shot: Shot }) {
  const layerCount = useEditor((s) => s.project.layers.filter((l) => l.shotId === shot.id).length)
  const id = shot.id
  return (
    <>
      <div className="section">
        <div className="section-title">
          <IconFilm width={13} height={13} /> Cảnh
          <span className="spacer" />
          <span className="shot-chip" style={{ ['--c' as string]: shot.color }}>
            {layerCount} layer
          </span>
        </div>
        <Row label="Tên">
          <TextInput id="shot-name" value={shot.name} onCommit={(v) => updateShot(id, { name: v }, `shot-name-${id}`)} />
        </Row>
        <Row label="Màu">
          <ColorInput value={shot.color} onChange={(v, k) => updateShot(id, { color: v }, k)} />
        </Row>
        <Row label="Hiển thị">
          <Switch on={shot.visible} onChange={(v) => updateShot(id, { visible: v })} />
        </Row>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button id="shot-fly" className="btn sm primary" onClick={() => flyToShot(id)} title="Tạo keyframe camera nhìn cảnh này tại thời điểm hiện tại">
            <IconPlane /> Camera bay tới
          </button>
          <button className="btn sm" onClick={() => useView.getState().requestFocus('shot', id)}>
            <IconFocus /> Xem trong 3D
          </button>
          <button className="btn sm danger" onClick={() => deleteShot(id)}>
            <IconTrash /> Xoá
          </button>
        </div>
      </div>
      <div className="section">
        <div className="section-title">Vị trí trong không gian</div>
        <AnimRow label="Vị trí" refp={{ kind: 'shot', shotId: id, prop: 'position' }} kind="vec3" step={5} precision={0} />
        <AnimRow label="Xoay (°)" refp={{ kind: 'shot', shotId: id, prop: 'rotation' }} kind="vec3" step={0.25} precision={1} />
        <p className="hint-text" style={{ margin: '8px 0 0' }}>
          Di chuyển/xoay cả cụm layer. Trong view 3D có thể kéo nhãn tên cảnh để dời cảnh.
        </p>
      </div>
      <KeyEaseSection match={(r) => r.kind === 'shot' && r.shotId === id} />
    </>
  )
}
