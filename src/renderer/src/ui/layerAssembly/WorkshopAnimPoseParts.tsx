import { useState } from 'react'
import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import type { RigAction } from './workshopRig'
import type { ProceduralMotionPreset } from './workshopRigPresets'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { sameKeyTime } from './workshopAnimation'
import { Select } from '../controls'
import { IconPlus, IconTrash } from '../icons'

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

/** Thanh chọn nhanh Clip đang sửa + Tạo Động tác mới (Blank / Từ tư thế hiện tại) ngay đầu tab Animate. */
export function ActiveActionClipHeader({
  rig,
  activeClip,
  fps,
  time,
  playback,
  run
}: {
  rig: LayerRig
  activeClip: AnimationClip
  fps: number
  time: number
  playback: Playback
  run: Run
}) {
  const clips = rig.clips ?? [activeClip]
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [keepCurrentPose, setKeepCurrentPose] = useState(false)
  const [draftDuration, setDraftDuration] = useState(2.0)

  const openCreator = () => {
    setDraftName(`Động tác ${clips.length + 1}`)
    setDraftDuration(2.0)
    setKeepCurrentPose(false)
    setCreating(true)
  }

  const commitNewBlankAction = () => {
    const cleanName = draftName.trim() || `Động tác ${clips.length + 1}`
    const tracks: LayerRig['tracks'] = {}
    if (keepCurrentPose && rig.bones.length > 0) {
      const flatRig: LayerRig = { ...rig, loop: false }
      for (const b of rig.bones) {
        const p = sampleBonePose(flatRig, b.id, time)
        tracks[b.id] = [
          {
            time: 0,
            x: p.x,
            y: p.y,
            rotation: p.rotation,
            scaleX: p.scaleX ?? 1,
            scaleY: p.scaleY ?? 1,
            easing: 'smooth'
          }
        ]
      }
    }
    const newClip: AnimationClip = {
      id: `clip-custom-${Date.now().toString(36)}`,
      name: cleanName,
      duration: Math.max(0.2, Math.min(120, Number(draftDuration) || 2.0)),
      fps,
      loop: true,
      tracks
    }
    playback.setIsPlaying(false)
    playback.setTime(0)
    run({ action: 'add-clip', clip: newClip })
    setCreating(false)
  }

  return (
    <div className="lw-card-section lw-active-action-bar">
      <div className="lw-active-action-row">
        <div className="lw-active-action-select">
          <Select
            size="sm"
            value={activeClip.id}
            options={clips.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.duration.toFixed(1)}s)`
            }))}
            onChange={(val) => {
              const id = String(val)
              if (id && id !== activeClip.id) {
                playback.setIsPlaying(false)
                playback.setTime(0)
                run({ action: 'switch-clip', clipId: id })
              }
            }}
          />
        </div>
        <button
          type="button"
          className={`btn xs primary lw-new-action-cta${creating ? ' active' : ''}`}
          onClick={() => (creating ? setCreating(false) : openCreator())}
          title="Tạo một động tác mới trống để tự uốn khớp & nhấn Enter ghi Keyframe như Moho Pro"
        >
          <IconPlus width={11} height={11} />
          <span>Động tác mới</span>
        </button>
      </div>

      {creating && (
        <div className="lw-new-action-inline-form">
          <div className="lw-new-action-form-row">
            <input
              type="text"
              className="lw-field-input"
              value={draftName}
              placeholder="Tên động tác mới..."
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  commitNewBlankAction()
                } else if (e.key === 'Escape') {
                  setCreating(false)
                }
              }}
              autoFocus
            />
            <label className="lw-new-action-dur-box" title="Thời lượng ban đầu của động tác mới (giây)">
              <input
                type="number"
                min={0.2}
                max={120}
                step={0.5}
                value={draftDuration}
                onChange={(e) => setDraftDuration(Number(e.target.value))}
              />
              <small>s</small>
            </label>
          </div>
          <div className="lw-new-action-form-foot">
            <div className="lw-inline-seg" role="group" aria-label="Tư thế khởi điểm F0">
              <button
                type="button"
                className={`lw-inline-seg-btn${!keepCurrentPose ? ' active' : ''}`}
                onClick={() => setKeepCurrentPose(false)}
                title="Bắt đầu từ dáng gốc nghỉ (0°) tại 0.00s"
              >
                Dáng gốc F0
              </button>
              <button
                type="button"
                className={`lw-inline-seg-btn${keepCurrentPose ? ' active' : ''}`}
                onClick={() => setKeepCurrentPose(true)}
                title="Giữ nguyên tư thế đang đứng trên sân khấu làm mốc 0.00s"
              >
                Giữ dáng hiện tại
              </button>
            </div>
            <div className="lw-new-action-btns">
              <button type="button" className="btn xs" onClick={() => setCreating(false)}>
                Hủy
              </button>
              <button type="button" className="btn xs primary" onClick={commitNewBlankAction}>
                Tạo ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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

/** Danh sách keyframe của xương đang chỉnh: hỗ trợ đổi trực tiếp mốc giây (VD 1.00s -> 0.50s), chọn nhiều để xóa hàng loạt. */
export function AnimationKeyList({
  bone,
  keys,
  time,
  duration,
  fps,
  playback,
  run
}: {
  bone: LayerBone
  keys: BoneKeyframe[]
  time: number
  duration: number
  fps: number
  playback: Playback
  run: Run
}) {
  const [checkedTimes, setCheckedTimes] = useState<number[]>([])

  const validChecked = checkedTimes.filter((t) => keys.some((k) => sameKeyTime(k.time, t)))

  const toggleChecked = (t: number) => {
    setCheckedTimes((prev) =>
      prev.some((x) => sameKeyTime(x, t)) ? prev.filter((x) => !sameKeyTime(x, t)) : [...prev, t]
    )
  }

  const deleteCheckedKeys = () => {
    if (!validChecked.length) return
    playback.setIsPlaying(false)
    run({
      action: 'delete-keys',
      keys: validChecked.map((t) => ({ boneId: bone.id, time: t }))
    })
    setCheckedTimes([])
  }

  return (
    <details className="lw-animation-key-list" open={keys.length > 0 && keys.length <= 12}>
      <summary className="lw-key-list-summary">
        <span>
          Mốc Key của &ldquo;{bone.name}&rdquo; ({keys.length})
        </span>
        <span className="lw-key-summary-actions">
          {validChecked.length > 0 && (
            <button
              type="button"
              className="btn xs lw-muted-danger-btn"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                deleteCheckedKeys()
              }}
              title="Xóa toàn bộ các mốc keyframe đã tích chọn"
            >
              <IconTrash width={10} height={10} />
              <span>Xóa ({validChecked.length})</span>
            </button>
          )}
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
                  setCheckedTimes([])
                }
              }}
            >
              Xóa hết
            </button>
          )}
        </span>
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
          const isChecked = validChecked.some((t) => sameKeyTime(t, key.time))
          return (
            <div key={key.time} className={`lw-key-chip-pair${isChecked ? ' is-checked' : ''}`}>
              <input
                type="checkbox"
                className="lw-key-check"
                checked={isChecked}
                onChange={() => toggleChecked(key.time)}
                title="Tích chọn để xóa nhiều mốc keyframe cùng lúc"
              />
              <button
                type="button"
                className={`btn xs lw-key-jump-btn${active ? ' active' : ''}`}
                onClick={() => {
                  playback.setIsPlaying(false)
                  playback.setTime(key.time)
                }}
                title={`Nhảy tới F${kfFrame} (${key.time.toFixed(3)}s)`}
              >
                ◆ F{kfFrame} · {key.rotation.toFixed(0)}°
              </button>
              <input
                type="number"
                className="lw-key-inline-time"
                min={0}
                max={duration}
                step={0.05}
                defaultValue={Number(key.time.toFixed(2))}
                key={`${bone.id}-${key.time}`}
                title="Đổi thời điểm giây của mốc keyframe này (VD 1.00 -> 0.50 rồi nhấn Enter)"
                onBlur={(e) => {
                  const nextT = Number(e.currentTarget.value)
                  if (!Number.isFinite(nextT)) return
                  const clamped = Number(Math.max(0, Math.min(duration, nextT)).toFixed(4))
                  if (!sameKeyTime(clamped, key.time)) {
                    playback.setIsPlaying(false)
                    run({
                      action: 'move-keys',
                      overwrite: true,
                      moves: [{ boneId: bone.id, time: key.time, targetTime: clamped }]
                    })
                    playback.setTime(clamped)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    ;(e.currentTarget as HTMLInputElement).blur()
                  }
                }}
              />
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
