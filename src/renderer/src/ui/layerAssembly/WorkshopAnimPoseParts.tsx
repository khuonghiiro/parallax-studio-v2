import type { BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import type { RigAction } from './workshopRig'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { sameKeyTime } from './workshopAnimation'

type Playback = ReturnType<typeof useWorkshopPlayback>
type Run = (action: RigAction) => void

/** Thao tác toàn thân (ghi, lật, sao chép/dán dáng, làm trống clip) và tạo nhanh clip từ mẫu. */
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
      <div className="lw-pose-section-divider">Thao tác toàn thân & Mẫu động tác</div>
      <div className="lw-rig-actions">
        <button
          className="btn sm"
          onClick={() => {
            playback.setIsPlaying(false)
            run({ action: 'set-pose', time, poses: rig.bones.map((b) => ({ boneId: b.id })) })
          }}
          title="Ghi keyframe cho tất cả các xương tại thời điểm hiện tại"
        >
          ◆ Ghi toàn thân
        </button>
        <button
          className="btn sm"
          onClick={() => {
            playback.setIsPlaying(false)
            run({ action: 'mirror-pose', time })
          }}
          title="Lật đối xứng tư thế trái ↔ phải"
        >
          ⇋ Lật dáng
        </button>
        <button
          className="btn sm"
          onClick={onCopyPose}
          title="Sao chép dáng toàn thân tại thời điểm này"
        >
          Sao chép
        </button>
        <button
          className="btn sm"
          disabled={!canPaste}
          onClick={onPastePose}
          title="Dán dáng đã sao chép vào thời điểm này"
        >
          Dán dáng
        </button>
        <button
          className="btn sm"
          onClick={onResetAllPose}
          title="Đặt lại mọi xương về dáng gốc"
        >
          Dáng gốc
        </button>
        <button
          className="btn sm"
          style={{ color: 'var(--text-faint)' }}
          onClick={() => {
            if (
              window.confirm(
                'Bạn có chắc muốn xóa toàn bộ keyframe của clip này để tự tạo động tác mới từ đầu?'
              )
            ) {
              playback.setIsPlaying(false)
              run({ action: 'clear-animation' })
            }
          }}
          title="Xóa sạch toàn bộ keyframe của clip hiện tại"
        >
          Làm trống clip
        </button>
      </div>

      <div className="lw-pose-section-divider">Tạo nhanh clip từ mẫu có sẵn</div>
      <div className="lw-rig-presets-row">
        {(
          [
            ['walk', '🚶 Đi bộ'],
            ['idle', '🧍 Đứng thở'],
            ['wave', '👋 Vẫy tay'],
            ['jump', '🦘 Nhảy']
          ] as const
        ).map(([preset, title]) => (
          <button
            key={preset}
            className="btn sm"
            onClick={() => {
              playback.setIsPlaying(false)
              playback.setTime(0)
              run({ action: 'apply-preset-animation', preset, asNewClip: true })
            }}
          >
            {title}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Danh sách keyframe của xương đang chỉnh: nhảy tới key, xoá từng key hoặc cả track. */
export function AnimationKeyList({
  bone,
  keys,
  time,
  playback,
  run
}: {
  bone: LayerBone
  keys: BoneKeyframe[]
  time: number
  playback: Playback
  run: Run
}) {
  return (
    <details className="lw-animation-key-list" open={keys.length > 0}>
      <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          📌 Keyframe của {bone.name} ({keys.length})
        </span>
        {keys.length > 0 && (
          <button
            className="btn xs"
            style={{ fontSize: '10px', padding: '1px 5px', marginLeft: 'auto' }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (
                window.confirm(
                  `Xóa toàn bộ ${keys.length} keyframe của riêng xương "${bone.name}"?`
                )
              ) {
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
          <div style={{ fontSize: '10.5px', color: 'var(--text-faint)', padding: '4px 0' }}>
            Chưa có keyframe nào trên xương này. Xoay xương trên khung 2D hoặc bấm &ldquo;◆ Ghi tư thế xương&rdquo;.
          </div>
        )}
        {keys.map((key) => (
          <div key={key.time}>
            <button
              className={`btn xs ${sameKeyTime(key.time, time) ? 'active' : ''}`}
              onClick={() => {
                playback.setIsPlaying(false)
                playback.setTime(key.time)
              }}
            >
              ◆ {key.time.toFixed(2)}s · {key.rotation.toFixed(1)}°
            </button>
            <button
              className="btn xs"
              aria-label={`Xóa keyframe ${key.time}s`}
              onClick={() => run({ action: 'delete-key', boneId: bone.id, time: key.time })}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}
