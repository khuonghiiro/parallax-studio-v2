import type { AutoOrientMode, BlendMode, Layer, Vec3 } from '@shared/types'
import { anim, evaluate, setValueAt } from '../../animation/keyframes'
import { setLayerShot } from '../../actions'
import { frameTolerance, useEditor } from '../../store/editor'
import { AnimRow, NumberInput, Row, Select, Switch, TextInput } from '../controls'
import { useLayerUpdater } from './useLayerUpdater'
import { KeyEaseSection } from './KeyEaseSection'
import { ImageSection } from './sections/ImageSection'
import { TextSection } from './sections/TextSection'
import { SolidSection } from './sections/SolidSection'
import { MotionSection } from './sections/MotionSection'
import { GlowSection } from './sections/GlowSection'
import { LayerEffectsSection } from './sections/LayerEffectsSection'
import { ParticleSection } from './sections/ParticleSection'
import { Model3DSection } from './sections/Model3DSection'

export function LayerInspector({ layer }: { layer: Layer }) {
  const set = useLayerUpdater(layer.id)
  const duration = useEditor((s) => s.project.comp.duration)
  const comp = useEditor((s) => s.project.comp)
  const time = useEditor((s) => s.time)
  const tol = useEditor((s) => frameTolerance(s.project))
  const shots = useEditor((s) => s.project.shots)
  const allLayers = useEditor((s) => s.project.layers)
  const id = layer.id

  const currentRot = evaluate(layer.transform.rotation, time)

  const setOrientation = (type: 'vertical' | 'ground' | 'tilted' | 'ceiling') => {
    set((l) => {
      let rotVal: Vec3 = [0, 0, 0]
      if (type === 'ground') rotVal = [-90, 0, 0]
      else if (type === 'tilted') rotVal = [-75, 0, 0]
      else if (type === 'ceiling') rotVal = [90, 0, 0]
      setValueAt(l.transform.rotation, time, rotVal, tol)
      if (type === 'ground' || type === 'tilted') {
        l.autoScale = false
        const currentPos = evaluate(l.transform.position, time)
        if (Math.abs(currentPos[1]) < 80) {
          setValueAt(l.transform.position, time, [currentPos[0], -Math.round(comp.height * 0.42), Math.max(currentPos[2], 800)], tol)
        }
      } else if (type === 'ceiling') {
        l.autoScale = false
        const currentPos = evaluate(l.transform.position, time)
        if (Math.abs(currentPos[1]) < 80) {
          setValueAt(l.transform.position, time, [currentPos[0], Math.round(comp.height * 0.42), Math.max(currentPos[2], 800)], tol)
        }
      }
    }, 'orientation')
  }

  return (
    <>
      <div className="section">
        <div className="section-title">Layer</div>
        <Row label="Tên">
          <TextInput id="layer-name" value={layer.name} onCommit={(v) => set((l) => void (l.name = v), 'name')} />
        </Row>
        {shots.length > 0 && (
          <Row label="Thuộc cảnh" title="Vị trí layer tính tương đối với cảnh chứa nó">
            <Select
              id="layer-shot"
              value={layer.shotId ?? ''}
              options={[
                { value: '', label: '— Layer chung (toạ độ thế giới)' },
                ...shots.map((s) => ({ value: s.id, label: s.name }))
              ]}
              onChange={(val) => setLayerShot(id, (val as string) || null)}
            />
          </Row>
        )}
        <Row label="Blend mode">
          <Select
            id="layer-blend"
            value={layer.blendMode}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'add', label: 'Add' },
              { value: 'screen', label: 'Screen' },
              { value: 'multiply', label: 'Multiply' }
            ]}
            onChange={(val) => set((l) => void (l.blendMode = val as BlendMode))}
          />
        </Row>
        <Row label="Layer cha (Parent)" title="Kế thừa vị trí/xoay/scale theo layer cha (After Effects Parent & Link)">
          <Select
            id="layer-parent"
            value={layer.parentId ?? ''}
            options={[
              { value: '', label: '— Không có (Độc lập)' },
              ...allLayers
                .filter((ol) => ol.id !== id && ol.parentId !== id)
                .map((ol) => ({ value: ol.id, label: ol.name }))
            ]}
            onChange={(val) => set((l) => void (l.parentId = (val as string) || null))}
          />
        </Row>
        <Row label="Hướng Camera" title="Tự động xoay mặt về phía camera khi camera 3D di chuyển (After Effects Auto-Orient)">
          <Select
            id="layer-auto-orient"
            value={layer.autoOrient ?? 'none'}
            options={[
              { value: 'none', label: 'Tắt (Cố định góc 3D)' },
              { value: 'camera-y', label: '🌲 Trục đứng Y (Cây cối / Nhân vật 2.5D)' },
              { value: 'camera', label: '🔄 Toàn phần 3D (Khói / Hạt / Đốm sáng)' }
            ]}
            onChange={(val) => set((l) => void (l.autoOrient = val as AutoOrientMode))}
          />
        </Row>
        <Row label="Giữ kích thước" title="Tự scale theo độ sâu để kích thước hiển thị không đổi (từ camera mặc định)">
          <Switch id="layer-autoscale" on={layer.autoScale} onChange={(v) => set((l) => void (l.autoScale = v))} />
        </Row>
        <Row label="In / Out (s)">
          <NumberInput value={layer.inPoint} step={0.05} precision={2} min={0} max={duration} onChange={(v, k) => set((l) => void (l.inPoint = Math.min(v, l.outPoint)), k)} />
          <NumberInput value={layer.outPoint} step={0.05} precision={2} min={0} max={duration} onChange={(v, k) => set((l) => void (l.outPoint = Math.max(v, l.inPoint)), k)} />
        </Row>
        <Row label="Fade In / Out (s)" title="Thời gian mờ dần khi xuất hiện và biến mất (giây)">
          <NumberInput
            axis="in"
            value={layer.fadeIn ?? 0}
            step={0.1}
            precision={2}
            min={0}
            max={5}
            onChange={(v, k) => set((l) => void (l.fadeIn = v), k)}
          />
          <NumberInput
            axis="out"
            value={layer.fadeOut ?? 0}
            step={0.1}
            precision={2}
            min={0}
            max={5}
            onChange={(v, k) => set((l) => void (l.fadeOut = v), k)}
          />
        </Row>
      </div>

      <Model3DSection layer={layer} />

      <div className="section">
        <div className="section-title">Transform</div>
        <AnimRow label="Vị trí" refp={{ kind: 'layer', layerId: id, prop: 'position' }} kind="vec3" step={1} precision={0} />
        <AnimRow label="Điểm neo" refp={{ kind: 'layer', layerId: id, prop: 'anchor' }} kind="vec3" step={0.05} precision={2} />
        <Row label="Tâm neo" title="Đặt nhanh điểm neo xoay & co giãn (After Effects Anchor Point)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, width: '100%', minWidth: 0 }}>
            <button
              className="btn sm ghost"
              style={{ flex: '1 1 36px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0, 0, 0]) })}
              title="Tâm ở chính giữa [0, 0]"
            >
              Tâm
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: '1 1 36px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0, -0.5, 0]) })}
              title="Tâm ở chân cây / nhân vật (Đáy) để gió đung đưa từ gốc"
            >
              Chân
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: '1 1 36px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0, 0.5, 0]) })}
              title="Tâm ở đỉnh trên"
            >
              Đỉnh
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: '1 1 36px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([-0.5, 0, 0]) })}
              title="Tâm ở mép trái"
            >
              Trái
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: '1 1 36px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0.5, 0, 0]) })}
              title="Tâm ở mép phải"
            >
              Phải
            </button>
          </div>
        </Row>
        <AnimRow label="Xoay (°)" refp={{ kind: 'layer', layerId: id, prop: 'rotation' }} kind="vec3" step={0.25} precision={1} />
        <Row label="Dáng 3D" title="Đặt nhanh dáng layer: Đứng thẳng (2.5D), Mặt đất/Sàn ngang (-90°), Nghiêng dốc (-75°), hoặc Trần nhà (90°)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, width: '100%', minWidth: 0 }}>
            <button
              className={`btn sm ${Math.abs(currentRot[0]) < 1 && Math.abs(currentRot[1]) < 1 && Math.abs(currentRot[2]) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: '1 1 42px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => setOrientation('vertical')}
              title="Đứng thẳng đối diện camera (mặc định 2.5D)"
            >
              Đứng
            </button>
            <button
              className={`btn sm ${Math.abs(currentRot[0] - -90) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: '1 1 48px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => setOrientation('ground')}
              title="Nằm ngang làm mặt đất / sàn (xoay X -90°)"
            >
              Mặt đất
            </button>
            <button
              className={`btn sm ${Math.abs(currentRot[0] - -75) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: '1 1 48px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => setOrientation('tilted')}
              title="Nghiêng 75° tạo độ dốc xa dần vào chiều sâu"
            >
              Nghiêng
            </button>
            <button
              className={`btn sm ${Math.abs(currentRot[0] - 90) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: '1 1 42px', padding: '2px 0', fontSize: '10.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => setOrientation('ceiling')}
              title="Nằm ngang trên cao làm trần nhà (xoay X 90°)"
            >
              Trần
            </button>
          </div>
        </Row>
        <AnimRow label="Scale %" refp={{ kind: 'layer', layerId: id, prop: 'scale' }} kind="vec2" step={0.5} precision={1} displayScale={100} linkable />
        <AnimRow label="Opacity %" refp={{ kind: 'layer', layerId: id, prop: 'opacity' }} kind="number" step={0.5} precision={0} displayScale={100} min={0} max={100} />
        <p className="hint-text" style={{ margin: '8px 0 0' }}>
          Z dương = xa camera{layer.shotId ? ' (toạ độ tương đối với cảnh)' : ''}. Kéo nhãn X/Y/Z để scrub (Shift ×10, Alt ×0.1).
        </p>
      </div>

      <LayerEffectsSection layer={layer} set={set} />

      <MotionSection layer={layer} set={set} />
      {layer.type !== 'particles' && <GlowSection layer={layer} set={set} />}

      <KeyEaseSection match={(r) => r.kind === 'layer' && r.layerId === id} />

      {layer.type === 'image' && <ImageSection layer={layer} set={set} />}
      {layer.type === 'text' && <TextSection props={layer.props} set={set} />}
      {layer.type === 'solid' && <SolidSection props={layer.props} set={set} />}
      {layer.type === 'particles' && <ParticleSection props={layer.props} set={set} />}
    </>
  )
}
