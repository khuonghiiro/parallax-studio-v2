import { useEffect, useState } from 'react'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import {
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  buildStarterPresetClipsForBones,
  createScaledLandmarks,
  extractLandmarksFromBones,
  type MixamoLandmarks
} from './workshopMixamoAutoRig'
import { MixamoLandmarkPlacer } from './MixamoLandmarkPlacer'
import { WorkshopNewMotionModal } from './WorkshopNewMotionModal'
import { MOTION_PRESETS, type ProceduralMotionPreset } from './workshopRigPresets'
import { IconBone, IconFitWidth, IconWand } from '../icons'
import '../../styles/layerWorkshopMixamo.css'

export interface WorkshopMixamoRigCardProps {
  composite: LayerComposite
  run: (action: RigAction) => void
}

export function WorkshopMixamoRigCard({ composite, run }: WorkshopMixamoRigCardProps) {
  const bones = composite.rig?.bones ?? []
  const [landmarks, setLandmarks] = useState<MixamoLandmarks>(() =>
    extractLandmarksFromBones(bones) ?? autoDetectLandmarksFromComposite(composite)
  )
  const [liveSync, setLiveSync] = useState<boolean>(true)
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false)

  // Tự động đồng bộ lại điểm nhấn khi chuyển sang nhân vật (composite) khác
  useEffect(() => {
    const fromBones = extractLandmarksFromBones(composite.rig?.bones ?? [])
    if (fromBones) {
      setLandmarks(fromBones)
    } else if (composite.layers.length > 0) {
      setLandmarks(autoDetectLandmarksFromComposite(composite))
    } else {
      setLandmarks(createScaledLandmarks(1))
    }
  }, [composite.id, composite.layers.length])

  const handleLandmarksChange = (next: MixamoLandmarks) => {
    setLandmarks(next)
    if (liveSync) {
      const nextBones = buildHumanoidBonesFromLandmarks(next)
      run({
        action: 'apply-mixamo-rig-motion',
        bones: nextBones,
        autoBindSoft: true
      })
    }
  }

  /** Gắn bộ 15 xương từ 8 vòng tròn Mixamo + tự động nạp sẵn trọn bộ 7 động tác mẫu chuẩn */
  const handleApplyAutoRigAndStarterPack = () => {
    const generatedBones = buildHumanoidBonesFromLandmarks(landmarks)
    const starterClips = buildStarterPresetClipsForBones(generatedBones, 'front')
    run({
      action: 'apply-mixamo-rig-motion',
      bones: generatedBones,
      clips: starterClips,
      replaceClips: true,
      autoBindSoft: true
    })
  }

  /** Chỉ gắn 15 xương từ 8 điểm và áp thử ngay 1 động tác mẫu */
  const handleQuickPreset = (preset: ProceduralMotionPreset) => {
    const generatedBones = buildHumanoidBonesFromLandmarks(landmarks)
    const starterClips = buildStarterPresetClipsForBones(generatedBones, 'front')
    const chosen =
      starterClips.find((c) => c.id.includes(`clip-${preset}-`)) ?? starterClips[0]
    run({
      action: 'apply-mixamo-rig-motion',
      bones: generatedBones,
      clip: chosen,
      replaceClips: false,
      autoBindSoft: true
    })
  }

  return (
    <div className="lw-card-section lw-mixamo-rig-card lw-mixamo-card" data-mcp-region="layer_assembly_mixamo_card">
      <div className="lw-mx-card-head">
        <span className="lw-mx-card-title"><IconBone width={14} height={14} /> Gắn điểm Mixamo <span className="lw-count">12 điểm</span></span>
        <button type="button" className="lw-btn sm" onClick={() => setIsStudioOpen(true)}
          title="Mở Studio Mixamo toàn màn hình (12 vòng mốc, góc nhìn & động tác mẫu)"
          aria-label="Studio Mixamo">
          <IconFitWidth width={12} height={12} /> Studio Mixamo
        </button>
      </div>

      <MixamoLandmarkPlacer composite={composite} landmarks={landmarks} onChange={handleLandmarksChange} compact />

      <div className="lw-mx-card-actions">
        <label className="mx-check">
          <input type="checkbox" checked={liveSync} onChange={(e) => setLiveSync(e.target.checked)} />
          Cập nhật xương trực tiếp khi kéo vòng mốc
        </label>
        <button type="button" className="lw-btn primary block" onClick={handleApplyAutoRigAndStarterPack}
          title="Tự động tạo 15 khớp xương từ 12 điểm (Cằm, 2 Vai, 2 Khuỷu tay, 2 Cổ tay, Háng, 2 Đầu gối, 2 Cổ chân), liên kết layer và nạp sẵn bộ 7 động tác mẫu">
          <IconWand width={13} height={13} /> Gắn xương & nạp 7 động tác mẫu
        </button>
        <div className="lw-mx-quick-grid" aria-label="Áp nhanh động tác mẫu">
          {MOTION_PRESETS.slice(0, 6).map((p) => (
            <button key={p.id} type="button" className="lw-chip" onClick={() => handleQuickPreset(p.id)} title={`Gắn xương theo 12 điểm và chạy ngay: ${p.name}`}>
              <span aria-hidden="true">{p.icon}</span> {p.name.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      <WorkshopNewMotionModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        bones={bones}
        composite={composite}
        onCreated={(clip) => run({ action: 'add-clip', clip })}
        onApplyMixamoRigMotion={(payload) =>
          run({
            action: 'apply-mixamo-rig-motion',
            bones: payload.bones,
            clip: payload.clip,
            clips: payload.clips,
            replaceClips: payload.replaceClips,
            autoBindSoft: payload.autoBindSoft
          })
        }
      />
    </div>
  )
}
