import { useState } from 'react'
import type { AutoOrientMode, BlendMode, DriftDirection, DriftLoopMode, EaseName, Layer, LayerMotion, LayerMotionType, ParticleProps, Shot, SolidProps, TextProps, Vec3 } from '@shared/types'
import { EASE_LABELS } from '../animation/easing'
import { addKeyframe, anim, evaluate, setValueAt } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { shotAtTime } from '../animation/cameraPath'
import { CAMERA_PRESETS, PARTICLE_PRESETS, applyCameraPreset } from '../animation/presets'
import { deleteShot, flyToShot, importAudio, setLayerShot, updateShot } from '../actions'
import { evaluateScene, parseDirectionAngle, shotFramingPose, shotLocalToWorld } from '../engine/evaluateScene'
import { assetStore } from '../project/assets'
import { findLayer, findShot, frameTolerance, getAnimatable, getDraftAnimatable, useEditor, type PropRef } from '../store/editor'
import { useView } from '../store/view'
import { AnimRow, ColorInput, NumberInput, Row, Slider, Switch, TextInput } from './controls'
import { IconCamera, IconFilm, IconFocus, IconLayers, IconMusic, IconPlane, IconTrash, IconWand } from './icons'

const FONTS = ['Montserrat', 'Inter', 'Playfair Display', 'Bebas Neue', 'JetBrains Mono']

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

// ------------------------------------------------------------------ shot

function ShotInspector({ shot }: { shot: Shot }) {
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

// ------------------------------------------------------------------ helpers

function useLayerUpdater(id: string) {
  const update = useEditor((s) => s.update)
  return (fn: (l: Layer) => void, mergeKey?: string) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === id)
      if (l) fn(l as Layer)
    }, mergeKey && `${id}-${mergeKey}`)
}

function KeyEaseSection({ match }: { match: (ref: PropRef) => boolean }) {
  const sel = useEditor((s) => s.selectedKey)
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  if (!sel || !match(sel.ref)) return null
  const a = getAnimatable(project, sel.ref)
  const key = a?.keyframes.find((k) => k.id === sel.keyId)
  if (!key) return null
  return (
    <div className="section">
      <div className="section-title">Keyframe đang chọn</div>
      <Row label="Thời điểm">
        <NumberInput
          value={key.t}
          step={1 / project.comp.fps}
          precision={2}
          min={0}
          max={project.comp.duration}
          suffix="s"
          onChange={(v) =>
            update((d) => {
              const da = getDraftAnimatable(d, sel.ref)
              const k = da?.keyframes.find((x) => x.id === sel.keyId)
              if (da && k) {
                k.t = v
                da.keyframes.sort((x, y) => x.t - y.t)
              }
            }, `keytime-${sel.keyId}`)
          }
        />
      </Row>
      <Row label="Easing">
        <select
          id="key-ease"
          className="select"
          value={key.ease}
          onChange={(e) =>
            update((d) => {
              const k = getDraftAnimatable(d, sel.ref)?.keyframes.find((x) => x.id === sel.keyId)
              if (k) k.ease = e.target.value as EaseName
            })
          }
        >
          {(Object.keys(EASE_LABELS) as EaseName[]).map((k) => (
            <option key={k} value={k}>
              {EASE_LABELS[k]}
            </option>
          ))}
        </select>
      </Row>
    </div>
  )
}

// ------------------------------------------------------------------ layer

