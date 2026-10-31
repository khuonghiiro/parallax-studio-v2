import { useState } from 'react'
import type { BoneKeyframe, LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { RigAction } from './workshopRig'
import type { ProceduralMotionPreset } from './workshopRigPresets'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { sameKeyTime } from './workshopAnimation'

type Playback = ReturnType<typeof useWorkshopPlayback>
type Run = (action: RigAction) => void

const QUICK_ANGLE_OPTIONS: Array<{ id: MotionViewAngle; label: string; hint: string }> = [
  { id: 'front', label: '0° Chính diện', hint: 'Nhân vật nhìn thẳng về camera: tay chân đối xứng & co giãn chiều sâu 2.5D' },
  { id: 'diagonal', label: '45° Chéo 3/4', hint: 'Nhân vật đứng chéo góc 3/4 tự nhiên' },
  { id: 'side', label: '90° Ngang', hint: 'Nhân vật nhìn ngang sang bên (Side Profile)' }
]

const QUICK_MOTION_ITEMS: Array<{ id: ProceduralMotionPreset; label: string; meta: string }> = [
  { id: 'walk', label: 'Bước đi', meta: '1.6s · Lặp' },
  { id: 'idle', label: 'Đứng thở', meta: '2.4s · Lặp' },
  { id: 'wave', label: 'Vẫy tay chào', meta: '1.8s · Lặp' },
  { id: 'bow', label: 'Cúi chào', meta: '2.0s · 1 lần' },
  { id: 'jump', label: 'Nhún nhảy', meta: '1.4s · Lặp' },
  { id: 'run', label: 'Chạy nhanh', meta: '1.0s · Lặp' },
  { id: 'land', label: 'Tiếp đất', meta: '1.2s · 1 lần' },
  { id: 'action', label: 'Vung đòn', meta: '1.5s · Lặp' }
]

/** Thẻ tạo nhanh động tác mẫu chuẩn góc nhìn 0° Chính diện / 45° Chéo / 90° Ngang. */
export function QuickMotionPresetCard({
  playback,
  run,
  defaultAsNewClip = false
}: {
  playback: Playback
  run: Run
  defaultAsNewClip?: boolean
}) {
  const [viewAngle, setViewAngle] = useState<MotionViewAngle>('front')
  const [asNewClip, setAsNewClip] = useState(defaultAsNewClip)

  const handleApply = (preset: ProceduralMotionPreset) => {
    playback.setIsPlaying(false)
    playback.setTime(0)
    run({
      action: 'apply-preset-animation',
      preset,
      asNewClip,
      viewAngle
    })
    playback.setIsPlaying(true)
  }

  return (
    <div className="lw-card-section lw-quick-motion-card">
      <div className="lw-card-header">
        <span className="lw-card-title">Mẫu động tác nhanh</span>
        <div className="lw-inline-seg" role="group" aria-label="Chế độ ghi mẫu động tác">
          <button
            type="button"
            className={`lw-inline-seg-btn${!asNewClip ? ' active' : ''}`}
            onClick={() => setAsNewClip(false)}
            title="Ghi đè mẫu động tác lên clip đang chọn"
          >
            Ghi đè
          </button>
          <button
            type="button"
            className={`lw-inline-seg-btn${asNewClip ? ' active' : ''}`}
            onClick={() => setAsNewClip(true)}
            title="Tạo thành một clip động tác mới và chạy thử ngay"
          >
            + Clip mới
          </button>
        </div>
      </div>

      <div className="lw-angle-seg-bar" role="radiogroup" aria-label="Góc đứng của nhân vật">
        {QUICK_ANGLE_OPTIONS.map((opt) => {
          const active = viewAngle === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`lw-angle-seg-btn${active ? ' active' : ''}`}
              onClick={() => setViewAngle(opt.id)}
              title={opt.hint}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <div className="lw-studio-preset-grid">
        {QUICK_MOTION_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="lw-studio-preset-item"
            onClick={() => handleApply(item.id)}
            title={`Áp mẫu "${item.label}" theo góc ${viewAngle === 'front' ? '0° Chính diện' : viewAngle === 'diagonal' ? '45° Chéo' : '90° Ngang'} và phát thử`}
          >
            <span className="lw-studio-preset-name">{item.label}</span>
            <small className="lw-studio-preset-meta">{item.meta}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Thao tác tư thế toàn thân gọn gàng 3×2 (ghi, lật, sao chép, dán, dáng gốc, làm trống). */
export function AnimationPoseActions({
  rig,
  time,
  run,
  playback,
  onCopyPose,
  onPastePose,
  onResetAllPose,
  canPaste
}: {
  rig: LayerRig
  time: number
  run: Run
  playback: Playback
  onCopyPose: () => void
  onPastePose: () => void
  onResetAllPose: () => void
  canPaste: boolean
}) {
  return (
    <div className="lw-animation-pose-actions">
      <div className="lw-pose-section-divider">Tư thế toàn thân tại mốc hiện tại</div>
      <div className="lw-pose-fullbody-grid">
        <button
          type="button"
          className="btn xs"
          onClick={() => {
            playback.setIsPlaying(false)
            run({ action: 'set-pose', time, poses: rig.bones.map((b) => ({ boneId: b.id })) })
          }}
          title="Ghi keyframe cho tất cả các xương tại khung hiện tại"
        >
          ◆ Ghi toàn thân
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={() => {
            playback.setIsPlaying(false)
            run({ action: 'mirror-pose', time })
          }}
          title="Lật đối xứng tư thế trái ⇄ phải"
        >
          ⇋ Lật đối xứng
        </button>
        <button type="button" className="btn xs" onClick={onCopyPose} title="Sao chép dáng toàn thân tại thời điểm này">
          Sao chép dáng
        </button>
        <button
          type="button"
          className="btn xs"
          disabled={!canPaste}
          onClick={onPastePose}
          title="Dán dáng đã sao chép vào khung hiện tại"
        >
          Dán dáng
        </button>
        <button type="button" className="btn xs" onClick={onResetAllPose} title="Đặt lại mọi xương về dáng gốc Frame 0">
          ↺ Dáng gốc
        </button>
        <button
          type="button"
          className="btn xs lw-muted-danger-btn"
          onClick={() => {
            if (window.confirm('Xóa toàn bộ keyframe của clip này để diễn hoạt mới từ đầu?')) {
              playback.setIsPlaying(false)
              run({ action: 'clear-animation' })
            }
          }}
          title="Xóa sạch toàn bộ keyframe của clip hiện tại"
        >
          Làm trống
        </button>
      </div>
    </div>
  )
}

/** Danh sách keyframe của xương đang chỉnh: hiển thị cả Frame F# và giây, nhảy nhanh hoặc xóa. */
export function AnimationKeyList({
  bone,
  keys,
  time,
  fps,
  playback,
  run
}: {
  bone: LayerBone
  keys: BoneKeyframe[]
  time: number
  fps: number
  playback: Playback
  run: Run
}) {
  return (
    <details className="lw-animation-key-list" open={keys.length > 0 && keys.length <= 12}>
      <summary className="lw-key-list-summary">
        <span>
          Mốc Key của &ldquo;{bone.name}&rdquo; ({keys.length})
        </span>
        {keys.length > 0 && (
          <button
            type="button"
            className="btn xs lw-key-clear-btn"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (window.confirm(`Xóa toàn bộ ${keys.length} keyframe của xương "${bone.name}"?`)) {
                playback.setIsPlaying(false)
                run({ action: 'clear-bone-track', boneId: bone.id })
              }
            }}
          >
            Xóa track
          </button>
        )}
      </summary>
      <div className="lw-key-list">
        {keys.length === 0 && (
          <div className="lw-key-empty-hint">
            Chưa có keyframe trên xương này. Kéo xương trên sân khấu 2D hoặc bấm &ldquo;◆ Ghi Key (F6)&rdquo;.
          </div>
        )}
        {keys.map((key) => {
          const kfFrame = Math.round(key.time * fps)
          const active = sameKeyTime(key.time, time)
          return (
            <div key={key.time} className="lw-key-chip-pair">
              <button
                type="button"
                className={`btn xs${active ? ' active' : ''}`}
                onClick={() => {
                  playback.setIsPlaying(false)
                  playback.setTime(key.time)
                }}
                title={`Nhảy tới F${kfFrame} (${key.time.toFixed(3)}s)`}
              >
                ◆ F{kfFrame} · {key.time.toFixed(2)}s · {key.rotation.toFixed(0)}°
              </button>
              <button
                type="button"
                className="btn xs"
                aria-label={`Xóa keyframe ${key.time}s`}
                onClick={() => run({ action: 'delete-key', boneId: bone.id, time: key.time })}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </details>
  )
}
