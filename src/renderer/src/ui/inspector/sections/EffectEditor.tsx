import type { AppliedLayerEffect, Layer } from '@shared/types'
import { effectMotion, migrateLayerMotion, updateMotionEffect } from '../../../animation/motionEffects'
import { retimeLayerEffect } from '../../../animation/effectTiming'
import { NumberInput, Row, TextInput } from '../../controls'
import { MotionEffectControls } from './MotionSection'
import type { Setter } from '../types'

export function EffectEditor({ layer, effect, set: update }: { layer: Layer; effect: AppliedLayerEffect; set: Setter }) {
  const motion = effectMotion(effect)
  const set: Setter = (change, key) => update((current) => { if (!current.locked) change(current) }, key)
  return <div className="effect-editor" data-effect-id={effect.id}>
    <Row label="Tên hiệu ứng"><TextInput value={effect.name} onCommit={(name) => set((l) => {
      migrateLayerMotion(l)
      const fx = l.appliedEffects?.find((f) => f.id === effect.id)
      if (fx) fx.name = name
    }, `effect-name-${effect.id}`)} /></Row>
    {motion ? <MotionEffectControls motion={motion} change={(patch, key) => set((l) => {
      updateMotionEffect(l, effect.id, patch)
    }, key && `${effect.id}-${key}`)} reset={() => set((l) => updateMotionEffect(l, effect.id, {}, true))} /> : <>
      <Row label="Bắt đầu"><NumberInput value={effect.startTime} min={0} step={0.1} suffix="s"
        onChange={(startTime, key) => set((l) => { retimeLayerEffect(l, effect.id, { startTime, duration: effect.duration }) }, key)} /></Row>
      <Row label="Thời lượng" title="Thay đổi thời lượng sẽ co giãn các keyframe thuộc hiệu ứng này">
        <NumberInput value={effect.duration} min={effect.targetProp ? 0.01 : 0} step={0.1} suffix="s"
          onChange={(duration, key) => set((l) => { retimeLayerEffect(l, effect.id, { startTime: effect.startTime, duration }) }, key)} />
      </Row>
      <p className="motion-note">{effect.category === 'glow' ? 'Chỉnh màu và ánh sáng trong bảng Viền Neon.' : 'Chỉnh giá trị từng keyframe trong các track Transform trên timeline.'}</p>
    </>}
    {layer.locked && <p className="motion-note">Layer đang khóa.</p>}
  </div>
}
