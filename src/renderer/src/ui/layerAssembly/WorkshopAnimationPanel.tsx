import { useState, useEffect } from 'react'
import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { RigNumber, type RigPanelProps } from './WorkshopRigPanel'
import { emptyRig, ensureRigClips } from './workshopRig'
import { sameKeyTime, type BonePoseEntry } from './workshopAnimation'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { Select } from '../controls'
import { WorkshopClipBar } from './WorkshopClipBar'
import { WorkshopRetargetDialog } from './WorkshopRetargetDialog'
import { WorkshopInterpolation } from './WorkshopInterpolation'
import { WorkshopMotionSketchCard } from './WorkshopMotionSketchCard'
import { WorkshopAnimAssistCard, WorkshopSecondaryMotionCard } from './WorkshopAnimAssistCards'
import { setAnimAssist, useAnimAssist } from './animAssistStore'
import { toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import { confirmPoseAndStep, setStepRecordState, useStepRecord } from './workshopStepRecord'
import { WorkshopAnimToolsCard } from './WorkshopAnimToolsCard'
import { AnimationKeyList, AnimationPoseActions } from './WorkshopAnimPoseParts'
import type { LayerComposite } from './types'

type Props = RigPanelProps & {
  playback: ReturnType<typeof useWorkshopPlayback>
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
}

export type AnimInspectorSubTab = 'pose' | 'sketch' | 'physics'

export function WorkshopAnimationPanel({
  composite,
  boneId,
  selectBone,
  run,
  playback,
  setComposite
}: Props) {
  const { rig, activeClip } = ensureRigClips(composite.rig ?? emptyRig())
  const activeBone = rig.bones.find((b) => b.id === boneId) ?? (rig.bones[0] || null)
  const bone = activeBone
  const time = Math.min(rig.duration, playback.time)
  const keys = bone ? rig.tracks[bone.id] ?? [] : []
  const exact = keys.find((k) => sameKeyTime(k.time, time))
  const previous = keys.filter((k) => k.time <= time).at(-1)
  const pose = bone
    ? sampleBonePose({ ...rig, loop: false }, bone.id, time)
    : { x: 0, y: 0, rotation: 0 }
  const key: BoneKeyframe = {
    ...pose,
    time,
    easing: exact?.easing ?? previous?.easing ?? 'smooth',
    bezier: exact?.bezier ?? previous?.bezier
  }
  const [isRetargetOpen, setIsRetargetOpen] = useState(false)
  const [copiedPose, setCopiedPose] = useState<BonePoseEntry[] | null>(null)
  const [subTab, setSubTab] = useState<AnimInspectorSubTab>('pose')
  const assist = useAnimAssist()
  const sketch = useMotionSketch()

  const handleConfirmStep = () => {
    playback.setIsPlaying(false)
    let nextTime = playback.time
    setComposite((c) => {
      const res = confirmPoseAndStep(c, playback.time)
      nextTime = res.nextTime
      return res.composite
    })
    playback.setTime(nextTime)
  }

  useEffect(() => {
    if (!boneId && rig.bones.length > 0) {
      selectBone(rig.bones[0].id)
    }
  }, [boneId, rig.bones, selectBone])

  const setKey = (patch: Partial<BoneKeyframe> = {}) => {
    if (!bone) return
    playback.setIsPlaying(false)
    run({ action: 'set-key', boneId: bone.id, key: { time, ...patch } })
  }

  const inherit = (sourceClip: AnimationClip, sourceBones: LayerBone[], clipName?: string) => {
    playback.setIsPlaying(false)
    playback.setTime(0)
    run({ action: 'inherit-clip', sourceClip, sourceBones, clipName })
  }

  const copyPose = () => {
    const poses: BonePoseEntry[] = rig.bones.map((b) => ({
      boneId: b.id,
      ...sampleBonePose({ ...rig, loop: false }, b.id, time)
    }))
    setCopiedPose(poses)
  }

  const pastePose = () => {
    if (!copiedPose) return
    playback.setIsPlaying(false)
    run({ action: 'set-pose', time, poses: copiedPose })
  }

  const resetAllPose = () => {
    playback.setIsPlaying(false)
    run({
      action: 'set-pose',
      time,
      poses: rig.bones.map((b) => ({ boneId: b.id, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }))
    })
  }

  return (
    <div className="lw-rig-panel lw-animation-panel" data-mcp-region="layer_assembly_animation_panel">
      {/* 1. Quản lý danh sách Động tác (Clips) */}
      <WorkshopClipBar
        rig={rig}
        activeClip={activeClip}
        composite={composite}
        run={(action) => {
          if (action.action === 'apply-mixamo-rig-motion') {
            playback.setTime(0)
            run(action)
            playback.setIsPlaying(true)
            return
          }
          playback.setIsPlaying(false)
          if (
            [
              'switch-clip',
              'add-clip',
              'duplicate-clip',
              'delete-clip',
              'delete-all-clips'
            ].includes(action.action)
          ) {
            playback.setTime(0)
          }
          run(action)
        }}
        onOpenRetarget={() => setIsRetargetOpen(true)}
      />

      <WorkshopRetargetDialog
        isOpen={isRetargetOpen}
        onClose={() => setIsRetargetOpen(false)}
        targetComposite={composite}
        onInherit={inherit}
      />

      {/* 2. Thanh Thời gian, Phát thử & Xác nhận vị trí (Enter) */}
      <AnimationTransportCard
        rig={rig}
        playback={playback}
        run={run}
        onConfirmStep={handleConfirmStep}
      />

      {/* 3. Thanh chuyển 3 chế độ chuyên sâu trong Tab Animation */}
      <div className="lw-anim-subtabs" role="tablist" aria-label="Chế độ diễn hoạt">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pose'}
          className={`lw-anim-subtab${subTab === 'pose' ? ' active' : ''}`}
          onClick={() => {
            setSubTab('pose')
            if (sketch.armed) toggleMotionSketchArmed(false)
          }}
          title="Chỉnh tư thế xương, nhấn Enter xác nhận vị trí hoặc giữ Shift+Chuột trái ghi Realtime"
        >
          🎯 Tạo dáng
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'sketch'}
          className={`lw-anim-subtab${subTab === 'sketch' ? ' active' : ''}`}
          onClick={() => setSubTab('sketch')}
          title="Ghi động tác Realtime (Shift+Chuột trái) hoặc bật Bút vẽ tự do (Phím D)"
        >
          ✏️ Vẽ động tác{sketch.armed ? ' ●' : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'physics'}
          className={`lw-anim-subtab${subTab === 'physics' ? ' active' : ''}`}
          onClick={() => {
            setSubTab('physics')
            if (sketch.armed) toggleMotionSketchArmed(false)
          }}
          title="Nướng chuyển động vật lý thứ cấp (tóc, tà áo, đuôi) và cấu hình IK / Onion Skin"
        >
          🌊 Vật lý & IK
        </button>
      </div>

      {/* Nội dung theo từng Sub-tab */}
      {subTab === 'pose' && (
        <div className="lw-card-section lw-animation-pose">
          <div className="lw-card-header">
            <span className="lw-card-title">🦴 Xương đang chỉnh</span>
            <span className={`lw-card-badge${exact ? ' lw-badge-keyed' : ''}`}>
              {exact ? '◆ Đã có key' : 'Chưa ghi key'}
            </span>
          </div>

          <Select
            size="sm"
            value={bone?.id ?? ''}
            options={[
              { value: '', label: 'Chọn xương trên hình hoặc timeline' },
              ...rig.bones.map((b) => ({
                value: b.id,
                label: `${b.name} (${(rig.tracks[b.id] ?? []).length} key)`
              }))
            ]}
            onChange={(value) => selectBone(String(value) || null)}
          />

          {/* Bật/tắt nhanh IK, Onion Skin, Quỹ đạo ngay trong thẻ Tạo dáng */}
          <div className="lw-pose-quick-toggles">
            <button
              type="button"
              className={`lw-pose-toggle-chip${assist.ik ? ' active' : ''}`}
              onClick={() => setAnimAssist({ ik: !assist.ik })}
              title="Bật/tắt kéo ngọn xương theo chuỗi IK (Phím I)"
            >
              🦾 IK {assist.ik ? `(${assist.ikChain})` : 'Tắt'}
            </button>
            <button
              type="button"
              className={`lw-pose-toggle-chip${assist.onion ? ' active' : ''}`}
              onClick={() => setAnimAssist({ onion: !assist.onion })}
              title="Bật/tắt bóng mờ Onion Skin trước/sau (Phím O)"
            >
              🧅 Onion Skin
            </button>
            <button
              type="button"
              className={`lw-pose-toggle-chip${assist.path ? ' active' : ''}`}
              onClick={() => setAnimAssist({ path: !assist.path })}
              title="Bật/tắt đường quỹ đạo chuyển động ngọn xương (Phím P)"
            >
              〰️ Quỹ đạo
            </button>
          </div>

          {bone ? (
            <>
              <PoseFields keyframe={key} setKey={setKey} />

              <WorkshopInterpolation
                keyframe={key}
                onChange={(patch) => {
                  if (exact && patch.easing) {
                    run({
                      action: 'set-interpolation',
                      boneId: bone.id,
                      time: exact.time,
                      easing: patch.easing,
                      bezier: patch.bezier
                    })
                  } else {
                    setKey(patch)
                  }
                }}
              />

              <div className="lw-rig-actions">
                <button className="btn sm primary" onClick={() => setKey()}>
                  ◆ Ghi tư thế xương
                </button>
                <button
                  className="btn sm"
                  onClick={() =>
                    setKey({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
                  }
                >
                  ↺ Về gốc
                </button>
              </div>

              <WorkshopAnimToolsCard rig={rig} boneId={bone.id} playback={playback} run={run} />

              <AnimationPoseActions
                rig={rig}
                time={time}
                run={run}
                playback={playback}
                onCopyPose={copyPose}
                onPastePose={pastePose}
                onResetAllPose={resetAllPose}
                canPaste={!!copiedPose}
              />

              <AnimationKeyList
                bone={bone}
                keys={keys}
                time={time}
                playback={playback}
                run={run}
              />
            </>
          ) : (
            <p>Chọn một xương để chỉnh tư thế. Mỗi hàng timeline bên dưới là một xương.</p>
          )}
        </div>
      )}

      {subTab === 'sketch' && (
        <WorkshopMotionSketchCard
          isPlaying={playback.isPlaying}
          onTogglePlay={playback.toggle}
          onConfirmStep={handleConfirmStep}
        />
      )}

      {subTab === 'physics' && (
        <>
          <WorkshopSecondaryMotionCard
            rig={rig}
            boneId={bone?.id ?? null}
            setComposite={setComposite}
            onDone={() => {
              playback.setTime(0)
              playback.setIsPlaying(true)
            }}
          />
          <WorkshopAnimAssistCard />
        </>
      )}
    </div>
  )
}

function AnimationTransportCard({
  rig,
  playback,
  run,
  onConfirmStep
}: {
  rig: LayerRig
  playback: Props['playback']
  run: Props['run']
  onConfirmStep: () => void
}) {
  const stepRecord = useStepRecord()
  return (
    <div className="lw-card-section lw-anim-transport-card">
      <div className="lw-anim-transport-row">
        <button className="btn sm primary" onClick={playback.toggle}>
          {playback.isPlaying ? '⏸ Tạm dừng' : '▶ Phát thử'}
        </button>
        <button
          className="btn sm"
          onClick={() => {
            playback.setIsPlaying(false)
            playback.setTime(0)
          }}
          title="Đưa đầu phát về 0.00s"
        >
          ⏮ Về 0s
        </button>
        <label className="lw-rig-check lw-anim-loop-check" title="Tự động lặp lại khi phát hết clip">
          <input
            type="checkbox"
            checked={rig.loop}
            onChange={(e) => run({ action: 'settings', loop: e.target.checked })}
          />
          <span>🔁 Lặp</span>
        </label>
      </div>

      {/* Thanh xác nhận vị trí từng bước (Enter) & hướng dẫn ghi Realtime (Shift + Chuột trái) */}
      <div className="lw-step-record-bar">
        <div className="lw-step-record-main">
          <button
            type="button"
            className={`btn xs lw-confirm-step-btn${stepRecord.pendingConfirm ? ' pending' : ''}`}
            onClick={onConfirmStep}
            title="Chốt tư thế toàn bộ xương tại mốc hiện tại và tự động đẩy thời gian sang bước kế tiếp (Phím tắt: Enter)"
          >
            ✓ Xác nhận vị trí <kbd>Enter ⏎</kbd>
          </button>
          <div className="lw-step-duration-group" role="group" aria-label="Bước nhảy thời gian mỗi lần nhấn Enter">
            {[0.15, 0.3, 0.5, 1.0].map((d) => (
              <button
                key={d}
                type="button"
                className={`lw-step-dur-pill${Math.abs(stepRecord.stepDuration - d) < 0.01 ? ' active' : ''}`}
                onClick={() => setStepRecordState({ stepDuration: d })}
                title={`Mỗi lần nhấn Enter sẽ nhảy tiếp +${d}s`}
              >
                +{d}s
              </button>
            ))}
          </div>
        </div>
        <div className="lw-step-record-hints">
          <span><strong>Từng bước:</strong> Chuột trái + <kbd>Enter</kbd></span>
          <span><strong>Realtime:</strong> <kbd>Shift</kbd> + Chuột trái</span>
        </div>
        {stepRecord.status && (
          <div className="lw-step-record-status" role="status">
            {stepRecord.status}
          </div>
        )}
      </div>

      <div className="lw-rig-grid lw-anim-time-grid">
        <RigNumber
          label="Đang đứng (s)"
          value={Number(playback.time.toFixed(2))}
          min={0}
          max={rig.duration}
          step={0.05}
          onChange={(time) => {
            playback.setIsPlaying(false)
            playback.setTime(time)
          }}
        />
        <RigNumber
          label="Thời lượng (s)"
          value={rig.duration}
          min={0.1}
          max={120}
          step={0.1}
          onChange={(duration) => run({ action: 'settings', duration })}
        />
      </div>
    </div>
  )
}

function PoseFields({
  keyframe: pose,
  setKey
}: {
  keyframe: BoneKeyframe
  setKey: (patch: Partial<BoneKeyframe>) => void
}) {
  return (
    <div className="lw-rig-grid">
      <RigNumber
        label="Góc xoay (°)"
        value={pose.rotation}
        onChange={(rotation) => setKey({ rotation })}
      />
      <RigNumber label="Dời X (px)" value={pose.x} onChange={(x) => setKey({ x })} />
      <RigNumber label="Dời Y (px)" value={pose.y} onChange={(y) => setKey({ y })} />
      <RigNumber
        label="Co giãn X"
        value={pose.scaleX ?? 1}
        step={0.05}
        onChange={(scaleX) => setKey({ scaleX })}
      />
      <RigNumber
        label="Co giãn Y"
        value={pose.scaleY ?? 1}
        step={0.05}
        onChange={(scaleY) => setKey({ scaleY })}
      />
    </div>
  )
}
