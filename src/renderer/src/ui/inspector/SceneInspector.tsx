import { importAudio } from '../../actions'
import { assetStore } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { ColorInput, NumberInput, Row, Slider, Switch, TextInput } from '../controls'
import { IconMusic, IconTrash } from '../icons'
import { SIZE_PRESETS } from './types'

export function SceneInspector() {
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
