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
import { AnimationKeyList, AnimationPoseActions } from './WorkshopAnimPoseParts'
import { useEditor } from '../../store/editor'
import type { LayerComposite } from './types'
import {
  IconAutoKeyRec,
  IconClipsAction,
  IconOnionSkin,
  IconPhysicsSpring,
  IconPoseKey
} from './LayerWorkshopStudioIcons'

type Props = RigPanelProps & {
  playback: ReturnType<typeof useWorkshopPlayback>
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
}

export type AnimInspectorSubTab = 'pose' | 'clips' | 'physics'

export function WorkshopAnimationPanel({
  composite,
  boneId,
  selectBone,
  run,
  playback,
  setComposite
}: Props) {
  const { rig, activeClip } = ensureRigClips(composite.rig ?? emptyRig())
  const fps = useEditor((s) => s.project.comp.fps) || 30
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

  return (
    <div className="lw-rig-panel lw-animation-panel" data-mcp-region="layer_assembly_animation_panel">
      {/* 1. Thanh Điều khiển Phát, Frame Badge & Auto-Key chuẩn Moho / Adobe Animate */}
      <AnimationTransportCard
        rig={rig}
        activeClipName={activeClip.name}
        frameNumber={frameNumber}
        autoKey={assist.autoKey}
        onToggleAutoKey={() => setAnimAssist({ autoKey: !assist.autoKey })}
        playback={playback}
        run={run}
        onConfirmStep={handleConfirmStep}
      />

      {/* 2. Thanh 3 Sub-Tabs gọn gàng (loại bỏ cuộn dọc 7 thẻ) */}
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
            title: 'Chỉnh khớp IK/FK, nội suy đường cong Easing/Bezier & danh sách Keyframe'
          },
          {
            id: 'clips',
            label: 'Clips & Vẽ',
            icon: <IconClipsAction width={12} height={12} />,
            badge: rig.clips?.length ?? 1,
            title: 'Quản lý danh sách Động tác (Clips), Nhép miệng / Biểu cảm & Ghi động tác Realtime / Bút vẽ'
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

      {/* SUB-TAB 1: TẠO DÁNG, EASING & POSE-TO-POSE */}
      {subTab === 'pose' && (
        <div className="lw-card-section lw-animation-pose">
          <div className="lw-card-header">
            <span className="lw-card-title">Khớp đang diễn hoạt</span>
            <span className={`lw-card-badge${exact ? ' lw-badge-keyed' : ''}`}>
              {exact ? `◆ F${frameNumber}` : 'Nội suy'}
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
              🦾 IK {assist.ik ? `(${assist.ikChain})` : 'Tắt'}
            </button>
            <button
              type="button"
              className={`lw-pose-toggle-chip${assist.onion ? ' active' : ''}`}
              onClick={() => setAnimAssist({ onion: !assist.onion })}
              title="Bật/tắt bóng mờ Onion Skin khung trước/sau (Phím O)"
            >
              <IconOnionSkin width={12} height={12} /> Onion
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
                <button type="button" className="btn sm primary" onClick={() => setKey()}>
                  ◆ Ghi Key tại F{frameNumber}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setKey({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })}
                >
                  ↺ Về gốc
                </button>
              </div>

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

              <WorkshopAnimToolsCard rig={rig} boneId={bone.id} playback={playback} run={run} />

              <AnimationKeyList bone={bone} keys={keys} time={time} playback={playback} run={run} />
            </>
          ) : (
            <p className="lw-empty-note">Chọn một xương trên sân khấu 2D hoặc hàng Dope Sheet phía dưới để tạo dáng.</p>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CLIPS ĐỘNG TÁC, BIỂU CẢM SPRITE & GHI ĐỘNG TÁC REALTIME */}
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
  activeClipName,
  frameNumber,
  autoKey,
  onToggleAutoKey,
  playback,
  run,
  onConfirmStep
}: {
  rig: LayerRig
  activeClipName: string
  frameNumber: number
  autoKey: boolean
  onToggleAutoKey: () => void
  playback: Props['playback']
  run: Props['run']
  onConfirmStep: () => void
}) {
  const stepRecord = useStepRecord()
  const isFrameZero = frameNumber === 0

  return (
    <div className="lw-card-section lw-anim-transport-card">
      <div className="lw-moho-frame0-bar">
        <span className={`lw-frame-mode-badge ${isFrameZero ? 'is-setup' : 'is-animating'}`} title={activeClipName}>
          {isFrameZero ? '◇ F0 · KHUNG KHỞI ĐẦU' : `◆ F${frameNumber} · ${activeClipName}`}
        </span>
        <button
          type="button"
          className={`lw-autokey-pill${autoKey ? ' active' : ''}`}
          onClick={onToggleAutoKey}
          aria-pressed={autoKey}
          title="Auto-Key (chuẩn Moho & Adobe Animate): Tự động ghi Keyframe ngay khi kéo xương"
        >
          <IconAutoKeyRec width={11} height={11} />
          <span>Auto-Key</span>
        </button>
      </div>

      <div className="lw-anim-transport-row">
        <button type="button" className="btn sm primary" onClick={playback.toggle}>
          {playback.isPlaying ? '⏸ Dừng' : '▶ Phát'}
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            playback.setIsPlaying(false)
            playback.setTime(0)
          }}
          title="Đưa đầu phát về Frame 0 (0.00s)"
        >
          ⏮ F0
        </button>
        <label className="lw-rig-check lw-anim-loop-check" title="Tự động lặp lại khi phát hết clip">
          <input
            type="checkbox"
            checked={rig.loop}
            onChange={(e) => run({ action: 'settings', loop: e.target.checked })}
          />
          <span>Lặp</span>
        </label>
      </div>

      <div className="lw-step-record-bar">
        <div className="lw-step-record-main">
          <button
            type="button"
            className={`btn xs lw-confirm-step-btn${stepRecord.pendingConfirm ? ' pending' : ''}`}
            onClick={onConfirmStep}
            title="Chốt tư thế toàn bộ xương tại mốc hiện tại và tự động đẩy thời gian sang bước kế tiếp (Phím tắt: Enter)"
          >
            ✓ Chốt bước <kbd>Enter</kbd>
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
        {stepRecord.status && (
          <div className="lw-step-record-status" role="status">
            {stepRecord.status}
          </div>
        )}
      </div>

      <div className="lw-rig-grid lw-anim-time-grid">
        <RigNumber
          label="Thời điểm (s)"
          value={Number(playback.time.toFixed(2))}
          min={0}
          max={rig.duration}
          step={0.05}
          onChange={(t) => {
            playback.setIsPlaying(false)
            playback.setTime(t)
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
      <RigNumber label="Góc xoay (°)" value={pose.rotation} onChange={(rotation) => setKey({ rotation })} />
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
