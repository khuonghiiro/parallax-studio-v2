import { useEffect, useState } from 'react'
import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { RigNumber, type RigPanelProps } from './WorkshopRigPanel'
import { emptyRig, ensureRigClips } from './workshopRig'
import { sameKeyTime, type BonePoseEntry } from './workshopAnimation'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { Select } from '../controls'
import { SegmentedTabs } from '../primitives'
import { WorkshopClipBar } from './WorkshopClipBar'
import { WorkshopCustomActionsCard } from './WorkshopCustomActionsCard'
import { WorkshopRetargetDialog } from './WorkshopRetargetDialog'
import { WorkshopInterpolation } from './WorkshopInterpolation'
import { WorkshopMotionSketchCard } from './WorkshopMotionSketchCard'
import { WorkshopAnimAssistCard, WorkshopSecondaryMotionCard } from './WorkshopAnimAssistCards'
import { setAnimAssist, useAnimAssist } from './animAssistStore'
import { toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import { confirmPoseAndStep, setStepRecordState, useStepRecord } from './workshopStepRecord'
import { WorkshopAnimToolsCard } from './WorkshopAnimToolsCard'
import { WorkshopParallax25DCard } from './WorkshopParallax25DCard'
import { AnimationKeyList, AnimationPoseActions, QuickMotionPresetCard } from './WorkshopAnimPoseParts'
import { useEditor } from '../../store/editor'
import type { LayerComposite } from './types'
import {
  IconAutoKeyRec,
  IconClipsAction,
  IconOnionSkin,
  IconPhysicsSpring,
  IconPoseKey,
  IconRetimeStretch
} from './LayerWorkshopStudioIcons'

type Props = RigPanelProps & {
  playback: ReturnType<typeof useWorkshopPlayback>
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
}

export type AnimInspectorSubTab = 'pose' | 'clips' | 'physics'

const STUDIO_FPS_PRESETS = [12, 24, 30, 60] as const

export function WorkshopAnimationPanel({
  composite,
  boneId,
  selectBone,
  run,
  playback,
  setComposite
}: Props) {
  const { rig, activeClip } = ensureRigClips(composite.rig ?? emptyRig())
  const projectFps = useEditor((s) => s.project.comp.fps) || 30
  const fps = rig.fps || projectFps
  const activeBone = rig.bones.find((b) => b.id === boneId) ?? (rig.bones[0] || null)
  const bone = activeBone
  const time = Math.min(rig.duration, playback.time)
  const keys = bone ? rig.tracks[bone.id] ?? [] : []
  const exact = keys.find((k) => sameKeyTime(k.time, time))
  const previous = keys.filter((k) => k.time <= time).at(-1)
  const pose = bone ? sampleBonePose({ ...rig, loop: false }, bone.id, time) : { x: 0, y: 0, rotation: 0 }
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

  const holdPoseFrames = (framesCount = 3) => {
    playback.setIsPlaying(false)
    const holdSeconds = Number((framesCount / Math.max(4, fps)).toFixed(4))
    run({ action: 'hold-frames', time, holdSeconds, boneId: bone?.id })
    playback.setTime(Math.min(120, Number((time + holdSeconds).toFixed(4))))
  }

  const deleteExactKey = () => {
    if (!bone || !exact) return
    playback.setIsPlaying(false)
    run({ action: 'delete-key', boneId: bone.id, time: exact.time })
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

  const frameNumber = Math.round(time * fps)
  const totalFrames = Math.max(2, Math.round(rig.duration * fps))

  return (
    <div className="lw-rig-panel lw-animation-panel" data-mcp-region="layer_assembly_animation_panel">
      {/* 1. Bảng điều khiển Nhịp độ, FPS, Tổng Frame ⇄ Giây chuẩn Moho Pro & Adobe Animate */}
      <AnimationTransportCard
        rig={rig}
        fps={fps}
        activeClipName={activeClip.name}
        frameNumber={frameNumber}
        totalFrames={totalFrames}
        autoKey={assist.autoKey}
        onToggleAutoKey={() => setAnimAssist({ autoKey: !assist.autoKey })}
        playback={playback}
        run={run}
        onConfirmStep={handleConfirmStep}
      />

      {/* 2. Thanh 3 Sub-Tabs gọn gàng */}
      <SegmentedTabs<AnimInspectorSubTab>
        variant="segmented"
        size="sm"
        ariaLabel="Phân khu Diễn hoạt"
        value={subTab}
        onChange={(next) => {
          setSubTab(next)
          if (next !== 'clips' && sketch.armed) toggleMotionSketchArmed(false)
        }}
        items={[
          {
            id: 'pose',
            label: 'Tạo dáng',
            icon: <IconPoseKey width={12} height={12} />,
            badge: exact ? '◆' : undefined,
            badgeTone: 'accent',
            title: 'Chỉnh khớp IK/FK, tạo Keyframe F6/F5/F7, đường cong Easing & Mẫu động tác nhanh'
          },
          {
            id: 'clips',
            label: 'Clips & Vẽ',
            icon: <IconClipsAction width={12} height={12} />,
            badge: rig.clips?.length ?? 1,
            title: 'Quản lý danh sách Động tác (Clips), Biểu cảm / Nhép miệng & Ghi động tác Realtime'
          },
          {
            id: 'physics',
            label: 'Vật lý & 2.5D',
            icon: <IconPhysicsSpring width={12} height={12} />,
            title: 'Xoay nghiêng đầu/thân 2.5D, Nướng quán tính vật lý tóc/áo/đuôi & Cấu hình IK / Onion Skin'
          }
        ]}
      />

      <WorkshopRetargetDialog
        isOpen={isRetargetOpen}
        onClose={() => setIsRetargetOpen(false)}
        targetComposite={composite}
        onInherit={inherit}
      />

      {/* SUB-TAB 1: TẠO DÁNG, KEYFRAME F6/F5/F7, MẪU ĐỘNG TÁC CHÍNH DIỆN & POSE-TO-POSE */}
      {subTab === 'pose' && (
        <>
          <div className="lw-card-section lw-animation-pose">
            <div className="lw-card-header">
              <span className="lw-card-title">Khớp diễn hoạt</span>
              <span className={`lw-card-badge${exact ? ' lw-badge-keyed' : ''}`}>
                {exact ? `◆ F${frameNumber}` : `Nội suy · F${frameNumber}`}
              </span>
            </div>

            <Select
              size="sm"
              value={bone?.id ?? ''}
              options={[
                { value: '', label: 'Chọn xương trên sân khấu hoặc Dope Sheet' },
                ...rig.bones.map((b) => ({
                  value: b.id,
                  label: `${b.name} (${(rig.tracks[b.id] ?? []).length} key)`
                }))
              ]}
              onChange={(value) => selectBone(String(value) || null)}
            />

            <div className="lw-pose-quick-toggles">
              <button
                type="button"
                className={`lw-pose-toggle-chip${assist.ik ? ' active' : ''}`}
                onClick={() => setAnimAssist({ ik: !assist.ik })}
                title="Bật/tắt kéo ngọn xương theo chuỗi CCD IK (Phím I)"
              >
                <span>IK {assist.ik ? `${assist.ikChain} đốt` : 'Tắt'}</span>
              </button>
              <button
                type="button"
                className={`lw-pose-toggle-chip${assist.onion ? ' active' : ''}`}
                onClick={() => setAnimAssist({ onion: !assist.onion })}
                title="Bật/tắt bóng mờ Onion Skin khung trước/sau (Phím O)"
              >
                <IconOnionSkin width={12} height={12} />
                <span>Onion Skin</span>
              </button>
              <button
                type="button"
                className={`lw-pose-toggle-chip${assist.path ? ' active' : ''}`}
                onClick={() => setAnimAssist({ path: !assist.path })}
                title="Bật/tắt đường quỹ đạo chuyển động ngọn xương (Phím P)"
              >
                <span>Quỹ đạo</span>
              </button>
            </div>

            {bone ? (
              <>
                <PoseFields keyframe={key} setKey={setKey} />

                {/* Thanh thao tác Frame chuẩn Adobe Animate: F6 (Ghi Key), F5 (Giữ dáng +3F), F7 (Xóa Key), Về gốc */}
                <div className="lw-animate-fkey-bar" role="group" aria-label="Thao tác Frame kiểu Adobe Animate">
                  <button
                    type="button"
                    className="btn xs primary"
                    onClick={() => setKey()}
                    title="Adobe Animate F6 (Insert Keyframe): Ghi chốt tư thế xương tại khung hiện tại"
                  >
                    ◆ Ghi Key <kbd>F6</kbd>
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={() => holdPoseFrames(3)}
                    title="Adobe Animate F5 (Insert Frame): Giữ nguyên tư thế này thêm +3 frame và đẩy các key sau lùi lại"
                  >
                    + Giữ 3F <kbd>F5</kbd>
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    disabled={!exact}
                    onClick={deleteExactKey}
                    title="Adobe Animate F7 (Clear Keyframe): Xóa keyframe tại đúng khung đang đứng"
                  >
                    ✕ Xóa <kbd>F7</kbd>
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={() => setKey({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })}
                    title="Đưa xương đang chọn về tư thế gốc Frame 0 tại thời điểm này"
                  >
                    ↺ Gốc
                  </button>
                </div>

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

                <AnimationKeyList bone={bone} keys={keys} time={time} fps={fps} playback={playback} run={run} />
              </>
            ) : (
              <p className="lw-empty-note">Chọn một xương trên sân khấu 2D hoặc hàng Dope Sheet phía dưới để tạo dáng.</p>
            )}
          </div>

          <QuickMotionPresetCard playback={playback} run={run} defaultAsNewClip={false} />

          {bone && <WorkshopAnimToolsCard rig={rig} boneId={bone.id} playback={playback} run={run} />}
        </>
      )}

      {/* SUB-TAB 2: CLIPS ĐỘNG TÁC, MẪU NHANH, BIỂU CẢM SPRITE & GHI ĐỘNG TÁC REALTIME */}
      {subTab === 'clips' && (
        <>
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
                ['switch-clip', 'add-clip', 'duplicate-clip', 'delete-clip', 'delete-all-clips'].includes(action.action)
              ) {
                playback.setTime(0)
              }
              run(action)
            }}
            onOpenRetarget={() => setIsRetargetOpen(true)}
          />
          <QuickMotionPresetCard playback={playback} run={run} defaultAsNewClip={true} />
          <WorkshopMotionSketchCard
            isPlaying={playback.isPlaying}
            onTogglePlay={playback.toggle}
            onConfirmStep={handleConfirmStep}
          />
          <WorkshopCustomActionsCard composite={composite} setComposite={setComposite} />
        </>
      )}

      {/* SUB-TAB 3: XOAY 2.5D PARALLAX, VẬT LÝ XƯƠNG THỨ CẤP & CẤU HÌNH IK/ONION */}
      {subTab === 'physics' && (
        <>
          <WorkshopParallax25DCard
            rig={rig}
            time={time}
            run={run}
            onStartPlayback={() => {
              playback.setTime(0)
              playback.setIsPlaying(true)
            }}
            onPausePlayback={() => playback.setIsPlaying(false)}
          />
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
  fps,
  activeClipName,
  frameNumber,
  totalFrames,
  autoKey,
  onToggleAutoKey,
  playback,
  run,
  onConfirmStep
}: {
  rig: LayerRig
  fps: number
  activeClipName: string
  frameNumber: number
  totalFrames: number
  autoKey: boolean
  onToggleAutoKey: () => void
  playback: Props['playback']
  run: Props['run']
  onConfirmStep: () => void
}) {
  const stepRecord = useStepRecord()
  const [scaleKeys, setScaleKeys] = useState(true)
  const isFrameZero = frameNumber === 0

  const handleFpsChange = (nextFps: number) => {
    run({ action: 'settings', fps: nextFps })
  }

  const handleTotalFramesChange = (nextFrames: number) => {
    const safeFrames = Math.max(2, Math.min(120 * fps, Math.round(nextFrames)))
    const nextDuration = Number(Math.max(0.1, safeFrames / fps).toFixed(3))
    run({ action: 'settings', duration: nextDuration, scaleKeys })
  }

  const handleDurationChange = (nextDuration: number) => {
    const safeDuration = Number(Math.max(0.1, Math.min(120, nextDuration)).toFixed(3))
    run({ action: 'settings', duration: safeDuration, scaleKeys })
  }

  const handleCurrentFrameChange = (nextFrame: number) => {
    const clampedFrame = Math.max(0, Math.min(totalFrames, Math.round(nextFrame)))
    playback.setIsPlaying(false)
    playback.setTime(Math.min(rig.duration, Number((clampedFrame / fps).toFixed(4))))
  }

  return (
    <div className="lw-card-section lw-anim-transport-card">
      <div className="lw-moho-frame0-bar">
        <span className={`lw-frame-mode-badge ${isFrameZero ? 'is-setup' : 'is-animating'}`} title={activeClipName}>
          {isFrameZero ? `◇ F0/${totalFrames} · KHỞI ĐẦU` : `◆ F${frameNumber}/${totalFrames} · ${activeClipName}`}
        </span>
        <button
          type="button"
          className={`lw-autokey-pill${autoKey ? ' active' : ''}`}
          onClick={onToggleAutoKey}
          aria-pressed={autoKey}
          title="Auto-Key (Moho & Adobe Animate): Tự động ghi Keyframe ngay khi kéo xương"
        >
          <IconAutoKeyRec width={11} height={11} />
          <span>Auto-Key</span>
        </button>
      </div>

      {/* Hàng điều khiển phát, tốc độ chạy thử & vòng lặp */}
      <div className="lw-anim-transport-row">
        <button type="button" className="btn xs primary lw-play-main-btn" onClick={playback.toggle}>
          {playback.isPlaying ? '⏸ Dừng' : '▶ Phát'}
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={() => {
            playback.setIsPlaying(false)
            playback.setTime(0)
          }}
          title="Đưa đầu phát về Frame 0 (0.00s)"
        >
          ⏮ F0
        </button>
        <button
          type="button"
          className={`lw-moho-opt-pill lw-speed-pill${playback.speed !== 1 ? ' active' : ''}`}
          onClick={playback.cycleSpeed}
          title="Đổi tốc độ chạy thử động tác (0.5× → 1× → 1.5× → 2×)"
        >
          <span>Tốc độ {playback.speed}×</span>
        </button>
        <button
          type="button"
          className={`lw-moho-opt-pill lw-loop-pill${rig.loop ? ' active' : ''}`}
          onClick={() => run({ action: 'settings', loop: !rig.loop })}
          aria-pressed={rig.loop}
          title="Bật/tắt tự động lặp vòng khi phát hết động tác"
        >
          <span>{rig.loop ? '🔁 Lặp' : '↦ 1 lần'}</span>
        </button>
      </div>

      {/* Thanh chọn tốc độ khung hình FPS & Co giãn Key chuẩn Moho / Adobe Animate */}
      <div className="lw-fps-retime-bar">
        <div className="lw-fps-seg" role="radiogroup" aria-label="Số khung hình trên giây (FPS)">
          {STUDIO_FPS_PRESETS.map((presetFps) => {
            const active = fps === presetFps
            return (
              <button
                key={presetFps}
                type="button"
                role="radio"
                aria-checked={active}
                className={`lw-fps-seg-btn${active ? ' active' : ''}`}
                onClick={() => handleFpsChange(presetFps)}
                title={`Đặt nhịp chuẩn ${presetFps} frame/giây (mỗi frame = ${(1000 / presetFps).toFixed(1)}ms)`}
              >
                {presetFps}
              </button>
            )
          })}
          <span className="lw-fps-unit">fps</span>
        </div>

        <button
          type="button"
          className={`lw-moho-opt-pill lw-scale-keys-pill${scaleKeys ? ' active' : ''}`}
          onClick={() => setScaleKeys((v) => !v)}
          aria-pressed={scaleKeys}
          title={
            scaleKeys
              ? 'Đang bật Co giãn Key: khi đổi Tổng Frame hoặc Thời lượng (s), toàn bộ Keyframe tự co giãn tỷ lệ mượt mà'
              : 'Đang tắt Co giãn Key: giữ nguyên vị trí giây của các Keyframe cũ khi tăng/giảm độ dài clip'
          }
        >
          <IconRetimeStretch width={11} height={11} />
          <span>Co giãn Key</span>
        </button>
      </div>

      {/* Lưới tự động quy đổi 2 chiều: Khung F ⇄ Thời điểm (s) và Tổng Frame ⇄ Độ dài (s) */}
      <div className="lw-rig-grid lw-anim-time-grid">
        <RigNumber
          label="Khung hiện tại (F)"
          value={frameNumber}
          min={0}
          max={totalFrames}
          step={1}
          onChange={handleCurrentFrameChange}
        />
        <RigNumber
          label="Thời điểm (s)"
          value={Number(playback.time.toFixed(2))}
          min={0}
          max={rig.duration}
          step={Number((1 / fps).toFixed(3))}
          onChange={(t) => {
            playback.setIsPlaying(false)
            playback.setTime(t)
          }}
        />
        <RigNumber
          label={`Tổng Frame (@${fps}fps)`}
          value={totalFrames}
          min={2}
          max={120 * fps}
          step={1}
          onChange={handleTotalFramesChange}
        />
        <RigNumber
          label="Độ dài clip (s)"
          value={Number(rig.duration.toFixed(2))}
          min={0.1}
          max={120}
          step={0.1}
          onChange={handleDurationChange}
        />
      </div>

      {/* Thanh Chốt bước nhanh (Pose-by-Pose Stepper) */}
      <div className="lw-step-record-bar">
        <div className="lw-step-record-main">
          <button
            type="button"
            className={`btn xs lw-confirm-step-btn${stepRecord.pendingConfirm ? ' pending' : ''}`}
            onClick={onConfirmStep}
            title="Chốt tư thế toàn bộ xương tại mốc hiện tại và tự động nhảy sang bước kế tiếp (Phím tắt: Enter)"
          >
            ✓ Chốt bước <kbd>Enter</kbd>
          </button>
          <div className="lw-step-duration-group" role="group" aria-label="Bước nhảy mỗi lần nhấn Enter">
            {[0.15, 0.25, 0.5, 1.0].map((d) => {
              const stepF = Math.max(1, Math.round(d * fps))
              return (
                <button
                  key={d}
                  type="button"
                  className={`lw-step-dur-pill${Math.abs(stepRecord.stepDuration - d) < 0.01 ? ' active' : ''}`}
                  onClick={() => setStepRecordState({ stepDuration: d })}
                  title={`Mỗi lần nhấn Enter nhảy tiếp +${stepF} frame (+${d}s)`}
                >
                  +{stepF}F
                </button>
              )
            })}
          </div>
        </div>
        {stepRecord.status && (
          <div className="lw-step-record-status" role="status">
            {stepRecord.status}
          </div>
        )}
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
    <div className="lw-pose-fields-stack">
      <div className="lw-pose-fields-row3">
        <RigNumber label="Xoay (°)" value={pose.rotation} onChange={(rotation) => setKey({ rotation })} />
        <RigNumber label="Dời X" value={pose.x} onChange={(x) => setKey({ x })} />
        <RigNumber label="Dời Y" value={pose.y} onChange={(y) => setKey({ y })} />
      </div>
      <div className="lw-rig-grid">
        <RigNumber
          label="Tỉ lệ X"
          value={pose.scaleX ?? 1}
          step={0.05}
          onChange={(scaleX) => setKey({ scaleX })}
        />
        <RigNumber
          label="Tỉ lệ Y"
          value={pose.scaleY ?? 1}
          step={0.05}
          onChange={(scaleY) => setKey({ scaleY })}
        />
      </div>
    </div>
  )
}
