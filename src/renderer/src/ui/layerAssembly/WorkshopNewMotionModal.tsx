import { useState, useEffect, useMemo } from 'react'
import type { AnimationClip, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { ProceduralMotionPreset } from './workshopRigPresets'
import { MOTION_PRESETS, createClipFromPreset } from './workshopRigPresets'
import {
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  buildMixamoClipForBones,
  buildStarterPresetClipsForBones,
  createScaledLandmarks,
  extractLandmarksFromBones,
  type MixamoLandmarks
} from './workshopMixamoAutoRig'
import { MixamoStudioSidebar } from './MixamoStudioSidebar'
import { MixamoLandmarkPlacer } from './MixamoLandmarkPlacer'
import { IconBone, IconCheck, IconX } from '../icons'
import '../../styles/layerWorkshopMixamo.css'

export interface WorkshopNewMotionModalProps {
  isOpen: boolean
  onClose: () => void
  bones: LayerBone[]
  composite?: LayerComposite
  onCreated: (clip: AnimationClip) => void
  onApplyMixamoRigMotion?: (payload: {
    bones: LayerBone[]
    clip?: AnimationClip
    clips?: AnimationClip[]
    replaceClips?: boolean
    autoBindSoft?: boolean
  }) => void
}

const ANGLE_LABEL: Record<MotionViewAngle, string> = {
  front: '0° Chính diện',
  diagonal: '45° Góc chéo',
  side: '90° Góc ngang',
  back: '180° Sau lưng'
}

/** Tên clip tự động: "<Tên mẫu> [<góc nhìn>]". */
export function autoClipName(preset: ProceduralMotionPreset | 'blank', angle: MotionViewAngle): string {
  const angleLabel = ANGLE_LABEL[angle] ?? ANGLE_LABEL.front
  if (preset === 'blank') return `Động tác mới [${angleLabel}]`
  const pMeta = MOTION_PRESETS.find((p) => p.id === preset)
  return `${pMeta ? pMeta.name.split(' (')[0] : 'Động tác'} [${angleLabel}]`
}

/** Dựng clip từ mẫu (hoặc clip trống) cho bộ xương có sẵn, không đổi xương. */
export function buildPlainClip(
  preset: ProceduralMotionPreset | 'blank',
  bones: LayerBone[],
  name: string,
  angle: MotionViewAngle,
  duration: number,
  loop: boolean
): AnimationClip {
  if (preset === 'blank') {
    return {
      id: `clip-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      duration: Math.max(0.2, Number(duration) || 2.0),
      loop,
      tracks: {},
      viewAngle: angle,
      description: `Động tác tự do theo góc nhìn ${angle}`
    }
  }
  const clip = createClipFromPreset(preset, bones, name, angle)
  clip.duration = Math.max(0.2, Number(duration) || clip.duration)
  clip.loop = loop
  clip.viewAngle = angle
  return clip
}

export function WorkshopNewMotionModal({
  isOpen,
  onClose,
  bones,
  composite,
  onCreated,
  onApplyMixamoRigMotion
}: WorkshopNewMotionModalProps) {
  const [selectedAngle, setSelectedAngle] = useState<MotionViewAngle>('front')
  const [selectedPreset, setSelectedPreset] = useState<ProceduralMotionPreset | 'blank'>('walk')
  const [duration, setDuration] = useState<number>(1.6)
  const [isLoop, setIsLoop] = useState<boolean>(true)
  const [name, setName] = useState<string>('Bước đi [0° Chính diện]')
  const [isCustomName, setIsCustomName] = useState<boolean>(false)
  const [autoBindSoft, setAutoBindSoft] = useState<boolean>(true)
  const [landmarks, setLandmarks] = useState<MixamoLandmarks>(() =>
    extractLandmarksFromBones(bones) ??
    (composite ? autoDetectLandmarksFromComposite(composite) : createScaledLandmarks(1))
  )

  useEffect(() => {
    if (isOpen) {
      const fromBones = extractLandmarksFromBones(bones)
      if (fromBones) {
        setLandmarks(fromBones)
      } else if (composite && composite.layers.length > 0) {
        setLandmarks(autoDetectLandmarksFromComposite(composite))
      } else {
        setLandmarks(createScaledLandmarks(1))
      }
    }
  }, [isOpen, bones, composite])

  const previewBones = useMemo(() => buildHumanoidBonesFromLandmarks(landmarks), [landmarks])

  if (!isOpen) return null

  const getAutoName = autoClipName

  const handleAngleSelect = (angle: MotionViewAngle) => {
    setSelectedAngle(angle)
    if (!isCustomName) setName(getAutoName(selectedPreset, angle))
  }

  const handlePresetSelect = (preset: ProceduralMotionPreset | 'blank') => {
    setSelectedPreset(preset)
    const pMeta = preset !== 'blank' ? MOTION_PRESETS.find((p) => p.id === preset) : undefined
    if (pMeta) setDuration(pMeta.duration)
    if (!isCustomName) setName(getAutoName(preset, selectedAngle))
  }

  /** Chỉ thêm clip vào bộ xương hiện có (không đổi xương) */
  const handleCreateClipOnly = () => {
    const finalName = name.trim() || getAutoName(selectedPreset, selectedAngle)
    onCreated(buildPlainClip(selectedPreset, bones.length > 0 ? bones : previewBones, finalName, selectedAngle, duration, isLoop))
    onClose()
  }

  /** Gắn xương mới theo tọa độ 12 điểm giải phẫu Mixamo + tự động co giãn động tác theo kích thước xương */
  const handleApplyMixamoRigAndMotion = () => {
    const finalName = name.trim() || getAutoName(selectedPreset, selectedAngle)
    const generatedBones = previewBones
    const clip = buildMixamoClipForBones({
      preset: selectedPreset,
      bones: generatedBones,
      name: finalName,
      viewAngle: selectedAngle,
      duration: Math.max(0.2, Number(duration) || 1.6),
      loop: isLoop
    })

    if (onApplyMixamoRigMotion) {
      onApplyMixamoRigMotion({
        bones: generatedBones,
        clip,
        autoBindSoft
      })
      onClose()
    } else {
      onCreated(clip)
      onClose()
    }
  }

  /** Gắn 15 xương theo 12 vòng tròn giải phẫu Mixamo + nạp sẵn trọn bộ 7 động tác mẫu theo góc đang chọn */
  const handleApplyMixamoStarterPack = () => {
    const generatedBones = previewBones
    const starterClips = buildStarterPresetClipsForBones(generatedBones, selectedAngle)
    if (onApplyMixamoRigMotion) {
      onApplyMixamoRigMotion({
        bones: generatedBones,
        clips: starterClips,
        replaceClips: true,
        autoBindSoft
      })
      onClose()
    } else if (starterClips[0]) {
      onCreated(starterClips[0])
      onClose()
    }
  }

  return (
    <div className="mx-backdrop lw-new-motion-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lw-mixamo-motion-modal mx-modal" role="dialog" aria-modal="true" aria-label="Studio Mixamo 2.5D"
        data-mcp-region="layer_assembly_mixamo_studio" data-mcp-dialog>
        <header className="mx-header" data-mcp-region="layer_assembly_mixamo_header">
          <span className="mx-header-icon"><IconBone width={18} height={18} /></span>
          <div className="mx-header-text">
            <h2>Studio Mixamo 2.5D</h2>
            <p>Đặt 12 vòng mốc lên đúng khớp nhân vật (trái) → chọn góc nhìn & động tác mẫu (phải) → gắn xương tự động.</p>
          </div>
          <span className="mx-header-chip" title="Cằm · 2 Vai · 2 Khuỷu · 2 Cổ tay · Háng · 2 Gối · 2 Cổ chân">12 vòng mốc → 15 xương</span>
          <button type="button" className="lw-icon-btn" onClick={onClose} title="Đóng Studio Mixamo" aria-label="Đóng Studio Mixamo">
            <IconX width={16} height={16} />
          </button>
        </header>
        <div className="mx-body">
          <section className="mx-stage" data-mcp-region="layer_assembly_mixamo_stage" aria-label="Sân khấu đặt vòng mốc">
            <MixamoLandmarkPlacer composite={composite} landmarks={landmarks} onChange={setLandmarks} fullHeight />
          </section>
          <MixamoStudioSidebar
            previewBones={previewBones}
            angle={selectedAngle}
            onAngle={handleAngleSelect}
            preset={selectedPreset}
            onPreset={handlePresetSelect}
            name={name}
            onName={(v) => { setName(v); setIsCustomName(true) }}
            duration={duration}
            onDuration={setDuration}
            loop={isLoop}
            onLoop={setIsLoop}
            autoBindSoft={autoBindSoft}
            onAutoBindSoft={setAutoBindSoft}
          />
        </div>
        <footer className="mx-footer" data-mcp-region="layer_assembly_mixamo_footer">
          <button type="button" className="lw-btn" onClick={onClose}>Huỷ</button>
          <div className="mx-footer-actions">
            {bones.length > 0 && onApplyMixamoRigMotion && (
              <button type="button" className="lw-btn" onClick={handleCreateClipOnly} title="Chỉ thêm động tác vào danh sách, giữ nguyên xương hiện có">
                Chỉ thêm động tác
              </button>
            )}
            {onApplyMixamoRigMotion && (
              <button type="button" className="lw-btn" onClick={handleApplyMixamoStarterPack}
                title="Tạo 15 xương từ 12 vòng mốc và nạp trọn bộ 7 động tác chuẩn (Đi bộ, Đứng thở, Chạy, Vẫy tay, Nhảy, Vung đòn, Cúi chào)">
                Gắn xương + nạp 7 động tác
              </button>
            )}
            <button type="button" className="lw-btn primary" onClick={onApplyMixamoRigMotion ? handleApplyMixamoRigAndMotion : handleCreateClipOnly}
              title="Tạo 15 xương theo 12 vòng mốc đã đặt và gắn động tác đang chọn lên nhân vật">
              <IconCheck width={13} height={13} /> Gắn xương & áp động tác
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

