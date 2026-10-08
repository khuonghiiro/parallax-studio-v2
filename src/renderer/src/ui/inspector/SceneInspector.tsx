import { duplicateAudioTrack, importAudio, removeAudioTrack } from '../../actions'
import { assetStore } from '../../project/assets'
import { getProjectAudioTracks, syncProjectAudio } from '../../project/audioTracks'
import { useEditor } from '../../store/editor'
import { ColorInput, NumberInput, Row, Select, Slider, Switch, TextInput } from '../controls'
import { IconCopy, IconMusic, IconPlus, IconTrash } from '../icons'
import { SIZE_PRESETS } from './types'

export function SceneInspector() {
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  const { comp, look } = project
  const tracks = getProjectAudioTracks(project)
  const sizeKey = `${comp.width}x${comp.height}`

  const sizeOptions = [
    ...SIZE_PRESETS.map((p) => ({
      value: `${p.w}x${p.h}`,
      label: p.label
    })),
    { value: 'custom', label: 'Tuỳ chỉnh' }
  ]

  const fpsOptions = [24, 25, 30, 50, 60].map((f) => ({
    value: f,
    label: `${f} fps`
  }))

  return (
    <>
      <div className="section">
        <div className="section-title">Composition</div>
        <Row label="Tên">
          <TextInput value={comp.name} onCommit={(v) => update((d) => void (d.comp.name = v), 'compname')} />
        </Row>
        <Row label="Khung hình">
          <Select
            id="comp-size"
            value={SIZE_PRESETS.some((p) => `${p.w}x${p.h}` === sizeKey) ? sizeKey : 'custom'}
            options={sizeOptions}
            onChange={(val) => {
              const p = SIZE_PRESETS.find((x) => `${x.w}x${x.h}` === val)
              if (p)
                update((d) => {
                  d.comp.width = p.w
                  d.comp.height = p.h
                })
            }}
          />
        </Row>
        <Row label="Rộng / Cao">
          <NumberInput axis="w" value={comp.width} min={16} max={7680} step={2} precision={0} onChange={(v, k) => update((d) => void (d.comp.width = Math.round(v / 2) * 2), k)} />
          <NumberInput axis="h" value={comp.height} min={16} max={4320} step={2} precision={0} onChange={(v, k) => update((d) => void (d.comp.height = Math.round(v / 2) * 2), k)} />
        </Row>
        <Row label="FPS">
          <Select
            id="comp-fps"
            value={comp.fps}
            options={fpsOptions}
            onChange={(val) => update((d) => void (d.comp.fps = Number(val)))}
          />
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
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconMusic width={13} height={13} /> Nhạc nền & Âm thanh
          </span>
          <button
            className="btn sm"
            style={{ padding: '2px 8px', fontSize: '11px', height: '22px' }}
            onClick={() => importAudio(useEditor.getState().time)}
            title="Nhập thêm file âm thanh từ máy tính tại vị trí kim phát"
          >
            <IconPlus width={11} height={11} /> Thêm nhạc
          </button>
        </div>
        {tracks.length > 0 ? (
          tracks.map((track, idx) => {
            const trackAsset = assetStore.get(track.assetId)
            return (
              <div
                key={track.id}
                style={{
                  border: '1px solid var(--line-soft)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px',
                  marginBottom: 8,
                  background: 'var(--bg-1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
                  <span className="hint-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontWeight: 600 }}>
                    {idx + 1}. {track.name || trackAsset?.meta.name}
                  </span>
                  <div style={{ display: 'inline-flex', gap: 2 }}>
                    <button
                      className="btn sm icon"
                      title="Nhân bản đoạn âm thanh này tại kim phát"
                      onClick={() => duplicateAudioTrack(track.id)}
                    >
                      <IconCopy width={11} height={11} />
                    </button>
                    <button
                      className="btn sm icon danger"
                      title="Xoá đoạn âm thanh này"
                      onClick={() => removeAudioTrack(track.id)}
                    >
                      <IconTrash width={11} height={11} />
                    </button>
                  </div>
                </div>
                <Row label="Bắt đầu (s)">
                  <NumberInput
                    axis="t"
                    value={track.offset}
                    step={0.01}
                    precision={2}
                    onChange={(v, k) =>
                      update((d) => {
                        const target = d.audioTracks?.find((t) => t.id === track.id)
                        if (target) target.offset = v
                        else if (d.audio && d.audio.id === track.id) d.audio.offset = v
                        syncProjectAudio(d as any)
                      }, k)
                    }
                  />
                </Row>
                <Row label="Âm lượng">
                  <Slider
                    value={track.volume}
                    min={0}
                    max={1}
                    onChange={(v, k) =>
                      update((d) => {
                        const target = d.audioTracks?.find((t) => t.id === track.id)
                        if (target) target.volume = v
                        else if (d.audio && d.audio.id === track.id) d.audio.volume = v
                        syncProjectAudio(d as any)
                      }, k)
                    }
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '8px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: '11px' }}>
            Chưa có đoạn âm thanh nào. Bấm <b>Thêm nhạc</b> để tải từ máy tính vào mốc thời gian hiện tại.
          </div>
        )}
      </div>
    </>
  )
}
