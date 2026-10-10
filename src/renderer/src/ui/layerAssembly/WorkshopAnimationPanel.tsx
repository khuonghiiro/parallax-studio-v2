import type { BoneKeyframe } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { RigNumber, type RigPanelProps } from './WorkshopRigPanel'
import { emptyRig } from './workshopRig'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { ProceduralMotionPreset } from './workshopRigPresets'
import { Select } from '../controls'

export function WorkshopAnimationPanel({
  composite,
  boneId,
  selectBone,
  run,
  playback
}: RigPanelProps & {
  playback: ReturnType<typeof useWorkshopPlayback>
}) {
  const rig = composite.rig ?? emptyRig()
  const bones = rig.bones
  const bone = bones.find((b) => b.id === boneId)
  const time = Math.min(rig.duration, playback.time)
  const keys = bone ? (rig.tracks[bone.id] ?? []) : []
  const exact = keys.find((k) => Math.abs(k.time - time) < 0.0001)
  const pose = bone ? sampleBonePose({ ...rig, loop: false }, bone.id, time) : { x: 0, y: 0, rotation: 0 }
  const key: BoneKeyframe = { ...pose, time, easing: exact?.easing ?? 'smooth' }

  const setKey = (patch: Partial<BoneKeyframe> = {}) => {
    if (!bone) return
    playback.setIsPlaying(false)
    run({ action: 'set-key', boneId: bone.id, key: { ...key, ...patch } })
  }

  const applyPreset = (preset: ProceduralMotionPreset) => {
    playback.setIsPlaying(false)
    playback.setTime(0)
    run({ action: 'apply-preset-animation', preset })
  }

  return (
    <div className="lw-rig-panel">
      <h3>Animation chuyển động 2D</h3>
      <p>Áp dụng chuyển động mẫu tự động hoặc tự xoay xương trên khung 2D (Pose Mode) để tạo dáng nhân vật.</p>

      <div className="lw-rig-presets-title">Tạo chuyển động tự động</div>
      <div className="lw-rig-presets-row">
        <button className="lw-preset-btn" onClick={() => applyPreset('walk')} title="Tạo chuyển động bước đi chu kỳ lặp">
          🚶 Bước đi (Walk)
        </button>
        <button className="lw-preset-btn" onClick={() => applyPreset('idle')} title="Tạo nhịp thở đứng tự nhiên">
          🌬️ Đứng thở (Idle)
        </button>
        <button className="lw-preset-btn" onClick={() => applyPreset('wave')} title="Động tác vẫy tay chào">
          👋 Vẫy tay (Wave)
        </button>
        <button className="lw-preset-btn" onClick={() => applyPreset('sway')} title="Uốn lượn cây cối, cành lá, đuôi thú">
          🌊 Uốn lượn (Sway)
        </button>
      </div>

      <div className="lw-rig-actions">
        <button className="btn sm primary" onClick={playback.toggle}>
          {playback.isPlaying ? '❚❚ Tạm dừng' : '▶ Phát thử'}
        </button>
        <button
          className="btn sm"
          onClick={() => {
            playback.setIsPlaying(false)
            playback.setTime(0)
          }}
        >
          Về đầu (0s)
        </button>
        <button className="btn sm" onClick={() => run({ action: 'clear-animation' })} title="Xóa toàn bộ keyframe của mọi xương">
          Xóa hết key
        </button>
      </div>

      <div className="lw-rig-grid">
        <RigNumber
          label="Thời lượng (s)"
          value={rig.duration}
          min={0.1}
          max={120}
          step={0.1}
          onChange={(duration) => run({ action: 'settings', duration })}
        />
        <RigNumber
          label="Thời gian (s)"
          value={time}
          min={0}
          max={rig.duration}
          step={0.05}
          onChange={(t) => {
            playback.setIsPlaying(false)
            playback.setTime(t)
          }}
        />
      </div>

      <input
        className="lw-rig-timeline"
        aria-label="Timeline animation"
        type="range"
        min={0}
        max={rig.duration}
        step={0.01}
        value={time}
        onChange={(e) => {
          playback.setIsPlaying(false)
          playback.setTime(Number(e.target.value))
        }}
      />

      <label className="lw-rig-check">
        <input
          type="checkbox"
          checked={rig.loop}
          onChange={(e) => run({ action: 'settings', loop: e.target.checked })}
        />{' '}
        Lặp chu kỳ chuyển động
      </label>

      <h3>Tạo dáng xương (Pose Mode)</h3>
      <div className="lw-rig-field">
        <span>Xương chọn</span>
        <Select
          size="sm"
          value={boneId ?? ''}
          options={[
            { value: '', label: '-- Chọn xương --' },
            ...bones.map((b) => ({ value: b.id, label: b.name }))
          ]}
          onChange={(val) => selectBone(String(val) || null)}
        />
      </div>

      {bone ? (
        <>
          <p style={{ margin: '4px 0 8px' }}>Mẹo: Kéo trực tiếp xương trên màn hình 2D để xoay khớp trực quan!</p>
          <div className="lw-rig-grid">
            <RigNumber label="Góc xoay °" value={pose.rotation} onChange={(rotation) => setKey({ rotation })} />
            <RigNumber label="Dời X" value={pose.x} onChange={(x) => setKey({ x })} />
            <RigNumber label="Dời Y" value={pose.y} onChange={(y) => setKey({ y })} />
          </div>

          <div className="lw-rig-field">
            <span>Nội suy</span>
            <Select
              size="sm"
              value={key.easing}
              options={[
                { value: 'smooth', label: 'Mượt mà (Smooth Bezier)' },
                { value: 'linear', label: 'Tuyến tính (Linear)' },
                { value: 'hold', label: 'Giữ nguyên tư thế (Hold)' }
              ]}
              onChange={(val) => setKey({ easing: val as BoneKeyframe['easing'] })}
            />
          </div>

          <div className="lw-rig-actions">
            <button className="btn sm primary" onClick={() => setKey()}>
              ◆ Ghi tư thế tại {time.toFixed(2)}s
            </button>
            <button className="btn sm" onClick={() => setKey({ x: 0, y: 0, rotation: 0 })}>
              Tư thế gốc (0°)
            </button>
          </div>

          <div className="lw-key-list" aria-label="Keyframe của xương">
            {keys.map((k) => (
              <div key={k.time}>
                <button
                  className={`btn xs ${k === exact ? 'active' : ''}`}
                  onClick={() => {
                    playback.setIsPlaying(false)
                    playback.setTime(k.time)
                  }}
                >
                  ◆ {k.time.toFixed(2)}s · {k.rotation}° ({k.easing})
                </button>
                <button
                  className="btn xs"
                  aria-label={`Xóa keyframe ${k.time}s`}
                  onClick={() => run({ action: 'delete-key', boneId: bone.id, time: k.time })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {!keys.length && (
            <p style={{ margin: '6px 0' }}>Chưa có keyframe nào cho xương này. Bấm Ghi tư thế để lưu mốc.</p>
          )}
        </>
      ) : (
        <p>Chọn một xương ở danh sách trên hoặc click trực tiếp vào xương trên khung 2D để tạo dáng.</p>
      )}
    </div>
  )
}
