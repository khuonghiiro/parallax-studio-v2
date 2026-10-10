import { useState } from 'react'
import type { AnimationClip, BoneKeyframe, LayerBone } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { RigNumber, type RigPanelProps } from './WorkshopRigPanel'
import { emptyRig, ensureRigClips } from './workshopRig'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { Select } from '../controls'
import { WorkshopClipBar } from './WorkshopClipBar'
import { WorkshopRetargetDialog } from './WorkshopRetargetDialog'

export function WorkshopAnimationPanel({
  composite,
  boneId,
  selectBone,
  run,
  playback
}: RigPanelProps & {
  playback: ReturnType<typeof useWorkshopPlayback>
}) {
  const { rig, activeClip } = ensureRigClips(composite.rig ?? emptyRig())
  const bones = rig.bones
  const bone = bones.find((b) => b.id === boneId)
  const time = Math.min(rig.duration, playback.time)
  const keys = bone ? (rig.tracks[bone.id] ?? []) : []
  const exact = keys.find((k) => Math.abs(k.time - time) < 0.0001)
  const pose = bone ? sampleBonePose({ ...rig, loop: false }, bone.id, time) : { x: 0, y: 0, rotation: 0 }
  const key: BoneKeyframe = { ...pose, time, easing: exact?.easing ?? 'smooth' }

  const [isRetargetOpen, setIsRetargetOpen] = useState(false)

  const setKey = (patch: Partial<BoneKeyframe> = {}) => {
    if (!bone) return
    playback.setIsPlaying(false)
    run({ action: 'set-key', boneId: bone.id, key: { ...key, ...patch } })
  }

  const handleInheritClip = (sourceClip: AnimationClip, sourceBones: LayerBone[], clipName?: string) => {
    playback.setIsPlaying(false)
    playback.setTime(0)
    run({ action: 'inherit-clip', sourceClip, sourceBones, clipName })
  }

  return (
    <div className="lw-rig-panel">
      {/* 1. Thanh quản lý nhiều động tác (Clips) */}
      <WorkshopClipBar
        rig={rig}
        activeClip={activeClip}
        run={run}
        onOpenRetarget={() => setIsRetargetOpen(true)}
      />

      {/* Hộp thoại kế thừa động tác thông minh */}
      <WorkshopRetargetDialog
        isOpen={isRetargetOpen}
        onClose={() => setIsRetargetOpen(false)}
        targetComposite={composite}
        onInherit={handleInheritClip}
      />

      {/* 2. Điều khiển phát thử & Dòng thời gian */}
      <div className="lw-card-section">
        <div className="lw-card-header">
          <span className="lw-card-title">⏱️ Phát thử & Dòng thời gian</span>
          <span className="lw-card-badge">{time.toFixed(2)}s / {rig.duration.toFixed(1)}s</span>
        </div>

        <div className="lw-rig-actions" style={{ marginTop: '4px', marginBottom: '8px' }}>
          <button
            type="button"
            className={`btn sm ${playback.isPlaying ? 'primary' : ''}`}
            onClick={playback.toggle}
            style={{ flex: 1 }}
          >
            {playback.isPlaying ? '❚❚ Tạm dừng' : '▶ Phát thử'}
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              playback.setIsPlaying(false)
              playback.setTime(0)
            }}
            title="Đưa kim thời gian về đầu mốc 0s"
          >
            ⏮ Về đầu (0s)
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() => run({ action: 'clear-animation' })}
            title="Xóa toàn bộ keyframe của mọi xương trong động tác này"
          >
            Xóa hết key
          </button>
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

        <div className="lw-rig-grid" style={{ marginTop: '6px' }}>
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

        <label className="lw-rig-check" style={{ marginTop: '4px' }}>
          <input
            type="checkbox"
            checked={rig.loop}
            onChange={(e) => run({ action: 'settings', loop: e.target.checked })}
          />{' '}
          <span>Lặp chu kỳ chuyển động liên tục</span>
        </label>
      </div>

      {/* 3. Tạo dáng xương (Pose Mode) */}
      <div className="lw-card-section">
        <div className="lw-card-header">
          <span className="lw-card-title">🎭 Tạo dáng xương (Pose Mode)</span>
        </div>

        <div className="lw-form-group">
          <span className="lw-form-label">Chọn xương để tạo dáng:</span>
          <Select
            size="sm"
            dropdownWidth={280}
            style={{ width: '100%' }}
            value={boneId ?? ''}
            options={[
              { value: '', label: '-- Chọn xương để tạo dáng --' },
              ...bones.map((b) => ({ value: b.id, label: b.name }))
            ]}
            onChange={(val) => selectBone(String(val) || null)}
          />
        </div>

        {bone ? (
          <>
            <p style={{ margin: '4px 0 8px', fontSize: '11px', color: 'var(--text-dim)' }}>
              Mẹo: Click hoặc kéo trực tiếp xương trên màn hình 2D để tạo dáng trực quan!
            </p>

            <div className="lw-rig-grid">
              <RigNumber label="Góc xoay (°)" value={pose.rotation} onChange={(rotation) => setKey({ rotation })} />
              <RigNumber label="Dời X (px)" value={pose.x} onChange={(x) => setKey({ x })} />
              <RigNumber label="Dời Y (px)" value={pose.y} onChange={(y) => setKey({ y })} />
            </div>

            <div className="lw-form-group" style={{ marginTop: '8px' }}>
              <span className="lw-form-label">Kiểu nội suy chuyển động:</span>
              <Select
                size="sm"
                dropdownWidth={280}
                style={{ width: '100%' }}
                value={key.easing}
                options={[
                  { value: 'smooth', label: 'Mượt mà (Smooth Bezier)' },
                  { value: 'linear', label: 'Tuyến tính (Linear)' },
                  { value: 'hold', label: 'Giữ nguyên tư thế (Hold)' }
                ]}
                onChange={(val) => setKey({ easing: val as BoneKeyframe['easing'] })}
              />
            </div>

            <div className="lw-rig-actions" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="btn sm primary"
                onClick={() => setKey()}
                style={{ flex: 1 }}
              >
                ◆ Ghi tư thế tại {time.toFixed(2)}s
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => setKey({ x: 0, y: 0, rotation: 0 })}
                title="Khôi phục góc xoay và dời về tư thế nghỉ ban đầu (0°)"
              >
                Tư thế gốc (0°)
              </button>
            </div>

            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--line-soft)' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>
                Các mốc Keyframe của &ldquo;{bone.name}&rdquo; ({keys.length}):
              </span>
              <div className="lw-key-list" aria-label="Keyframe của xương">
                {keys.map((k) => (
                  <div key={k.time}>
                    <button
                      type="button"
                      className={`btn xs ${k === exact ? 'active' : ''}`}
                      onClick={() => {
                        playback.setIsPlaying(false)
                        playback.setTime(k.time)
                      }}
                      style={{ flex: 1, textAlign: 'left' }}
                    >
                      ◆ {k.time.toFixed(2)}s · {k.rotation}° ({k.easing})
                    </button>
                    <button
                      type="button"
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
                <p style={{ margin: '6px 0', fontSize: '10.5px', color: 'var(--text-faint)' }}>
                  Chưa có keyframe nào cho xương này. Bấm &ldquo;Ghi tư thế&rdquo; để lưu mốc.
                </p>
              )}
            </div>
          </>
        ) : (
          <p style={{ margin: '8px 0', color: 'var(--text-faint)', fontSize: '11px', textAlign: 'center' }}>
            Chọn một xương ở trên hoặc click trực tiếp vào xương trên khung 2D để tạo dáng.
          </p>
        )}
      </div>
    </div>
  )
}
