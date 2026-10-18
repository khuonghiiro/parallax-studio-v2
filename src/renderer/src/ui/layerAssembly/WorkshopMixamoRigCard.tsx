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
    <div className="lw-card-section lw-mixamo-rig-card">
      <div className="lw-card-header" style={{ marginBottom: '6px' }}>
        <span className="lw-card-title">
          <span>🎯 Gắn Điểm Tự Động Mixamo</span>
          <span className="lw-card-badge">8 điểm → 15 khớp</span>
        </span>
        <button
          type="button"
          className="btn xs primary"
          onClick={() => setIsStudioOpen(true)}
          title="Mở cửa sổ lớn xem mẫu xương chuyển động & đặt 8 vòng tròn Mixamo"
          style={{ fontSize: '10px', padding: '2px 7px' }}
        >
          🎬 Mở Studio Mixamo
        </button>
      </div>

      <MixamoLandmarkPlacer
        composite={composite}
        landmarks={landmarks}
        onChange={handleLandmarksChange}
        compact
      />

      {/* Tuỳ chọn cập nhật trực tiếp & Nút xác nhận gắn xương + nạp sẵn các animate */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          marginTop: '8px'
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '10.5px',
            color: 'var(--text-dim)',
            cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={liveSync}
            onChange={(e) => setLiveSync(e.target.checked)}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span>⚡ Tự động cập nhật khung xương trực tiếp khi kéo 8 vòng tròn</span>
        </label>

        <button
          type="button"
          className="btn sm primary"
          onClick={handleApplyAutoRigAndStarterPack}
          title="Tự động tạo 15 khớp xương từ 8 điểm (Cằm, Cổ tay, Khuỷu tay, Đầu gối, Háng), liên kết layer và nạp sẵn bộ 7 động tác mẫu (Đi bộ, Đứng thở, Chạy, Vẫy tay, Nhảy, Vung đòn, Cúi chào)"
          style={{
            width: '100%',
            justifyContent: 'center',
            fontWeight: 700,
            padding: '6px 10px'
          }}
        >
          ✨ Gắn Xương Tự Động & Nạp Sẵn Bộ Động Tác Mẫu
        </button>

        {/* Thanh chọn nhanh động tác tạo sẵn sau khi gắn điểm */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            paddingTop: '2px'
          }}
        >
          {MOTION_PRESETS.slice(0, 6).map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn xs"
              onClick={() => handleQuickPreset(p.id)}
              title={`Gắn xương theo 8 điểm và chạy ngay động tác: ${p.name}`}
              style={{ fontSize: '9.5px', padding: '2px 6px', flex: '1 1 auto' }}
            >
              {p.icon} {p.name.split(' (')[0]}
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
