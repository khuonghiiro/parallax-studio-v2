import { useEffect, useRef } from 'react'
import type { Layer } from '@shared/types'
import { useEditor } from '../../../store/editor'
import { useEffectSelection } from '../../../store/effectSelection'
import { listLayerEffects } from '../../../animation/motionEffects'
import { IconPlay, IconSparkles, IconTrash } from '../../icons'
import { openFxPresetMenu } from '../../timeline/FxPresetMenu'
import { deleteLayerEffect, toggleLayerEffect } from '../../timeline/timelineEffects'
import { renderFxIcon } from '../../timeline/fxIcons'
import { EffectEditor } from './EffectEditor'
import type { Setter } from '../types'
import '../../../styles/effectStack.css'

export function LayerEffectsSection({ layer, set }: { layer: Layer; set: Setter }) {
  const editorRef = useRef<HTMLFieldSetElement>(null)
  const time = useEditor((s) => s.time)
  const selection = useEffectSelection()
  const effects = listLayerEffects(layer)
  const selected = effects.find((fx) => selection.layerId === layer.id && fx.id === selection.effectId)
  useEffect(() => { editorRef.current?.scrollIntoView({ block: 'nearest' }) }, [selected?.id])
  const add = (): void => {
    useEditor.getState().selectLayer(layer.id)
    openFxPresetMenu({ x: Math.max(16, window.innerWidth / 2 - 280), y: Math.max(16, window.innerHeight / 2 - 230),
      targetTime: time, layerName: layer.name, from: 'button' })
  }
  return <section className="section layer-effects-section">
    <div className="effect-stack-heading"><h3><IconSparkles width={13} height={13} /> Hiệu ứng hoạt ảnh ({effects.length})</h3>
      <button className="btn sm" onClick={add} disabled={layer.locked}>+ Thêm</button>
    </div>
    <p className="motion-note">Chọn hiệu ứng để chỉnh. Có thể kết hợp nhiều Motion trên cùng layer.</p>
    <div className="effect-stack-list">
      {effects.map((fx) => <div key={fx.id} className={`layer-fx-card${selected?.id === fx.id ? ' selected' : ''}${!fx.enabled ? ' is-disabled' : ''}`}>
        <button className="effect-card-select" onClick={() => selection.select(layer.id, fx.id)}
          aria-pressed={selected?.id === fx.id} title="Chỉnh hiệu ứng này">
          {renderFxIcon(fx.presetId, 14, 'var(--accent-cyan)')}
          <span><strong>{fx.name}</strong><small>{fx.startTime.toFixed(2)}s · {fx.duration ? `${fx.duration.toFixed(2)}s` : 'Đến hết layer'}</small></span>
        </button>
        <button className="mini" aria-label={`Đến ${fx.name}`} title="Đến mốc bắt đầu" onClick={() => useEditor.getState().setTime(fx.startTime)}><IconPlay width={11} /></button>
        <button className={`switch${fx.enabled ? ' on' : ''}`} aria-label={`Bật/tắt ${fx.name}`} aria-pressed={fx.enabled} disabled={layer.locked}
          onClick={() => set((l) => { toggleLayerEffect(l, fx.id, !fx.enabled) })} />
        <button className="mini" aria-label={`Xóa ${fx.name}`} title="Xóa hiệu ứng" disabled={layer.locked}
          onClick={() => set((l) => { deleteLayerEffect(l, fx.id) })}><IconTrash width={12} /></button>
      </div>)}
    </div>
    {!effects.length && <button className="btn sm effect-empty" onClick={add} disabled={layer.locked}>Thêm hiệu ứng đầu tiên</button>}
    {selected && <fieldset ref={editorRef} className="effect-editor-fieldset" disabled={layer.locked}>
      <EffectEditor key={selected.id} layer={layer} effect={selected} set={set} />
    </fieldset>}
    <LegacyEffectSummary layer={layer} set={set} />
  </section>
}

function LegacyEffectSummary({ layer, set }: { layer: Layer; set: Setter }) {
  const standaloneGlow = layer.glow && !layer.appliedEffects?.some((fx) => fx.category === 'glow')
  const owned = new Set(layer.appliedEffects?.flatMap((fx) => fx.keyframeIds ?? []))
  return <div className="effect-legacy-summary">
    {standaloneGlow && <div className="effect-legacy-row"><span>Viền Neon trực tiếp</span>
      <button className="btn sm" disabled={layer.locked} onClick={() => set((l) => { if (l.glow) l.glow.enabled = !l.glow.enabled })}>{layer.glow?.enabled ? 'Tắt' : 'Bật'}</button>
      <button className="mini" disabled={layer.locked} aria-label="Xóa Neon trực tiếp" onClick={() => set((l) => { delete l.glow })}><IconTrash width={12} /></button>
    </div>}
    {(['opacity', 'position', 'scale'] as const).map((prop) => {
      const manual = layer.transform[prop].keyframes.filter((k) => !owned.has(k.id))
      return manual.length > 0 ? <p className="motion-note" key={prop}>{manual.length} keyframe {prop} thủ công · chỉnh trên timeline</p> : null
    })}
  </div>
}
