import { useEffect, useState } from 'react'
import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { RigNumber } from './RigNumber'
import type { RigCommonProps } from './WorkshopRigPanel'
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
import { WorkshopBoneConstraintCard } from './WorkshopBoneConstraintCard'
import { setAnimAssist, useAnimAssist } from './animAssistStore'
import { toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import {
  confirmPoseAndStep,
  setStepRecordFrames,
  setStepRecordSeconds,
  useStepRecord
} from './workshopStepRecord'
import { WorkshopAnimToolsCard } from './WorkshopAnimToolsCard'
import { WorkshopBoneDepthCard } from './WorkshopBoneDepthCard'
import { WorkshopParallax25DCard } from './WorkshopParallax25DCard'
import {
  ActiveActionClipHeader,
  AnimationKeyList,
  AnimationPoseActions,
  QuickMotionPresetCard
} from './WorkshopAnimPoseParts'
import { useEditor } from '../../store/editor'
import type { LayerComposite } from './types'
import {
  IconAutoKeyRec,
  IconClipsAction,
  IconLoopCycle,
  IconOnionSkin,
  IconPhysicsSpring,
  IconPoseKey,
  IconRetimeStretch
} from './LayerWorkshopStudioIcons'

type Props = RigCommonProps & {
  playback: ReturnType<typeof useWorkshopPlayback>
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
  subTab?: AnimInspectorSubTab
  onChangeSubTab?: (t: AnimInspectorSubTab) => void
}

export type AnimInspectorSubTab = 'pose' | 'clips' | 'physics'

const STUDIO_FPS_PRESETS = [12, 24, 30, 60] as const

function UnifiedPoseCard({
  keyframe: pose,
  setKey
}: {
  keyframe: BoneKeyframe
  setKey: (patch: Partial<BoneKeyframe>) => void
}) {
  return (
    <div
      className="lw-unified-pose-card"
      style={{
        marginTop: 6,
        padding: '8px 10px',
        background: 'var(--bg-2)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      {/* 1. Thanh xoay góc FK trực quan với thanh trượt */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          Góc xoay
        </span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={Math.round(pose.rotation ?? 0)}
          aria-label="Xoay góc FK 360°"
          onChange={(e) => setKey({ rotation: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <strong style={{ fontSize: 11, minWidth: 44, textAlign: 'right', color: 'var(--accent)' }}>
          {Math.round(pose.rotation ?? 0)}°
        </strong>
      </div>

      {/* 2. Hàng nhập số 3 trường Xoay / X / Y */}
      <div className="lw-pose-fields-row3">
        <RigNumber label="Xoay (°)" value={pose.rotation} onChange={(rotation) => setKey({ rotation })} />
        <RigNumber label="Dời X" value={pose.x} onChange={(x) => setKey({ x })} />
        <RigNumber label="Dời Y" value={pose.y} onChange={(y) => setKey({ y })} />
      </div>

      {/* 3. Tỉ lệ X / Y */}
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

      {/* 4. Dời nhanh 4 hướng & Đặt lại vị trí */}
      <div className="lw-creature-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ y: Number(((pose.y ?? 0) - 12).toFixed(1)) })} title="Dời khớp Lên trên (-12px Y)">
          ⬆️ Lên
        </button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ y: Number(((pose.y ?? 0) + 12).toFixed(1)) })} title="Dời / gật khớp Xuống dưới (+12px Y)">
          ⬇️ Xuống
        </button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ x: Number(((pose.x ?? 0) - 12).toFixed(1)) })} title="Dời khớp sang Trái (-12px X)">
          ⬅️ Trái
        </button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ x: Number(((pose.x ?? 0) + 12).toFixed(1)) })} title="Dời khớp sang Phải (+12px X)">
          ➡️ Phải
        </button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ x: 0, y: 0 })} title="Đưa vị trí X, Y về tâm gốc (0, 0)">
          🎯 Tâm (0,0)
        </button>
      </div>

      {/* 5. Góc xoay nhanh */}
      <div className="lw-creature-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ rotation: 0 })} title="Thẳng đứng ban đầu (0°)">0°</button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ rotation: 45 })} title="Đá trước nhẹ (+45°)">+45°</button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ rotation: 90 })} title="Đá cao ngang (+90°)">+90°</button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ rotation: -45 })} title="Bẻ ra sau (-45°)">-45°</button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ rotation: -90 })} title="Bẻ thẳng sau (-90°)">-90°</button>
        <button type="button" className="lw-creature-pill" onClick={() => setKey({ rotation: 180 })} title="Ngược lên (180°)">180°</button>
      </div>
    </div>
  )
}

