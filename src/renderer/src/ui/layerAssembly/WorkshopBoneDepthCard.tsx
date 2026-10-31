import type { LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import {
  BONE_Z_ORDER_LARGE_STEP,
  BONE_Z_ORDER_MAX,
  BONE_Z_ORDER_MIN,
  BONE_Z_ORDER_STEP,
  applyBoneZOrderPreset,
  applyBoneZOrderStep,
  applyBoneZOrderValue,
  getBoneDepthSummary,
  type BoneDepthSemanticPreset
} from './workshopBoneDepthOrder'
import { IconLayerDepthOrder } from './LayerWorkshopStudioIcons'

interface WorkshopBoneDepthCardProps {
  composite: LayerComposite
  rig: LayerRig
  boneId: string
  time: number
  selectBone: (id: string | null) => void
  playback: ReturnType<typeof useWorkshopPlayback>
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
}

const DEPTH_PRESETS: Array<{
  id: BoneDepthSemanticPreset
  label: string
  hint: string
}> = [
  {
    id: 'behind-back',
    label: 'Sau lưng',
    hint: 'Đưa xương và toàn bộ nhánh con lùi ra sau lưng / khuất sau thân người'
  },
  {
    id: 'default',
    label: 'Mặc định',
    hint: 'Trả thứ tự Z-Index của nhánh xương về lớp mặc định ban đầu (Z 0)'
  },
  {
    id: 'front-torso',
    label: 'Trước thân',
    hint: 'Đưa xương và toàn bộ xương con nổi lên phía trước ngực / thân áo'
  },
  {
    id: 'front-face',
    label: 'Trước mặt',
    hint: 'Đưa xương và toàn bộ xương con nổi lên trên cùng trước cả mặt & đầu (khua tay, che mặt)'
  }
]

function formatSignedZ(val: number): string {
  if (val > 0) return `+${val}`
  if (val < 0) return `${val}`
  return '0'
}

export function WorkshopBoneDepthCard({
  composite,
  rig,
  boneId,
  time,
  selectBone,
  playback,
  setComposite
}: WorkshopBoneDepthCardProps) {
  const summary = getBoneDepthSummary(composite, rig, boneId, time)
  if (!summary) return null

  const flatRig: LayerRig = { ...rig, loop: false }
  const activeAncestorDriver = summary.ancestors
    .filter((a) => a.id !== summary.parentBone?.id)
    .find((a) => Math.abs(sampleBonePose(flatRig, a.id, time).zOrder ?? 0) >= 1)

  const handleStep = (delta: number) => {
    playback.setIsPlaying(false)
    setComposite((prev) => applyBoneZOrderStep(prev, boneId, time, delta))
  }

  const handleInputChange = (nextVal: number) => {
    if (!Number.isFinite(nextVal)) return
    playback.setIsPlaying(false)
    setComposite((prev) => applyBoneZOrderValue(prev, boneId, time, nextVal))
  }

  const handlePreset = (preset: BoneDepthSemanticPreset) => {
    playback.setIsPlaying(false)
    setComposite((prev) => applyBoneZOrderPreset(prev, boneId, time, preset))
  }

  const visibleChildren = summary.descendants.slice(0, 4)
  const hiddenChildCount = Math.max(0, summary.descendants.length - visibleChildren.length)

  return (
    <div className="lw-bone-depth-card" data-mcp-region="layer_assembly_bone_depth">
      <div className="lw-bone-depth-head">
        <span className="lw-bone-depth-title" title="Điều chỉnh thứ tự lớp Z-Index của xương theo từng Keyframe; xương cha tăng/giảm thì toàn bộ xương con tự động ăn theo">
          <IconLayerDepthOrder width={13} height={13} />
          <span>Thứ tự lớp Z-Index</span>
        </span>
        <span
          className={`lw-bone-depth-zone-badge zone-${summary.zone}`}
          title={`Vùng hiển thị thực tế của "${summary.bone.name}" tại thời điểm ${time.toFixed(2)}s (Riêng: ${formatSignedZ(summary.localZOrder)}, Kế thừa cha: ${formatSignedZ(summary.inheritedZOrder)})`}
        >
          {summary.zoneLabel} · Z{formatSignedZ(summary.effectiveZOrder)}
        </span>
      </div>

      <div className="lw-bone-depth-stepper" role="group" aria-label="Tăng giảm Z-Index xương">
        <button
          type="button"
          className="lw-bone-depth-step-btn is-back"
          onClick={(e) => handleStep(e.altKey ? -BONE_Z_ORDER_LARGE_STEP : -BONE_Z_ORDER_STEP)}
          title="Giảm Z-Index để đưa cánh tay / chi lùi ra sau lưng (Phím tắt: - · Giữ Alt để lùi nhanh -30)"
        >
          <span>− Lùi sau</span>
          <kbd>-</kbd>
        </button>

        <label
          className="lw-bone-depth-input-box"
          title={`Z-Index riêng tại xương "${summary.bone.name}" (${BONE_Z_ORDER_MIN} đến +${BONE_Z_ORDER_MAX}). Số dương nổi lên trước, số âm lùi ra sau lưng`}
        >
          <span>Z</span>
          <input
            type="number"
            min={BONE_Z_ORDER_MIN}
            max={BONE_Z_ORDER_MAX}
            step={5}
            value={summary.localZOrder}
            onChange={(e) => handleInputChange(Number(e.target.value))}
          />
        </label>

        <button
          type="button"
          className="lw-bone-depth-step-btn is-front"
          onClick={(e) => handleStep(e.altKey ? BONE_Z_ORDER_LARGE_STEP : BONE_Z_ORDER_STEP)}
          title="Tăng Z-Index để đưa cánh tay / chi nổi lên phía trước thân & mặt; các xương con tự ăn theo (Phím tắt: + · Giữ Alt để tăng nhanh +30)"
        >
          <span>+ Nổi trước</span>
          <kbd>+</kbd>
        </button>
      </div>

      <div className="lw-bone-depth-presets" role="group" aria-label="Mức Z-Index nhanh theo giải phẫu">
        {DEPTH_PRESETS.map((item) => {
          const active = summary.zone === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`lw-bone-depth-preset-btn${item.id === 'behind-back' ? ' is-behind' : ''}${active ? ' active' : ''}`}
              onClick={() => handlePreset(item.id)}
              title={item.hint}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {(summary.parentBone || summary.descendants.length > 0) && (
        <div className="lw-bone-depth-hierarchy">
          {summary.parentBone && (
            <div className="lw-bone-depth-hier-row">
              <span className="lw-bone-depth-hier-label">↖ Xương cha:</span>
              <button
                type="button"
                className={`lw-bone-depth-chip${summary.inheritedZOrder !== 0 ? ' has-offset' : ''}`}
                onClick={() => selectBone(summary.parentBone!.id)}
                title={`Chuyển sang xương cha "${summary.parentBone.name}" (chỉnh Z-Index tại xương chính để cả nhánh con cùng nổi/lùi đồng bộ)`}
              >
                {summary.parentBone.name} ({formatSignedZ(summary.inheritedZOrder)})
              </button>
              {activeAncestorDriver && (
                <button
                  type="button"
                  className="lw-bone-depth-chip has-offset"
                  onClick={() => selectBone(activeAncestorDriver.id)}
                  title={`Nhảy nhanh về mốc xương chính "${activeAncestorDriver.name}" đang điều khiển Z-Index của nhánh này`}
                >
                  {activeAncestorDriver.name}
                </button>
              )}
              {summary.inheritedZOrder !== 0 && (
                <span className="lw-bone-depth-total-tag" title="Tổng Z-Index thực tế = Cha + Riêng">
                  Tổng Z{formatSignedZ(summary.effectiveZOrder)}
                </span>
              )}
            </div>
          )}

          {summary.descendants.length > 0 && (
            <div className="lw-bone-depth-hier-row">
              <span className="lw-bone-depth-hier-label">
                ↳ Ăn theo ({summary.descendants.length} con):
              </span>
              {visibleChildren.map((child) => {
                const childLocal = Math.round(sampleBonePose(flatRig, child.id, time).zOrder ?? 0)
                return (
                  <button
                    key={child.id}
                    type="button"
                    className={`lw-bone-depth-chip${childLocal !== 0 ? ' has-offset' : ''}`}
                    onClick={() => selectBone(child.id)}
                    title={`Xương con "${child.name}" tự động cộng hưởng Z-Index từ "${summary.bone.name}" để không bao giờ bị chìm. Bấm để chọn riêng nếu cần tinh chỉnh bù trừ.`}
                  >
                    {child.name}
                    {childLocal !== 0 ? ` (${formatSignedZ(childLocal)})` : ''}
                  </button>
                )
              })}
              {hiddenChildCount > 0 && (
                <span className="lw-bone-depth-more">+{hiddenChildCount} con</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
