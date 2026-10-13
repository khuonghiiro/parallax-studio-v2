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

  // Toàn bộ các mốc keyframe của tất cả xương trong clip này để hiển thị trên timeline
  const allKeyTimes = Array.from(
    new Set(
      Object.values(rig.tracks)
        .flatMap((track) => track.map((k) => Number(k.time.toFixed(2))))
    )
  ).sort((a, b) => a - b)

  const boneKeyTimes = keys.map((k) => Number(k.time.toFixed(2)))

  // Điều hướng nhảy tới keyframe trước / sau:
  const prevKeyTime = allKeyTimes.filter((t) => t < time - 0.01).pop()
  const nextKeyTime = allKeyTimes.find((t) => t > time + 0.01)

  const handlePrevKey = () => {
    if (prevKeyTime !== undefined) {
      playback.setIsPlaying(false)
      playback.setTime(prevKeyTime)
    }
  }

  const handleNextKey = () => {
    if (nextKeyTime !== undefined) {
      playback.setIsPlaying(false)
      playback.setTime(nextKeyTime)
    }
  }

  const handleRecordFullPose = () => {
    playback.setIsPlaying(false)
    const poses = bones.map((b) => {
      const p = sampleBonePose(rig, b.id, time)
      return { boneId: b.id, ...p, easing: key.easing }
    })
    run({ action: 'set-pose', time, easing: key.easing, poses })
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

        <div className="lw-rig-actions" style={{ marginTop: '4px', marginBottom: '6px' }}>
          <button
            type="button"
            className="btn sm"
            disabled={prevKeyTime === undefined}
            onClick={handlePrevKey}
            title={prevKeyTime !== undefined ? `Nhảy về keyframe trước (${prevKeyTime.toFixed(2)}s)` : 'Không có keyframe trước'}
          >
            ⏮ Key
          </button>
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
            disabled={nextKeyTime === undefined}
            onClick={handleNextKey}
            title={nextKeyTime !== undefined ? `Nhảy tới keyframe kế (${nextKeyTime.toFixed(2)}s)` : 'Không có keyframe kế'}
          >
            Key ⏭
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
            0s
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() => run({ action: 'clear-animation' })}
            title="Xóa toàn bộ keyframe của mọi xương trong động tác này"
          >
            Xóa hết
          </button>
        </div>

        {/* Thanh scrubber Timeline với các mốc Keyframe dạng viên kim cương (tương tự Moho) */}
        <div className="lw-timeline-wrapper" style={{ position: 'relative', width: '100%', padding: '2px 0 6px' }}>
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
            style={{ width: '100%', margin: 0, display: 'block' }}
          />
          <div
            className="lw-timeline-markers"
            style={{
              position: 'relative',
              height: '8px',
              marginTop: '3px',
              width: '100%',
              pointerEvents: 'none'
            }}
          >
            {allKeyTimes.map((t) => {
              const isSelectedBoneKey = boneKeyTimes.includes(t)
              const isCurrent = Math.abs(t - time) < 0.03
              const percent = Math.max(0, Math.min(100, (t / (rig.duration || 1)) * 100))
              return (
                <div
                  key={t}
                  onClick={(e) => {
                    e.stopPropagation()
                    playback.setIsPlaying(false)
                    playback.setTime(t)
                  }}
                  title={`Mốc ${t.toFixed(2)}s ${isSelectedBoneKey ? '(xương đang chọn)' : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${percent}%`,
                    top: '0',
                    transform: 'translateX(-50%) rotate(45deg)',
                    width: isCurrent ? '8px' : '6px',
                    height: isCurrent ? '8px' : '6px',
                    backgroundColor: isCurrent
                      ? 'var(--accent-cyan)'
                      : isSelectedBoneKey
                        ? 'var(--key)'
                        : 'var(--text-faint)',
                    borderRadius: '1px',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    transition: 'all 0.15s ease',
                    zIndex: isCurrent ? 3 : isSelectedBoneKey ? 2 : 1
                  }}
                />
              )
            })}
          </div>
        </div>

        <div className="lw-rig-grid" style={{ marginTop: '2px' }}>
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

            <div className="lw-rig-grid" style={{ marginTop: '4px' }}>
              <RigNumber label="Co giãn X" value={pose.scaleX ?? 1} min={-5} max={5} step={0.05} onChange={(scaleX) => setKey({ scaleX })} />
              <RigNumber label="Co giãn Y" value={pose.scaleY ?? 1} min={-5} max={5} step={0.05} onChange={(scaleY) => setKey({ scaleY })} />
            </div>

            <div className="lw-form-group" style={{ marginTop: '8px' }}>
              <span className="lw-form-label">Kiểu nội suy chuyển động (Easing):</span>
              <Select
                size="sm"
                dropdownWidth={280}
                style={{ width: '100%' }}
                value={key.easing}
                options={[
                  { value: 'smooth', label: 'Mượt mà (Smooth Spline)' },
                  { value: 'ease-in-out', label: 'Tự nhiên (Ease In/Out)' },
                  { value: 'ease-out', label: 'Giảm tốc dừng (Ease Out)' },
                  { value: 'ease-in', label: 'Tăng tốc bắt đầu (Ease In)' },
                  { value: 'linear', label: 'Tuyến tính đều (Linear)' },
                  { value: 'hold', label: 'Giữ nguyên tư thế (Hold / Step)' }
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
                onClick={() => setKey({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })}
                title="Khôi phục góc xoay, dời và scale về tư thế nghỉ ban đầu"
              >
                Tư thế gốc (0°)
              </button>
            </div>

            <div className="lw-rig-actions" style={{ marginTop: '6px' }}>
              <button
                type="button"
                className="btn sm"
                onClick={handleRecordFullPose}
                style={{ flex: 1 }}
                title="Ghi mốc keyframe cho tất cả xương cùng lúc tại thời điểm hiện tại"
              >
                🌟 Ghi dáng toàn thân ({bones.length} xương)
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  playback.setIsPlaying(false)
                  run({ action: 'mirror-pose', time })
                }}
                title="Lật đối xứng tư thế tay/chân trái - phải tại thời điểm hiện tại"
              >
                🪞 Lật đối xứng dáng
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