export function WorkshopAnimationPanel({
  composite,
  boneId,
  selectBone,
  run,
  playback,
  setComposite,
  subTab: controlledSubTab,
  onChangeSubTab
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
  const [clipsMode, setClipsMode] = useState<'clips' | 'sketch' | 'custom'>('clips')
  const [poseMode, setPoseMode] = useState<'pose' | 'constraints' | 'presets'>('pose')
  const [copiedPose, setCopiedPose] = useState<BonePoseEntry[] | null>(null)
  const [internalSubTab, setInternalSubTab] = useState<AnimInspectorSubTab>('pose')
  const subTab = controlledSubTab ?? internalSubTab
  const setSubTab = onChangeSubTab ?? setInternalSubTab
  const assist = useAnimAssist()
  const sketch = useMotionSketch()

  const handleConfirmStep = () => {
    playback.setIsPlaying(false)
    const res = confirmPoseAndStep(composite, playback.time)
    setComposite(() => res.composite)
    playback.setTime(res.nextTime)
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
      poses: rig.bones.map((b) => ({
        boneId: b.id,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        zOrder: 0
      }))
    })
  }

  const frameNumber = Math.round(time * fps)
  const totalFrames = Math.max(2, Math.round(rig.duration * fps))

  return (
    <div className="lw-rig-panel lw-animation-panel" data-mcp-region="layer_assembly_animation_panel">
      {/* Thanh điều khiển phát lại Compact duy nhất, không chiếm diện tích sub-tab */}
      <AnimationCompactTransportBar
        rig={rig}
        activeClip={activeClip}
        frameNumber={frameNumber}
        totalFrames={totalFrames}
        time={time}
        playback={playback}
        autoKey={assist.autoKey}
        onToggleAutoKey={() => setAnimAssist({ autoKey: !assist.autoKey })}
        run={run}
      />

      {/* 2. Thanh 3 Sub-Tabs gọn gàng (ẩn khi dùng dải tab dọc bên ngoài) */}
      {!controlledSubTab && <SegmentedTabs<AnimInspectorSubTab>
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
      />}

      <WorkshopRetargetDialog
        isOpen={isRetargetOpen}
        onClose={() => setIsRetargetOpen(false)}
        targetComposite={composite}
        onInherit={inherit}
      />

      {/* SUB-TAB 1: TẠO DÁNG, KEYFRAME F6/F5/F7, RÀNG BUỘC KHỚP & MẪU CỬ ĐỘNG */}
      {subTab === 'pose' && (
        <>
          {/* Phân khu Dáng & Key: 1-Click Chuyển đổi Tạo dáng, Khớp & Trục Z, Mẫu cử động */}
          <div className="lw-clips-mode-nav" role="tablist" aria-label="Chế độ Dáng & Key">
            <button
              type="button"
              role="tab"
              aria-selected={poseMode === 'pose'}
              className={`lw-clips-mode-btn${poseMode === 'pose' ? ' active' : ''}`}
              onClick={() => setPoseMode('pose')}
              title="Tạo dáng xương FK/IK, đặt Keyframe F6/F5/F7 & Sao chép tư thế"
            >
              <span>🦵 Tạo dáng</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={poseMode === 'constraints'}
              className={`lw-clips-mode-btn${poseMode === 'constraints' ? ' active' : ''}`}
              onClick={() => setPoseMode('constraints')}
              title="Giới hạn góc xoay khớp cơ học (∠) & Thứ tự lớp chiều sâu Z-Index"
            >
              <span>📐 Khớp &amp; Trục Z</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={poseMode === 'presets'}
              className={`lw-clips-mode-btn${poseMode === 'presets' ? ' active' : ''}`}
              onClick={() => setPoseMode('presets')}
              title="Thư viện mẫu cử động nhanh, danh sách Keyframe &amp; Đường cong nội suy Easing"
            >
              <span>📦 Mẫu cử động</span>
            </button>
          </div>

          {poseMode === 'pose' && (
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
                  <UnifiedPoseCard keyframe={key} setKey={setKey} />

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
                      onClick={() => setKey({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, zOrder: 0 })}
                      title="Đưa xương đang chọn về tư thế và Z-Index gốc Frame 0 tại thời điểm này"
                    >
                      ↺ Gốc
                    </button>
                  </div>

                  {/* Thanh Chốt bước Pose-by-Pose: nhảy sang frame tiếp theo */}
                  <StepRecordBar onConfirmStep={handleConfirmStep} fps={fps} />

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
                </>
              ) : (
                <p className="lw-empty-note">Chọn một xương trên sân khấu 2D hoặc hàng Dope Sheet phía dưới để tạo dáng.</p>
              )}
            </div>
          )}

          {poseMode === 'constraints' && (
            <div className="lw-card-section lw-animation-pose">
              <div className="lw-card-header">
                <span className="lw-card-title">Ràng buộc cơ học &amp; Chiều sâu Z</span>
                <span className="lw-card-badge">{bone ? bone.name : 'Chưa chọn'}</span>
              </div>
              {bone ? (
                <>
                  {!bone.pin && bone.length >= 16 && (
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn xs"
                        onClick={() => run({ action: 'split-bone', boneId: bone.id })}
                        style={{ fontSize: 10, padding: '2px 8px', color: 'var(--accent-cyan)' }}
                        title="Chia đôi xương này thành 2 đoạn (Đùi + Cẳng chân hoặc Bắp tay + Cẳng tay) để tạo khớp gối/khuỷu gập cong tự nhiên"
                      >
                        ✂️ Bẻ đôi xương (Tạo Gối / Khuỷu)
                      </button>
                    </div>
                  )}
                  {!bone.pin && (
                    <WorkshopBoneConstraintCard
                      bone={bone}
                      patch={(patch) => run({ action: 'update-bone', boneId: bone.id, patch })}
                    />
                  )}
                  <WorkshopBoneDepthCard
                    composite={composite}
                    rig={rig}
                    boneId={bone.id}
                    time={time}
                    selectBone={selectBone}
                    playback={playback}
                    setComposite={setComposite}
                  />
                </>
              ) : (
                <p className="lw-empty-note">Chọn một xương trên sân khấu 2D để cài đặt góc giới hạn hoặc thứ tự đè lớp Z-Index.</p>
              )}
            </div>
          )}

          {poseMode === 'presets' && (
            <>
              <QuickMotionPresetCard playback={playback} run={run} defaultAsNewClip={false} />
              {bone && (
                <div className="lw-card-section" style={{ marginTop: 6 }}>
                  <div className="lw-card-header">
                    <span className="lw-card-title">Đường cong nội suy Easing</span>
                    <span className="lw-card-badge">{bone.name}</span>
                  </div>
                  <WorkshopInterpolation
                    keyframe={key}
                    onChange={(patch: Partial<BoneKeyframe>) => {
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
                  <AnimationKeyList
                    bone={bone}
                    keys={keys}
                    time={time}
                    duration={rig.duration}
                    fps={fps}
                    playback={playback}
                    run={run}
                  />
                </div>
              )}
              {bone && <WorkshopAnimToolsCard rig={rig} boneId={bone.id} playback={playback} run={run} />}
            </>
          )}
        </>
      )}

      {/* SUB-TAB 2: QUẢN LÝ CLIPS, CÀI ĐẶT THỜI LƯỢNG FPS, BIỂU CẢM SPRITE & GHI ĐỘNG TÁC REALTIME */}
      {subTab === 'clips' && (
        <>
          {/* Phân khu Hành động: 1-Click Chuyển đổi giữa Clips động tác, Bút vẽ tự do và Biểu cảm */}
          <div className="lw-clips-mode-nav" role="tablist" aria-label="Chế độ Hành động">
            <button
              type="button"
              role="tab"
              aria-selected={clipsMode === 'clips'}
              className={`lw-clips-mode-btn${clipsMode === 'clips' ? ' active' : ''}`}
              onClick={() => setClipsMode('clips')}
              title="Quản lý danh sách Động tác của khung xương & Cài đặt FPS"
            >
              <span>🎬 Clips ({rig.clips?.length ?? 1})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={clipsMode === 'sketch'}
              className={`lw-clips-mode-btn${clipsMode === 'sketch' ? ' active' : ''}`}
              onClick={() => setClipsMode('sketch')}
              title="Bút vẽ tự do & Ghi động tác Realtime / Từng bước bằng nét chuột"
            >
              <span>✏️ Bút vẽ &amp; Ghi</span>
              {sketch.armed && <span className="lw-clips-mode-badge tone-rec">● Bật</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={clipsMode === 'custom'}
              className={`lw-clips-mode-btn${clipsMode === 'custom' ? ' active' : ''}`}
              onClick={() => setClipsMode('custom')}
              title="Động tác ảnh & biểu cảm: Nhép miệng nói, nháy mắt, đổi khuôn mặt sprite"
            >
              <span>🎭 Biểu cảm ({(composite.customActions ?? []).length})</span>
            </button>
          </div>

          {clipsMode === 'clips' && (
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
              <ClipTimingSettingsCard
                rig={rig}
                fps={fps}
                totalFrames={totalFrames}
                run={run}
              />
            </>
          )}

          {clipsMode === 'sketch' && (
            <WorkshopMotionSketchCard
              isPlaying={playback.isPlaying}
              onTogglePlay={playback.toggle}
              onConfirmStep={handleConfirmStep}
            />
          )}

          {clipsMode === 'custom' && (
            <WorkshopCustomActionsCard composite={composite} setComposite={setComposite} />
          )}
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

function AnimationCompactTransportBar({
  rig,
  activeClip,
  frameNumber,
  totalFrames,
  time,
  playback,
  autoKey,
  onToggleAutoKey,
  run
}: {
  rig: LayerRig
  activeClip: AnimationClip
  frameNumber: number
  totalFrames: number
  time: number
  playback: Props['playback']
  autoKey: boolean
  onToggleAutoKey: () => void
  run: Props['run']
}) {
  const isFrameZero = frameNumber === 0

  return (
    <div className="lw-anim-compact-bar">
      <button
        type="button"
        className="btn xs primary lw-anim-play-btn"
        onClick={playback.toggle}
        title={playback.isPlaying ? 'Tạm dừng (Phím Space)' : 'Phát thử (Phím Space)'}
      >
        {playback.isPlaying ? '⏸ Dừng' : '▶ Phát'}
      </button>

      <button
        type="button"
        className="btn xs lw-anim-f0-btn"
        onClick={() => {
          playback.setIsPlaying(false)
          playback.setTime(0)
        }}
        title="Về đầu mốc Frame 0 (0.00s)"
      >
        ⏮ F0
      </button>

      <span
        className={`lw-frame-mode-badge ${isFrameZero ? 'is-setup' : 'is-animating'}`}
        title={`Đang sửa clip "${activeClip.name}"`}
      >
        <strong>{isFrameZero ? 'F0' : `F${frameNumber}`}</strong>/{totalFrames} · {time.toFixed(2)}s
      </span>

      <button
        type="button"
        className={`lw-autokey-pill${autoKey ? ' active' : ''}`}
        onClick={onToggleAutoKey}
        aria-pressed={autoKey}
        title="Auto-Key: Tự động ghi Keyframe khi kéo chỉnh xương trên sân khấu"
      >
        <IconAutoKeyRec width={11} height={11} />
        <span>Auto-Key</span>
      </button>

      <button
        type="button"
        className={`lw-moho-opt-pill lw-speed-pill${playback.speed !== 1 ? ' active' : ''}`}
        onClick={playback.cycleSpeed}
        title={`Tốc độ phát: ${playback.speed}x (Bấm để đổi 0.5x, 1x, 1.5x, 2x)`}
      >
        <span>{playback.speed}×</span>
      </button>

      <button
        type="button"
        className={`lw-moho-opt-pill lw-loop-pill${rig.loop ? ' active' : ''}`}
        onClick={() => run({ action: 'settings', loop: !rig.loop })}
        aria-pressed={rig.loop}
        title="Bật/tắt tự động phát lặp vòng"
      >
        <span>{rig.loop ? '🔁 Lặp' : '↦ 1 lần'}</span>
      </button>
    </div>
  )
}

function StepRecordBar({ onConfirmStep, fps }: { onConfirmStep: () => void; fps: number }) {
  const stepRecord = useStepRecord()

  return (
    <div className="lw-step-record-bar" style={{ marginTop: 8 }}>
      <div className="lw-step-record-main">
        <button
          type="button"
          className={`btn xs lw-confirm-step-btn${stepRecord.pendingConfirm ? ' pending' : ''}`}
          onClick={onConfirmStep}
          title="Chốt tư thế toàn bộ xương tại mốc hiện tại, giữ nguyên tư thế và nhảy sang bước kế tiếp (Phím tắt: Enter)"
        >
          ✓ Chốt bước <kbd>Enter</kbd>
        </button>
        <div className="lw-step-duration-group" role="group" aria-label="Bước nhảy Frame">
          {[1, 3, 6, 12].map((f) => {
            const sec = Number((f / fps).toFixed(4))
            const active = Math.abs(stepRecord.stepDuration - sec) < 0.008
            return (
              <button
                key={f}
                type="button"
                className={`lw-step-dur-pill${active ? ' active' : ''}`}
                onClick={() => setStepRecordFrames(f, fps)}
                title={`Mỗi bước nhảy +${f} Frame`}
              >
                +{f}F
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ClipTimingSettingsCard({
  rig,
  fps,
  totalFrames,
  run
}: {
  rig: LayerRig
  fps: number
  totalFrames: number
  run: Props['run']
}) {
  const [scaleKeys, setScaleKeys] = useState(true)

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

  return (
    <div className="lw-card-section lw-clip-timing-card">
      <div className="lw-card-header">
        <span className="lw-card-title">Cài đặt nhịp FPS & Thời lượng Clip</span>
      </div>

      <div className="lw-fps-retime-bar">
        <div className="lw-fps-seg" role="radiogroup" aria-label="Số khung hình trên giây (FPS)">
          {STUDIO_FPS_PRESETS.map((presetFps) => (
            <button
              key={presetFps}
              type="button"
              role="radio"
              aria-checked={fps === presetFps}
              className={`lw-fps-seg-btn${fps === presetFps ? ' active' : ''}`}
              onClick={() => handleFpsChange(presetFps)}
              title={`Đặt ${presetFps} FPS`}
            >
              {presetFps}
            </button>
          ))}
          <span className="lw-fps-unit">fps</span>
        </div>

        <button
          type="button"
          className={`lw-moho-opt-pill lw-scale-keys-pill${scaleKeys ? ' active' : ''}`}
          onClick={() => setScaleKeys((v) => !v)}
          aria-pressed={scaleKeys}
          title="Tự động co giãn tỷ lệ các Keyframe khi đổi thời lượng"
        >
          <IconRetimeStretch width={11} height={11} />
          <span>Co giãn Key</span>
        </button>
      </div>

      <div className="lw-rig-grid lw-anim-time-grid">
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
    </div>
  )
}