function LayerInspector({ layer }: { layer: Layer }) {
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
            <select id="layer-shot" className="select" value={layer.shotId ?? ''} onChange={(e) => setLayerShot(id, e.target.value || null)}>
              <option value="">— Layer chung (toạ độ thế giới)</option>
              {shots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Row>
        )}
        <Row label="Blend mode">
          <select
            id="layer-blend"
            className="select"
            value={layer.blendMode}
            onChange={(e) => set((l) => void (l.blendMode = e.target.value as BlendMode))}
          >
            <option value="normal">Normal</option>
            <option value="add">Add</option>
            <option value="screen">Screen</option>
            <option value="multiply">Multiply</option>
          </select>
        </Row>
        <Row label="Layer cha (Parent)" title="Kế thừa vị trí/xoay/scale theo layer cha (After Effects Parent & Link)">
          <select
            id="layer-parent"
            className="select"
            value={layer.parentId ?? ''}
            onChange={(e) => set((l) => void (l.parentId = e.target.value || null))}
          >
            <option value="">— Không có (Độc lập)</option>
            {allLayers
              .filter((ol) => ol.id !== id && ol.parentId !== id)
              .map((ol) => (
                <option key={ol.id} value={ol.id}>
                  {ol.name}
                </option>
              ))}
          </select>
        </Row>
        <Row label="Hướng Camera" title="Tự động xoay mặt về phía camera khi camera 3D di chuyển (After Effects Auto-Orient)">
          <select
            id="layer-auto-orient"
            className="select"
            value={layer.autoOrient ?? 'none'}
            onChange={(e) => set((l) => void (l.autoOrient = e.target.value as AutoOrientMode))}
          >
            <option value="none">Tắt (Cố định góc 3D)</option>
            <option value="camera-y">🌲 Trục đứng Y (Cây cối / Nhân vật 2.5D)</option>
            <option value="camera">🔄 Toàn phần 3D (Khói / Hạt / Đốm sáng)</option>
          </select>
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

      <div className="section">
        <div className="section-title">Transform</div>
        <AnimRow label="Vị trí" refp={{ kind: 'layer', layerId: id, prop: 'position' }} kind="vec3" step={1} precision={0} />
        <AnimRow label="Điểm neo" refp={{ kind: 'layer', layerId: id, prop: 'anchor' }} kind="vec3" step={0.05} precision={2} />
        <Row label="Tâm neo" title="Đặt nhanh điểm neo xoay & co giãn (After Effects Anchor Point)">
          <div style={{ display: 'flex', gap: 4, width: '100%' }}>
            <button
              className="btn sm ghost"
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0, 0, 0]) })}
              title="Tâm ở chính giữa [0, 0]"
            >
              Tâm
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0, -0.5, 0]) })}
              title="Tâm ở chân cây / nhân vật để gió đung đưa từ gốc"
            >
              Chân (Đáy)
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0, 0.5, 0]) })}
              title="Tâm ở đỉnh trên"
            >
              Đỉnh
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([-0.5, 0, 0]) })}
              title="Tâm ở mép trái"
            >
              Trái
            </button>
            <button
              className="btn sm ghost"
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => set((l) => { l.transform.anchor = anim<Vec3>([0.5, 0, 0]) })}
              title="Tâm ở mép phải"
            >
              Phải
            </button>
          </div>
        </Row>
        <AnimRow label="Xoay (°)" refp={{ kind: 'layer', layerId: id, prop: 'rotation' }} kind="vec3" step={0.25} precision={1} />
        <Row label="Dáng 3D" title="Đặt nhanh dáng layer: Đứng thẳng (2.5D), Mặt đất/Sàn ngang (-90°), Nghiêng dốc (-75°), hoặc Trần nhà (90°)">
          <div style={{ display: 'flex', gap: 4, width: '100%' }}>
            <button
              className={`btn sm ${Math.abs(currentRot[0]) < 1 && Math.abs(currentRot[1]) < 1 && Math.abs(currentRot[2]) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => setOrientation('vertical')}
              title="Đứng thẳng đối diện camera (mặc định 2.5D)"
            >
              Đứng
            </button>
            <button
              className={`btn sm ${Math.abs(currentRot[0] - -90) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => setOrientation('ground')}
              title="Nằm ngang làm mặt đất / sàn (xoay X -90°)"
            >
              Mặt đất
            </button>
            <button
              className={`btn sm ${Math.abs(currentRot[0] - -75) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
              onClick={() => setOrientation('tilted')}
              title="Nghiêng 75° tạo độ dốc xa dần vào chiều sâu"
            >
              Nghiêng
            </button>
            <button
              className={`btn sm ${Math.abs(currentRot[0] - 90) < 1 ? 'primary' : 'ghost'}`}
              style={{ flex: 1, padding: '3px 4px', fontSize: '11px' }}
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

      <MotionSection layer={layer} set={set} />

      <KeyEaseSection match={(r) => r.kind === 'layer' && r.layerId === id} />

      {layer.type === 'image' && <ImageSection layer={layer} set={set} />}
      {layer.type === 'text' && <TextSection props={layer.props} set={set} />}
      {layer.type === 'solid' && <SolidSection props={layer.props} set={set} />}
      {layer.type === 'particles' && <ParticleSection props={layer.props} set={set} />}
    </>
  )
}

type Setter = (fn: (l: Layer) => void, mergeKey?: string) => void

function ImageSection({ layer, set }: { layer: Layer & { type: 'image' }; set: Setter }) {
  const comp = useEditor((s) => s.project.comp)
  const time = useEditor((s) => s.time)
  const tol = useEditor((s) => frameTolerance(s.project))
  const asset = assetStore.get(layer.props.assetId)
  const setScale = (k: number): void =>
    set((l) => setValueAt(l.transform.scale, time, [k, k, 1] as Vec3, tol))
  return (
    <div className="section">
      <div className="section-title">Ảnh</div>
      <Row label="Nguồn">
        <span className="hint-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {asset?.meta.name ?? '—'} · {layer.props.width}×{layer.props.height}
        </span>
      </Row>
      <Row label="Kích thước">
        <button className="btn sm" onClick={() => setScale(Math.max(comp.width / layer.props.width, comp.height / layer.props.height))}>
          Phủ khung
        </button>
        <button className="btn sm" onClick={() => setScale(Math.min(comp.width / layer.props.width, comp.height / layer.props.height))}>
          Vừa khung
        </button>
        <button className="btn sm" onClick={() => setScale(1)}>
          100%
        </button>
      </Row>
      <Row label="Lặp texture" title="Lặp lại ảnh theo chiều rộng (X) và chiều sâu (Y) khi làm mặt đất/sàn">
        <NumberInput
          axis="x"
          value={layer.props.repeat?.[0] ?? 1}
          min={1}
          max={64}
          step={1}
          precision={0}
          onChange={(v) =>
            set((l) => {
              if (l.type === 'image') {
                const rep = l.props.repeat ? [...l.props.repeat] : [1, 1]
                rep[0] = v
                l.props.repeat = rep as [number, number]
              }
            })
          }
        />
        <NumberInput
          axis="y"
          value={layer.props.repeat?.[1] ?? 1}
          min={1}
          max={64}
          step={1}
          precision={0}
          onChange={(v) =>
            set((l) => {
              if (l.type === 'image') {
                const rep = l.props.repeat ? [...l.props.repeat] : [1, 1]
                rep[1] = v
                l.props.repeat = rep as [number, number]
              }
            })
          }
        />
      </Row>
    </div>
  )
}

function TextSection({ props, set }: { props: TextProps; set: Setter }) {
  const p = (fn: (tp: TextProps) => void, key?: string): void =>
    set((l) => {
      if (l.type === 'text') fn(l.props)
    }, key)
  return (
    <div className="section">
      <div className="section-title">Text</div>
      <TextInput id="text-content" multiline value={props.text} onCommit={(v) => p((t) => void (t.text = v), 'text')} />
      <div style={{ height: 6 }} />
      <Row label="Font">
        <select className="select" value={props.fontFamily} onChange={(e) => p((t) => void (t.fontFamily = e.target.value))}>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Cỡ / Độ đậm">
        <NumberInput axis="px" value={props.fontSize} min={6} max={600} step={1} precision={0} onChange={(v, k) => p((t) => void (t.fontSize = v), k)} />
        <select className="select" value={props.fontWeight} onChange={(e) => p((t) => void (t.fontWeight = Number(e.target.value)))}>
          {[400, 500, 600, 700, 800].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Giãn chữ">
        <NumberInput axis="↔" value={props.letterSpacing} min={-20} max={100} step={0.5} precision={1} onChange={(v, k) => p((t) => void (t.letterSpacing = v), k)} />
      </Row>
      <Row label="Màu">
        <ColorInput value={props.color} onChange={(v, k) => p((t) => void (t.color = v), k)} />
      </Row>
      <Row label="Đổ bóng">
        <Switch on={props.shadow} onChange={(v) => p((t) => void (t.shadow = v))} />
      </Row>
    </div>
  )
}

function SolidSection({ props, set }: { props: SolidProps; set: Setter }) {
  const p = (fn: (sp: SolidProps) => void, key?: string): void =>
    set((l) => {
      if (l.type === 'solid') fn(l.props)
    }, key)
  return (
    <div className="section">
      <div className="section-title">Solid / Gradient</div>
      <Row label="Màu trên">
        <ColorInput value={props.color} onChange={(v, k) => p((s) => void (s.color = v), k)} />
      </Row>
      <Row label="Gradient">
        <Switch on={props.gradient} onChange={(v) => p((s) => void (s.gradient = v))} />
      </Row>
      {props.gradient && (
        <Row label="Màu dưới">
          <ColorInput value={props.color2} onChange={(v, k) => p((s) => void (s.color2 = v), k)} />
        </Row>
      )}
      <Row label="Hoạ tiết / Lưới" title="Thêm lưới toạ độ hoặc sọc để nhìn rõ phối cảnh chiều sâu mặt đất">
        <select
          className="select"
          value={props.pattern ?? 'none'}
          onChange={(e) => p((s) => void (s.pattern = e.target.value as any))}
        >
          <option value="none">Trơn / Gradient</option>
          <option value="grid">Lưới phối cảnh 3D (Grid)</option>
          <option value="stripes">Sọc chiều sâu</option>
          <option value="dots">Chấm toạ độ</option>
        </select>
      </Row>
      {props.pattern && props.pattern !== 'none' && (
        <Row label="Cỡ lưới">
          <NumberInput
            axis="px"
            value={props.gridSize ?? 40}
            min={16}
            max={200}
            step={5}
            precision={0}
            onChange={(v, k) => p((s) => void (s.gridSize = v), k)}
          />
        </Row>
      )}
      <Row label="Rộng / Cao">
        <NumberInput axis="w" value={props.width} min={1} step={2} precision={0} onChange={(v, k) => p((s) => void (s.width = v), k)} />
        <NumberInput axis="h" value={props.height} min={1} step={2} precision={0} onChange={(v, k) => p((s) => void (s.height = v), k)} />
      </Row>
    </div>
  )
}

function MotionSection({ layer, set }: { layer: Layer; set: Setter }) {
  const motion = layer.motion ?? { type: 'none' }
  const setMotion = (patch: Partial<LayerMotion>): void => {
    set((l) => {
      l.motion = { ...(l.motion ?? { type: 'none' }), ...patch }
    }, 'motion')
  }

  const setAmp = (axisIdx: number, val: number, mergeKey: string): void => {
    set((l) => {
      const cur = [...(l.motion?.amplitude ?? [20, 0, 0])] as Vec3
      cur[axisIdx] = val
      l.motion = { ...(l.motion ?? { type: 'drift' }), amplitude: cur }
    }, mergeKey)
  }

  return (
    <div className="section">
      <div className="section-title">Chuyển động (Motion &amp; Loop)</div>
      <Row label="Loại" title="Tự động di chuyển lặp lại hoặc đung đưa trong không gian 3D">
        <select
          id="motion-type"
          className="select"
          value={motion.type ?? 'none'}
          onChange={(e) => {
            const t = e.target.value as LayerMotionType
            if (t === 'none') {
              setMotion({ type: 'none' })
            } else if (t === 'drift') {
              setMotion({
                type: 'drift',
                speed: motion.speed ?? 40,
                loopWidth: motion.loopWidth ?? 3000,
                amplitude: motion.amplitude ?? [1500, 12, 0]
              })
            } else if (t === 'wind' || t === 'sway') {
              setMotion({
                type: t,
                speed: motion.speed ?? 0.6,
                amplitude: motion.amplitude ?? [8, 2, 1.2]
              })
            } else if (t === 'float') {
              setMotion({
                type: 'float',
                speed: motion.speed ?? 0.4,
                amplitude: motion.amplitude ?? [4, 15, 0]
              })
            } else if (t === 'wiggle') {
              setMotion({
                type: 'wiggle',
                speed: motion.speed ?? 1.5,
                amplitude: motion.amplitude ?? [15, 15, 0]
              })
            } else if (t === 'pulse') {
              setMotion({
                type: 'pulse',
                speed: motion.speed ?? 0.5,
                amplitude: motion.amplitude ?? [0.05, 0.05, 0]
              })
            }
          }}
        >
          <option value="none">Không có (Đứng yên)</option>
          <option value="drift">Trôi theo hướng &amp; lặp mượt (Sương mù / Mưa / Mây)</option>
          <option value="wind">Gió lay động (Cây cối / Lá / Cành)</option>
          <option value="sway">Lắc lư nhẹ (Nhịp điệu)</option>
          <option value="float">Nổi bồng bềnh (Nước / Đảo bay)</option>
          <option value="wiggle">Rung rinh hữu cơ (After Effects Wiggle)</option>
          <option value="pulse">Nhịp thở nhẹ (Co giãn)</option>
        </select>
      </Row>

      {motion.type && motion.type !== 'none' && (
        <>
          {motion.type === 'drift' && (
            <>
              <Row label="Hướng trôi" title="Chọn hướng di chuyển (trái, phải, lên, xuống, chéo)">
                <select
                  id="motion-direction"
                  className="select"
                  value={typeof motion.direction === 'string' ? motion.direction : Math.round(parseDirectionAngle(motion.direction))}
                  onChange={(e) => {
                    const val = e.target.value
                    const num = Number(val)
                    setMotion({ direction: isNaN(num) ? (val as DriftDirection) : num })
                  }}
                >
                  <option value="right">➡️ Sang phải (0°)</option>
                  <option value="up-right">↗️ Chéo lên - phải (45°)</option>
                  <option value="up">⬆️ Lên trên (90°)</option>
                  <option value="up-left">↖️ Chéo lên - trái (135°)</option>
                  <option value="left">⬅️ Sang trái (180°)</option>
                  <option value="down-left">↙️ Chéo xuống - trái (225° - Mưa xiên)</option>
                  <option value="down">⬇️ Xuống dưới (270° - Mưa rơi)</option>
                  <option value="down-right">↘️ Chéo xuống - phải (315°)</option>
                </select>
              </Row>

              <Row label="Góc chéo (°)" title="Góc hướng trôi tùy ý theo độ (0° - 360°)">
                <NumberInput
                  axis="deg"
                  value={Math.round(parseDirectionAngle(motion.direction))}
                  min={0}
                  max={360}
                  step={5}
                  precision={0}
                  onChange={(v) => setMotion({ direction: v })}
                />
              </Row>

              <Row label="Kiểu lặp" title="Phương thức lặp: Cuộn pixel vô hạn (cửa ra nối cửa vào như After Effects Offset), Ping-pong hoặc Trôi liên tục">
                <select
                  id="motion-loop-mode"
                  className="select"
                  value={motion.loopMode === 'ping-pong' ? 'ping-pong' : motion.loopMode === 'continuous' ? 'continuous' : 'uv'}
                  onChange={(e) => setMotion({ loopMode: e.target.value as DriftLoopMode })}
                >
                  <option value="uv">🌀 Cuộn vô hạn cửa ra - vào (Pixel Wrap / AE Offset)</option>
                  <option value="ping-pong">🌊 Lượn qua lại êm ái (Ping-Pong)</option>
                  <option value="continuous">➡️ Trôi liên tục một chiều (Continuous)</option>
                </select>
              </Row>
            </>
          )}

          <Row label="Tốc độ" title="Tốc độ trôi (px/s) hoặc chu kỳ nhịp (Hz)">
            <NumberInput
              axis="spd"
              value={motion.speed ?? (motion.type === 'drift' ? 40 : 0.6)}
              step={motion.type === 'drift' ? 2 : 0.05}
              precision={motion.type === 'drift' ? 0 : 2}
              onChange={(v, k) => setMotion({ speed: v })}
            />
          </Row>

          <Row label="Biên độ" title="Độ dịch chuyển (X, Y) và góc nghiêng (Z)">
            {[0, 1, 2].map((i) => (
              <NumberInput
                key={i}
                axis={'xyz'[i]}
                value={motion.amplitude?.[i] ?? 0}
                step={motion.type === 'pulse' ? 0.01 : 1}
                precision={motion.type === 'pulse' ? 2 : 1}
                onChange={(v, k) => setAmp(i, v, k)}
              />
            ))}
          </Row>

          {motion.type === 'drift' && motion.loopMode === 'ping-pong' && (
            <Row label="Độ rộng loop" title="Khoảng cách trôi qua trước khi đảo chiều (px)">
              <NumberInput
                axis="px"
                value={motion.loopWidth ?? 3000}
                min={200}
                step={100}
                precision={0}
                onChange={(v, k) => setMotion({ loopWidth: v })}
              />
            </Row>
          )}

          <Row label="Lệch pha" title="Lệch pha giúp các layer không chuyển động đồng thời">
            <NumberInput
              axis="φ"
              value={motion.phase ?? 0}
              step={0.5}
              precision={1}
              onChange={(v, k) => setMotion({ phase: v })}
            />
          </Row>
        </>
      )}
    </div>
  )
}

function ParticleSection({ props, set }: { props: ParticleProps; set: Setter }) {
  const p = (fn: (pp: ParticleProps) => void, key?: string): void =>
    set((l) => {
      if (l.type === 'particles') fn(l.props)
    }, key)
  const vec = (field: 'velocity' | 'area', i: number, v: number, k: string): void =>
    p((pp) => {
      const next = [...pp[field]] as Vec3
      next[i] = v
      pp[field] = next
    }, k)
  return (
    <div className="section">
      <div className="section-title">
        Particles <span className="spacer" />
        <button className="btn sm" title="Đổi seed ngẫu nhiên" onClick={() => p((pp) => void (pp.seed = Math.floor(Math.random() * 1e6)))}>
          <IconWand /> Seed
        </button>
      </div>
      <Row label="Mẫu hạt" title="Chọn nhanh các hiệu ứng hạt và thời tiết">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, width: '100%' }}>
          {Object.entries(PARTICLE_PRESETS).map(([key, item]) => (
            <button
              key={key}
              className="btn sm ghost"
              style={{ padding: '3px 4px', fontSize: '10px' }}
              onClick={() => p((pp) => Object.assign(pp, item.props))}
              title={item.hint}
            >
              {item.label.split(' / ')[0]}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Số lượng">
        <NumberInput axis="#" value={props.count} min={1} max={20000} step={5} precision={0} onChange={(v, k) => p((pp) => void (pp.count = Math.round(v)), k)} />
      </Row>
      <Row label="Kích thước">
        <NumberInput axis="px" value={props.size} min={0.5} max={200} step={0.1} precision={1} onChange={(v, k) => p((pp) => void (pp.size = v), k)} />
      </Row>
      <Row label="Màu">
        <ColorInput value={props.color} onChange={(v, k) => p((pp) => void (pp.color = v), k)} />
      </Row>
      <Row label="Vận tốc">
        {[0, 1, 2].map((i) => (
          <NumberInput key={i} axis={'xyz'[i]} value={props.velocity[i]} step={0.5} precision={0} onChange={(v, k) => vec('velocity', i, v, k)} />
        ))}
      </Row>
      <Row label="Vùng phát">
        {[0, 1, 2].map((i) => (
          <NumberInput key={i} axis={'xyz'[i]} value={props.area[i]} min={10} step={5} precision={0} onChange={(v, k) => vec('area', i, v, k)} />
        ))}
      </Row>
      <Row label="Lắc lư">
        <NumberInput axis="~" value={props.sway} min={0} max={1000} step={0.5} precision={0} onChange={(v, k) => p((pp) => void (pp.sway = v), k)} />
      </Row>
      <Row label="Nhấp nháy">
        <Switch on={props.twinkle} onChange={(v) => p((pp) => void (pp.twinkle = v))} />
      </Row>
      <Row label="Phát sáng">
        <Switch on={props.glow} onChange={(v) => p((pp) => void (pp.glow = v))} />
      </Row>
    </div>
  )
}

// ------------------------------------------------------------------ camera

function CameraInspector() {
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  const time = useEditor((s) => s.time)
  const selectedLayer = useEditor((s) => findLayer(s.project, s.selectedLayerId))
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const [intensity, setIntensity] = useState(1)
  const cam = project.camera
  const tol = frameTolerance(project)
  // Presets & reset act on the selected shot, else on the shot the camera currently looks at.
  const targetShot = findShot(project, selectedShotId) ?? findShot(project, shotAtTime(project, time))

  const focusOnSelected = (): void => {
    if (!selectedLayer) return
    const ev = evaluateScene(project, time)
    const lp = ev.layers.find((l) => l.layer.id === selectedLayer.id)?.worldPosition
    if (!lp) return
    const cp = ev.camera.position
    const dist = Math.round(Math.hypot(lp[0] - cp[0], lp[1] - cp[1], lp[2] - cp[2]))
    update((d) => {
      d.camera.dofEnabled = true
      if (d.camera.focusDistance.keyframes.length) addKeyframe(d.camera.focusDistance, time, dist)
      else d.camera.focusDistance.value = dist
    })
  }

  return (
    <>
      <div className="section">
        <div className="section-title">
          <IconCamera width={13} height={13} /> Chuyển động camera (preset)
          {targetShot && (
            <>
              <span className="spacer" />
              <span className="shot-chip" style={{ ['--c' as string]: targetShot.color }} title="Preset sẽ áp dụng quanh cảnh này">
                {targetShot.name}
              </span>
            </>
          )}
        </div>
        <div className="preset-grid">
          {CAMERA_PRESETS.map((p) => (
            <button
              key={p.id}
              id={`preset-${p.id}`}
              className="preset"
              onClick={() =>
                update((d) =>
                  applyCameraPreset(d.camera, p.id, d.comp, 0, d.comp.duration, intensity, shotLocalToWorld(targetShot, 0))
                )
              }
            >
              <b>{p.label}</b>
              <span>{p.hint}</span>
            </button>
          ))}
        </div>
        <div style={{ height: 8 }} />
        <Row label="Cường độ">
          <Slider value={intensity} min={0.2} max={3} step={0.05} onChange={(v) => setIntensity(v)} format={(v) => `${v.toFixed(2)}×`} />
        </Row>
        <p className="hint-text" style={{ margin: '6px 0 0' }}>
          Preset thay thế keyframe camera hiện có và trải dài toàn bộ thời lượng.
          {project.shots.length > 1 && ' Để bay qua nhiều cảnh, dùng “Lộ trình camera” trong tab Cảnh.'}
        </p>
      </div>

      <div className="section">
        <div className="section-title">Camera</div>
        <AnimRow label="Vị trí" refp={{ kind: 'camera', prop: 'position' }} kind="vec3" step={1} precision={0} />
        <AnimRow label="Điểm nhìn" refp={{ kind: 'camera', prop: 'target' }} kind="vec3" step={1} precision={0} />
        <AnimRow label="FOV (°)" refp={{ kind: 'camera', prop: 'fov' }} kind="number" step={0.1} precision={1} min={5} max={120} />
        <AnimRow label="Fade đen %" refp={{ kind: 'camera', prop: 'fade' }} kind="number" step={0.5} precision={0} displayScale={100} min={0} max={100} />
      </div>

      <KeyEaseSection match={(r) => r.kind === 'camera'} />

      <div className="section">
        <div className="section-title">
          Độ sâu trường ảnh (DOF) <span className="spacer" />
          <Switch id="dof-toggle" on={cam.dofEnabled} onChange={(v) => update((d) => void (d.camera.dofEnabled = v))} />
        </div>
        <AnimRow label="Khoảng focus" refp={{ kind: 'camera', prop: 'focusDistance' }} kind="number" step={2} precision={0} min={1} />
        <AnimRow label="Khẩu độ" refp={{ kind: 'camera', prop: 'aperture' }} kind="number" step={0.01} precision={2} min={0} max={10} />
        <div style={{ height: 6 }} />
        <button className="btn sm" disabled={!selectedLayer} onClick={focusOnSelected} title="Đặt focus vào layer đang chọn">
          Focus vào layer đang chọn
        </button>
      </div>

      <div className="section">
        <div className="section-title">Rung tay (handheld)</div>
        <Row label="Biên độ">
          <Slider value={cam.shakeAmount} min={0} max={40} step={0.5} format={(v) => v.toFixed(1)} onChange={(v, k) => update((d) => void (d.camera.shakeAmount = v), k)} />
        </Row>
        <Row label="Tốc độ">
          <Slider value={cam.shakeSpeed} min={0.05} max={3} step={0.05} format={(v) => v.toFixed(2)} onChange={(v, k) => update((d) => void (d.camera.shakeSpeed = v), k)} />
        </Row>
      </div>

      <div className="section">
        <button
          className="btn sm"
          onClick={() =>
            update((d) => {
              const dd = referenceDistance(d.comp)
              const pose = targetShot ? shotFramingPose(d as typeof project, targetShot, time) : { position: [0, 0, -dd] as Vec3, target: [0, 0, 0] as Vec3 }
              setValueAt(d.camera.position, time, pose.position, tol)
              setValueAt(d.camera.target, time, pose.target, tol)
            })
          }
        >
          {targetShot ? `Đưa camera về khung mặc định của “${targetShot.name}”` : 'Đưa camera về vị trí mặc định'}
        </button>
      </div>
    </>
  )
}

// ------------------------------------------------------------------ scene

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '1920×1080 · 16:9', w: 1920, h: 1080 },
  { label: '1080×1920 · 9:16 (Reels/TikTok)', w: 1080, h: 1920 },
  { label: '1080×1080 · 1:1', w: 1080, h: 1080 },
  { label: '1080×1350 · 4:5', w: 1080, h: 1350 },
  { label: '2560×1440 · QHD', w: 2560, h: 1440 },
  { label: '3840×2160 · 4K', w: 3840, h: 2160 }
]

function SceneInspector() {
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  const { comp, look, audio } = project
  const audioAsset = audio ? assetStore.get(audio.assetId) : undefined
  const sizeKey = `${comp.width}x${comp.height}`

  return (
    <>
      <div className="section">
        <div className="section-title">Composition</div>
        <Row label="Tên">
          <TextInput value={comp.name} onCommit={(v) => update((d) => void (d.comp.name = v), 'compname')} />
        </Row>
        <Row label="Khung hình">
          <select
            id="comp-size"
            className="select"
            value={SIZE_PRESETS.some((p) => `${p.w}x${p.h}` === sizeKey) ? sizeKey : 'custom'}
            onChange={(e) => {
              const p = SIZE_PRESETS.find((x) => `${x.w}x${x.h}` === e.target.value)
              if (p)
                update((d) => {
                  d.comp.width = p.w
                  d.comp.height = p.h
                })
            }}
          >
            {SIZE_PRESETS.map((p) => (
              <option key={p.label} value={`${p.w}x${p.h}`}>
                {p.label}
              </option>
            ))}
            <option value="custom">Tuỳ chỉnh</option>
          </select>
        </Row>
        <Row label="Rộng / Cao">
          <NumberInput axis="w" value={comp.width} min={16} max={7680} step={2} precision={0} onChange={(v, k) => update((d) => void (d.comp.width = Math.round(v / 2) * 2), k)} />
          <NumberInput axis="h" value={comp.height} min={16} max={4320} step={2} precision={0} onChange={(v, k) => update((d) => void (d.comp.height = Math.round(v / 2) * 2), k)} />
        </Row>
        <Row label="FPS">
          <select id="comp-fps" className="select" value={comp.fps} onChange={(e) => update((d) => void (d.comp.fps = Number(e.target.value)))}>
            {[24, 25, 30, 50, 60].map((f) => (
              <option key={f} value={f}>
                {f} fps
              </option>
            ))}
          </select>
        </Row>
        <Row label="Thời lượng (s)">
          <NumberInput
            axis="t"
            value={comp.duration}
            min={0.5}
            max={600}
            step={0.1}
            precision={2}
            onChange={(v, k) =>
              update((d) => {
                const old = d.comp.duration
                d.comp.duration = v
                d.layers.forEach((l) => {
                  if (Math.abs(l.outPoint - old) < 1e-3 || l.outPoint > v) l.outPoint = v
                  l.inPoint = Math.min(l.inPoint, v)
                })
              }, k)
            }
          />
        </Row>
        <Row label="Màu nền">
          <ColorInput value={comp.background} onChange={(v, k) => update((d) => void (d.comp.background = v), k)} />
        </Row>
      </div>

      <div className="section">
        <div className="section-title">
          Sương mù (fog) <span className="spacer" />
          <Switch id="fog-toggle" on={look.fogEnabled} onChange={(v) => update((d) => void (d.look.fogEnabled = v))} />
        </div>
        <Row label="Màu">
          <ColorInput value={look.fogColor} onChange={(v, k) => update((d) => void (d.look.fogColor = v), k)} />
        </Row>
        <Row label="Gần / Xa">
          <NumberInput axis="n" value={look.fogNear} min={0} step={10} precision={0} onChange={(v, k) => update((d) => void (d.look.fogNear = v), k)} />
          <NumberInput axis="f" value={look.fogFar} min={1} step={10} precision={0} onChange={(v, k) => update((d) => void (d.look.fogFar = v), k)} />
        </Row>
      </div>

      <div className="section">
        <div className="section-title">Màu sắc & hiệu ứng ống kính</div>
        <Row label="Phơi sáng">
          <Slider value={look.exposure} min={-2} max={2} step={0.05} onChange={(v, k) => update((d) => void (d.look.exposure = v), k)} />
        </Row>
        <Row label="Tương phản">
          <Slider value={look.contrast} min={0.5} max={1.8} onChange={(v, k) => update((d) => void (d.look.contrast = v), k)} />
        </Row>
        <Row label="Bão hoà">
          <Slider value={look.saturation} min={0} max={2} onChange={(v, k) => update((d) => void (d.look.saturation = v), k)} />
        </Row>
        <Row label="Vignette">
          <Slider value={look.vignette} min={0} max={1} onChange={(v, k) => update((d) => void (d.look.vignette = v), k)} />
        </Row>
        <Row label="Film grain">
          <Slider value={look.grain} min={0} max={0.4} step={0.005} onChange={(v, k) => update((d) => void (d.look.grain = v), k)} />
        </Row>
      </div>

      <div className="section">
        <div className="section-title">
          <IconMusic width={13} height={13} /> Nhạc nền
        </div>
        {audio ? (
          <>
            <Row label="File">
              <span className="hint-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {audioAsset?.meta.name} · {audioAsset?.meta.duration?.toFixed(1)}s
              </span>
              <button className="btn sm icon danger" title="Bỏ nhạc nền" onClick={() => update((d) => void (d.audio = null))}>
                <IconTrash />
              </button>
            </Row>
            <Row label="Bắt đầu lúc (s)">
              <NumberInput axis="t" value={audio.offset} step={0.01} precision={2} onChange={(v, k) => update((d) => void (d.audio && (d.audio.offset = v)), k)} />
            </Row>
            <Row label="Âm lượng">
              <Slider value={audio.volume} min={0} max={1} onChange={(v, k) => update((d) => void (d.audio && (d.audio.volume = v)), k)} format={(v) => `${Math.round(v * 100)}%`} />
            </Row>
          </>
        ) : (
          <button className="btn sm" onClick={importAudio}>
            <IconMusic /> Thêm nhạc nền…
          </button>
        )}
      </div>
    </>
  )
}
